import { MAX_WEBP_BYTES } from "./constants.js";

function defaultCanvasFactory(width, height) {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(width, height);
  if (typeof document !== "undefined") {
    return Object.assign(document.createElement("canvas"), { width, height });
  }
  throw new Error("A conversão para WebP precisa ser executada em um navegador.");
}

function defaultBitmapFactory(blob) {
  if (typeof createImageBitmap !== "function") {
    throw new Error("A conversão para WebP precisa ser executada em um navegador.");
  }
  return createImageBitmap(blob);
}

function encodeCanvas(canvas, quality) {
  if (typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type: "image/webp", quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("O navegador não conseguiu gerar o WebP.")), "image/webp", quality);
  });
}

function buildScales(minScale = 0.08, decay = 0.82) {
  const scales = [];
  let scale = 1;
  while (scale >= minScale) {
    scales.push(Number(scale.toFixed(4)));
    scale *= decay;
  }
  if (scales[scales.length - 1] !== minScale) scales.push(minScale);
  return scales;
}

function buildQualities(minQuality = 0.18, decay = 0.85) {
  const qualities = [];
  let quality = 0.96;
  while (quality >= minQuality) {
    qualities.push(Number(quality.toFixed(3)));
    quality *= decay;
  }
  if (qualities[qualities.length - 1] !== minQuality) qualities.push(minQuality);
  return qualities;
}

function isBetterCandidate(candidate, current) {
  if (!current) return true;
  const candidateArea = candidate.width * candidate.height;
  const currentArea = current.width * current.height;
  if (candidateArea !== currentArea) return candidateArea > currentArea;
  return candidate.quality > current.quality;
}

/**
 * Converts a Figma PNG render to WebP while searching for the largest useful
 * image that stays at or below the configured byte ceiling.
 *
 * The factories are injectable so the compression policy can be tested without
 * a real browser canvas.
 */
export async function convertPngBlobToWebp(pngBlob, options = {}) {
  const maxBytes = options.maxBytes || MAX_WEBP_BYTES;
  const minQuality = options.minQuality || 0.18;
  const minScale = options.minScale || 0.08;
  const bitmap = await (options.bitmapFactory || defaultBitmapFactory)(pngBlob);
  let best = null;

  try {
    const scales = options.scales || buildScales(minScale, options.scaleDecay || 0.82);
    const qualities = options.qualities || buildQualities(minQuality, options.qualityDecay || 0.85);

    for (const scale of scales) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = (options.canvasFactory || defaultCanvasFactory)(width, height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("O navegador não criou o contexto 2D para o WebP.");

      context.clearRect?.(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of qualities) {
        const blob = await encodeCanvas(canvas, quality);
        if (!blob) continue;

        const candidate = { blob, width, height, quality, bytes: blob.size, scale };
        if (isBetterCandidate(candidate, best)) best = candidate;
        if (blob.size <= maxBytes) {
          return {
            ok: true,
            ...candidate,
            targetBytes: maxBytes,
            resized: scale !== 1
          };
        }
      }
    }
  } finally {
    bitmap.close?.();
  }

  if (!best) throw new Error("O navegador não conseguiu gerar uma imagem WebP.");

  return {
    ok: false,
    ...best,
    targetBytes: maxBytes,
    resized: best.scale !== 1,
    reason: `A melhor versão gerada ficou com ${best.bytes} bytes, acima do limite de ${maxBytes} bytes.`
  };
}

