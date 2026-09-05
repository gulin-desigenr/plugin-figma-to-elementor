import { figmaColorToRGBA } from "../utils/colors.js";
import {
  getSelectorDefinition,
  resolveItemSelector,
  resolveSelector
} from "./elementor-selectors.js";

const CSS_SAFE_PROPERTIES = new Set([
  "background",
  "background-image",
  "background-blend-mode",
  "mix-blend-mode",
  "filter",
  "backdrop-filter",
  "-webkit-backdrop-filter",
  "box-shadow",
  "border-image",
  "opacity",
  "color",
  "background-clip",
  "-webkit-background-clip"
]);

const BLEND_MODE_MAP = {
  PASS_THROUGH: "normal",
  NORMAL: "normal",
  DARKEN: "darken",
  MULTIPLY: "multiply",
  COLOR_BURN: "color-burn",
  LIGHTEN: "lighten",
  SCREEN: "screen",
  COLOR_DODGE: "color-dodge",
  OVERLAY: "overlay",
  SOFT_LIGHT: "soft-light",
  HARD_LIGHT: "hard-light",
  DIFFERENCE: "difference",
  EXCLUSION: "exclusion",
  HUE: "hue",
  SATURATION: "saturation",
  COLOR: "color",
  LUMINOSITY: "luminosity"
};

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function alphaColor(color, opacity) {
  if (!color || typeof color !== "object") return "rgba(0,0,0,0)";
  return figmaColorToRGBA(color, opacity === undefined ? color.a : opacity);
}

function percent(value) {
  return `${Math.round(Math.max(0, Math.min(1, finite(value, 0))) * 10000) / 100}%`;
}

function angleFromHandles(handles = []) {
  const start = handles[0];
  const end = handles[1];
  if (!start || !end) return 180;
  // CSS 0deg points north; Figma's y axis points down.
  const radians = Math.atan2(finite(end.x) - finite(start.x), finite(start.y) - finite(end.y));
  return Math.round(((radians * 180) / Math.PI + 360) % 360);
}

function gradientStops(paint) {
  return (paint.gradientStops || []).map(
    (stop) =>
      `${alphaColor(stop.color, stop.color?.a * finite(paint.opacity, 1))} ${percent(stop.position)}`
  );
}

function gradientToCss(paint) {
  const stops = gradientStops(paint);
  if (stops.length < 2) return null;
  if (paint.type === "GRADIENT_RADIAL") return `radial-gradient(circle, ${stops.join(", ")})`;
  if (paint.type === "GRADIENT_ANGULAR")
    return `conic-gradient(from ${angleFromHandles(paint.gradientHandlePositions)}deg, ${stops.join(", ")})`;
  if (paint.type === "GRADIENT_DIAMOND")
    return `radial-gradient(farthest-corner, ${stops.join(", ")})`;
  return `linear-gradient(${angleFromHandles(paint.gradientHandlePositions)}deg, ${stops.join(", ")})`;
}

function paintToCss(paint) {
  if (paint?.type === "SOLID") return alphaColor(paint.color, paint.opacity);
  return gradientToCss(paint);
}

function visiblePaints(node) {
  return Array.isArray(node?.fills)
    ? node.fills.filter((paint) => paint && paint.visible !== false)
    : [];
}

function visibleEffects(node) {
  return Array.isArray(node?.effects)
    ? node.effects.filter((effect) => effect && effect.visible !== false)
    : [];
}

function shadowToCss(effect) {
  const inset = effect.type === "INNER_SHADOW" ? "inset " : "";
  return `${inset}${finite(effect.offset?.x)}px ${finite(effect.offset?.y)}px ${finite(effect.radius)}px ${finite(effect.spread)}px ${alphaColor(effect.color)}`;
}

function nativeShadowPossible(effects) {
  const shadows = effects.filter((effect) => effect.type === "DROP_SHADOW");
  return effects.length === 1 && shadows.length === 1;
}

function declaration(property, value) {
  if (!CSS_SAFE_PROPERTIES.has(property) || value === null || value === undefined || value === "")
    return null;
  return `${property}: ${value};`;
}

export function extractAdvancedEffects(node, widgetType, cssId) {
  const definition = getSelectorDefinition(widgetType);
  const paints = visiblePaints(node);
  const effects = visibleEffects(node);
  const cssDeclarations = [];
  const flags = [];
  const blendMode = BLEND_MODE_MAP[node?.blendMode];
  const hasUnsupportedBlend = Boolean(node?.blendMode && !BLEND_MODE_MAP[node.blendMode]);
  const hasAdvancedEffect =
    effects.length > 1 ||
    effects.some((effect) => effect.type !== "DROP_SHADOW") ||
    (node?.opacity !== undefined && finite(node.opacity, 1) < 1) ||
    (blendMode && blendMode !== "normal") ||
    hasUnsupportedBlend;
  const native = {
    background: null,
    shadow: nativeShadowPossible(effects) && !hasAdvancedEffect
  };

  const solidPaints = paints.filter((paint) => paint.type === "SOLID");
  const gradientPaints = paints.map(gradientToCss).filter(Boolean);
  const cssPaints = paints.map(paintToCss).filter(Boolean);
  const unsupportedPaints = paints.filter(
    (paint) =>
      ![
        "SOLID",
        "GRADIENT_LINEAR",
        "GRADIENT_RADIAL",
        "GRADIENT_ANGULAR",
        "GRADIENT_DIAMOND"
      ].includes(paint.type)
  );

  if (paints.length === 1 && solidPaints.length === 1 && !hasAdvancedEffect) {
    native.background = "solid";
  } else if (cssPaints.length > 0) {
    cssDeclarations.push(declaration("background", cssPaints.join(", ")));
    if (solidPaints.length > 0 && gradientPaints.length > 0)
      cssDeclarations.push(declaration("background-blend-mode", "normal"));
  }
  if (unsupportedPaints.length > 0)
    flags.push(...unsupportedPaints.map((paint) => `paint:${paint.type}`));
  if (paints.some((paint) => paint.type === "GRADIENT_DIAMOND"))
    flags.push("approximation:gradient-diamond-to-radial");

  const shadows = effects.filter((effect) => ["DROP_SHADOW", "INNER_SHADOW"].includes(effect.type));
  if (shadows.length > 0 && !native.shadow)
    cssDeclarations.push(declaration("box-shadow", shadows.map(shadowToCss).join(", ")));
  if (effects.some((effect) => effect.type === "LAYER_BLUR")) {
    const blur = effects.find((effect) => effect.type === "LAYER_BLUR");
    cssDeclarations.push(declaration("filter", `blur(${finite(blur.radius)}px)`));
  }
  if (effects.some((effect) => effect.type === "BACKGROUND_BLUR")) {
    const blur = effects.find((effect) => effect.type === "BACKGROUND_BLUR");
    cssDeclarations.push(declaration("backdrop-filter", `blur(${finite(blur.radius)}px)`));
    cssDeclarations.push(declaration("-webkit-backdrop-filter", `blur(${finite(blur.radius)}px)`));
  }
  if (blendMode && blendMode !== "normal")
    cssDeclarations.push(declaration("mix-blend-mode", blendMode));
  if (hasUnsupportedBlend) flags.push(`blend-mode:${node.blendMode}`);
  const unsupportedEffects = effects.filter(
    (effect) =>
      !["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"].includes(effect.type)
  );
  if (unsupportedEffects.length > 0)
    flags.push(...unsupportedEffects.map((effect) => `effect:${effect.type}`));
  if (effects.filter((effect) => effect.type === "LAYER_BLUR").length > 1)
    flags.push("multiple-layer-blur:first-layer-applied");
  if (effects.filter((effect) => effect.type === "BACKGROUND_BLUR").length > 1)
    flags.push("multiple-background-blur:first-layer-applied");
  if (node?.opacity !== undefined && finite(node.opacity, 1) < 1)
    cssDeclarations.push(
      declaration("opacity", String(Math.max(0, Math.min(1, finite(node.opacity, 1)))))
    );

  const textGradient = gradientPaints.length > 0 && ["heading", "text-editor"].includes(widgetType);
  if (textGradient) {
    cssDeclarations.push(declaration("background-clip", "text"));
    cssDeclarations.push(declaration("-webkit-background-clip", "text"));
    cssDeclarations.push(declaration("color", "transparent"));
  }
  const targetSlot = textGradient ? (widgetType === "heading" ? "title" : "editor") : "root";
  const itemSelectors =
    definition?.itemTarget && cssId && Array.isArray(node?.children)
      ? node.children
          .map((_, index) => resolveItemSelector(widgetType, cssId, index + 1))
          .filter(Boolean)
      : [];
  const resolvedSelector = cssId ? resolveSelector(widgetType, cssId, targetSlot) : null;
  const customCss =
    cssDeclarations.length && cssId
      ? resolvedSelector
        ? `${resolvedSelector} {\n  ${cssDeclarations.filter(Boolean).join("\n  ")}\n}`
        : ""
      : "";
  if (cssDeclarations.length > 0 && !resolvedSelector)
    flags.push(cssId ? "invalid-css-id" : "missing-css-id");
  if (definition?.experimental) flags.push("experimental-selector-profile");
  if (shadows.some((effect) => effect.type === "INNER_SHADOW")) flags.push("inner-shadow-css");

  const cssCount = cssDeclarations.filter(Boolean).length;
  const strategy = customCss
    ? "custom_css"
    : native.background || native.shadow
      ? "native"
      : flags.length
        ? "flag"
        : "none";

  return {
    strategy,
    selectorProfile: definition?.profile || null,
    selector: resolvedSelector,
    itemSelectors,
    css: customCss,
    flags,
    native,
    counts: { paints: paints.length, effects: effects.length, cssDeclarations: cssCount },
    source: {
      paintTypes: paints.map((paint) => paint.type),
      effectTypes: effects.map((effect) => effect.type),
      blendMode: node?.blendMode || "NORMAL"
    }
  };
}

export function applyAdvancedEffects(settings, report) {
  if (!settings || !report) return settings;
  if (report.strategy === "none" && (!report.flags || report.flags.length === 0)) return settings;
  if (report.css) settings.custom_css = report.css;
  if (report.strategy === "custom_css") {
    delete settings._background_background;
    delete settings._background_color;
    delete settings.background_color;
    delete settings._box_shadow_box_shadow_type;
    delete settings._box_shadow_box_shadow;
    delete settings.image_box_shadow_type;
    delete settings.image_box_shadow;
  }
  settings.figmentor_effects = report;
  return settings;
}

export function summarizeEffects(content = []) {
  const summary = { total: 0, native: 0, customCss: 0, flags: 0, unsupported: 0 };
  const walk = (elements) =>
    (elements || []).forEach((element) => {
      const report = element?.settings?.figmentor_effects;
      if (report) {
        summary.total += 1;
        if (report.strategy === "native") summary.native += 1;
        if (report.strategy === "custom_css") summary.customCss += 1;
        if (report.flags?.length) summary.flags += report.flags.length;
        if (report.strategy === "flag") summary.unsupported += 1;
      }
      walk(element?.elements);
    });
  walk(content);
  return summary;
}
