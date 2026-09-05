import { DEFAULT_FIGMENTOR_NAMESPACE } from "./src/constants.js";
import {
  parseFigmaFileUrl,
  readCurrentSelection,
  readNode,
  readRegisteredSelection,
  renderNodeImage
} from "./src/figma-api.js";
import { buildAssetManifest, createAssetReport, selectAssetsForProcessing } from "./src/assets.js";
import { buildElementorDocument, patchElementorAssets } from "./src/elementor.js";
import { validateElementorDocument } from "./src/contract.js";
import { convertPngBlobToWebp } from "./src/webp.js";
import {
  extractWordPressContext,
  insertElementorDocument,
  probeWordPressTab,
  reloadAndVerifyElementorDocument,
  uploadMediaToWordPress,
  validateWordPressContext
} from "./src/wordpress.js";

const $ = (id) => document.getElementById(id);
let workflow = {
  selection: null,
  root: null,
  document: null,
  manifest: null,
  wordpress: null,
  report: null
};

function setStatus(message, isError = false, area = "figma") {
  const status = $(
    area === "token" ? "token-status" : area === "elementor" ? "elementor-status" : "figma-status"
  );
  status.textContent = message;
  status.classList.toggle("error", isError);
  status.classList.toggle("success", !isError);
}

function showScreen(screen) {
  for (const name of ["token", "figma", "elementor"]) {
    $(`screen-${name}`).classList.toggle("active", name === screen);
    $(`step-${name}`).classList.toggle("active", name === screen);
    $(`step-${name}`).classList.toggle(
      "complete",
      name !== screen &&
        (name === "token"
          ? Boolean($("token").value.trim())
          : name === "figma"
            ? Boolean(workflow.document)
            : false)
    );
  }
}

function setConnected(connected) {
  const state = $("connection-state");
  state.textContent = connected ? "Figma conectado" : "Não conectado";
  state.classList.toggle("connected", connected);
}

function updateElementorState() {
  const ready = Boolean(workflow.document && workflow.manifest && workflow.wordpress);
  $("insert-elementor").disabled = !ready;
  $("continue-elementor").disabled = !(workflow.document && workflow.manifest);
  $("retry-assets").disabled =
    !workflow.manifest?.assets?.some((asset) => asset.status === "failed") || !workflow.wordpress;
  if (workflow.selection) {
    $("elementor-source").textContent =
      `${workflow.selection.name || workflow.selection.nodeId}\n${workflow.manifest.assets.length} asset(s) encontrado(s)`;
  }
}

function updateDownloads() {
  const enabled = Boolean(workflow.document && workflow.manifest);
  $("download-json").disabled = !enabled;
  $("download-manifest").disabled = !enabled;
  $("download-report").disabled = !workflow.report;
}

function createFigmentorReport(manifest, document) {
  return {
    version: "0.3",
    generatedAt: new Date().toISOString(),
    assets: createAssetReport(manifest),
    effects: document?.figmentor?.effects || { summary: {}, items: [] }
  };
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function restoreState() {
  const saved = await chrome.storage.local.get(["figmaToken", "figmaUrl", "pluginId"]);
  if (saved.figmaToken) $("token").value = saved.figmaToken;
  if (saved.figmaUrl) $("figma-url").value = saved.figmaUrl;
  $("plugin-id").value = saved.pluginId || DEFAULT_FIGMENTOR_NAMESPACE;
  setConnected(Boolean(saved.figmaToken));

  const tabs = await chrome.tabs.query({});
  const figmaTab = tabs.find((tab) => tab.url && tab.url.includes("figma.com/"));
  if (figmaTab && !$("figma-url").value) $("figma-url").value = figmaTab.url;
  showScreen(saved.figmaToken ? "figma" : "token");
}

async function readFrame() {
  const token = $("token").value.trim();
  const pluginId = $("plugin-id").value.trim() || DEFAULT_FIGMENTOR_NAMESPACE;
  const figmaUrl = $("figma-url").value.trim();

  if (!token) {
    showScreen("token");
    setStatus("Insira o token pessoal do Figma antes de continuar.", true, "token");
    return;
  }
  if (!figmaUrl) {
    setStatus("Informe a URL do arquivo Figma ou use a seleção da aba Figma.", true, "figma");
    return;
  }

  setStatus("Consultando o arquivo Figma...");
  try {
    await chrome.storage.local.set({ figmaToken: token, figmaUrl, pluginId });
    const file = parseFigmaFileUrl(figmaUrl);
    let selection;
    if (file.nodeId) {
      selection = {
        fileKey: file.fileKey,
        nodeId: file.nodeId,
        name: "Seleção indicada pelo link do Figma",
        type: "URL_SELECTION",
        source: "FIGMA_LINK",
        dataNamespace: pluginId
      };
    } else {
      try {
        selection = await readCurrentSelection(token, file.fileKey);
      } catch (selectionError) {
        try {
          selection = await readRegisteredSelection(token, file.fileKey, pluginId);
          selection.source = "PLUGIN_DATA_FALLBACK";
        } catch (pluginError) {
          throw new Error(
            `${selectionError.message}\n\nFallback do plugin: ${pluginError.message}`
          );
        }
      }
    }
    const root = await readNode(token, file.fileKey, selection.nodeId);
    const resolvedSelection = {
      ...selection,
      name: root.name || selection.name,
      type: root.type || selection.type
    };
    const mode = $("export-mode").value;
    const document = await buildElementorDocument(root, mode, pluginId);
    const validation = validateElementorDocument(document, mode, { requireNativeMedia: false });
    if (!validation.valid) {
      throw new Error(
        `O JSON preparado não passou na validação do Elementor:\n${validation.errors.join("\n")}`
      );
    }
    const manifest = buildAssetManifest(root, pluginId, resolvedSelection);

    const report = createFigmentorReport(manifest, document);
    workflow = { ...workflow, selection: resolvedSelection, root, document, manifest, report };
    $("json-output").value = JSON.stringify(document, null, 2);
    $("summary").classList.add("visible");
    $("summary").textContent = [
      `Frame: ${resolvedSelection.name || resolvedSelection.nodeId}`,
      `Node ID: ${resolvedSelection.nodeId}`,
      `Tipo: ${resolvedSelection.type || "não informado"}`,
      `Fonte: ${resolvedSelection.source === "REST_SELECTION" ? "seleção atual pela API" : resolvedSelection.source === "PLUGIN_DATA_FALLBACK" ? "registro do plugin" : "link do Figma"}`,
      `Assets encontrados: ${manifest.assets.length}`,
      `Efeitos: ${report.effects.summary.total || 0} mapeado(s), ${report.effects.summary.customCss || 0} em CSS, ${report.effects.summary.flags || 0} flag(s).`,
      "JSON estrutural preparado."
    ].join("\n");
    updateDownloads();
    updateElementorState();
    setStatus("Frame lido com sucesso. Revise o JSON ou avance para o Elementor.", false, "figma");
    showScreen("figma");
  } catch (error) {
    workflow = { ...workflow, selection: null, root: null, document: null, manifest: null };
    updateDownloads();
    updateElementorState();
    setStatus(error.message, true);
  }
}

async function useActiveFigmaSelection() {
  setStatus("Identificando o arquivo Figma ativo...");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || !tab.url.includes("figma.com/")) {
    setStatus("A aba ativa não parece ser um arquivo Figma.", true);
    return;
  }

  try {
    const parsed = parseFigmaFileUrl(tab.url);
    $("figma-url").value = tab.url;

    setStatus(
      parsed.nodeId
        ? `Node ID encontrado no link: ${parsed.nodeId}`
        : "Consultando a seleção atual pela API do Figma..."
    );
    await readFrame();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function detectWordPress() {
  setStatus("Verificando a aba ativa como WordPress/Elementor...", false, "elementor");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url || !/^https:\/\//.test(tab.url)) {
    setStatus("A aba ativa não é uma página HTTPS disponível para o WordPress.", true, "elementor");
    return;
  }

  try {
    const origin = new URL(tab.url).origin;
    const permission = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!permission) {
      setStatus("O acesso temporário a este site foi recusado.", true);
      return;
    }

    const context = extractWordPressContext(await probeWordPressTab(tab.id));
    validateWordPressContext(context);
    workflow.wordpress = { tabId: tab.id, ...context };
    updateElementorState();
    setStatus(
      [
        `WordPress detectado: ${context.title || context.href}`,
        `Elementor detectado: ${context.isElementor ? "sim" : "não confirmado"}`,
        "Sessão e nonce encontrados."
      ].join("\n"),
      false,
      "elementor"
    );
  } catch (error) {
    workflow.wordpress = null;
    updateElementorState();
    setStatus(error.message, true, "elementor");
  }
}

function formatAssetReport(report) {
  return (report?.assets || report || []).map((item) => {
    const prefix = item.status === "uploaded" ? "✓" : item.status === "failed" ? "✕" : "•";
    const details =
      item.status === "failed"
        ? ` — ${item.reason || "falha sem detalhe"}. ${item.action || ""}`
        : item.mediaId
          ? ` — mídia ${item.mediaId}`
          : "";
    return `${prefix} ${item.name} [${item.nodeId}] (${item.elementorElement})${details}`;
  });
}

async function processAssets(manifest, token, onlyFailed = false) {
  const candidates = selectAssetsForProcessing(manifest, onlyFailed);

  for (const asset of candidates) {
    try {
      asset.status = "processing";
      delete asset.error;
      setStatus(`Preparando ${asset.elementName || asset.figmaNodeId}...`, false, "elementor");
      const isSvg = asset.targetFormat === "SVG";
      const rendered = await renderNodeImage(
        token,
        manifest.source.fileKey,
        asset.figmaNodeId,
        isSvg ? "svg" : "png"
      );
      let uploadBlob = rendered.blob;
      const mimeType = isSvg ? "image/svg+xml" : "image/webp";

      if (!isSvg) {
        const converted = await convertPngBlobToWebp(rendered.blob);
        asset.sourceBytes = rendered.blob.size;
        asset.targetBytes = converted.bytes;
        asset.width = converted.width;
        asset.height = converted.height;
        asset.aspectRatio =
          converted.height > 0
            ? Number((converted.width / converted.height).toFixed(4))
            : asset.aspectRatio;
        if (!converted.ok) throw new Error(converted.reason);
        uploadBlob = converted.blob;
      } else {
        asset.sourceBytes = rendered.blob.size;
        asset.targetBytes = rendered.blob.size;
      }

      const uploaded = await uploadMediaToWordPress(
        workflow.wordpress.tabId,
        workflow.wordpress,
        uploadBlob,
        asset.fileName,
        mimeType
      );
      asset.mediaId = uploaded?.id || null;
      asset.mediaUrl = uploaded?.source_url || uploaded?.guid?.rendered || null;
      if (!asset.mediaId || !asset.mediaUrl)
        throw new Error("O WordPress não retornou o ID ou a URL da mídia.");
      asset.status = "uploaded";
    } catch (error) {
      asset.status = "failed";
      asset.error = error.message;
    }
  }
  return manifest;
}

async function insertIntoElementor(onlyFailed = false) {
  if (!workflow.document || !workflow.manifest || !workflow.wordpress) {
    setStatus("Prepare o JSON e detecte a aba WordPress antes de inserir.", true, "elementor");
    return;
  }

  const token = $("token").value.trim();
  const manifest = {
    ...workflow.manifest,
    assets: workflow.manifest.assets.map((asset) => ({ ...asset }))
  };
  if (onlyFailed && !workflow.manifest.assets.some((asset) => asset.status === "failed")) {
    setStatus("Não há assets falhos para repetir.", false, "elementor");
    return;
  }
  const destination = workflow.wordpress.title || workflow.wordpress.href;
  const modeLabel =
    $("elementor-mode").value === "section"
      ? "adicionar a seção ao final"
      : "substituir o conteúdo da página";
  if (
    !window.confirm(
      `Confirmar envio para ${destination}?\n\nA extensão irá ${modeLabel}, salvar como rascunho e recarregar a aba para verificar a persistência.`
    )
  )
    return;

  $("insert-elementor").disabled = true;
  $("retry-assets").disabled = true;

  try {
    await processAssets(manifest, token, onlyFailed);

    const patchedDocument = patchElementorAssets(workflow.document, manifest);
    const mode = $("elementor-mode").value;
    const validation = validateElementorDocument(
      patchedDocument,
      patchedDocument.type === "page" ? "page" : "section"
    );
    if (!validation.valid) {
      throw new Error(
        `O JSON final não passou na validação do Elementor:\n${validation.errors.join("\n")}`
      );
    }
    const result = await insertElementorDocument(
      workflow.wordpress.tabId,
      workflow.wordpress,
      patchedDocument,
      mode
    );
    setStatus(
      "Servidor confirmou o rascunho. Recarregando a aba para verificar persistência...",
      false,
      "elementor"
    );
    const reloadResult = await reloadAndVerifyElementorDocument(
      workflow.wordpress.tabId,
      workflow.wordpress,
      result.expectedElements
    );

    const report = createFigmentorReport(manifest, patchedDocument);
    workflow = {
      ...workflow,
      document: patchedDocument,
      manifest,
      report,
      wordpress: { ...workflow.wordpress, ...reloadResult.context }
    };
    $("json-output").value = JSON.stringify(patchedDocument, null, 2);
    $("upload-report").classList.add("visible");
    $("upload-report").textContent = [
      `Assets enviados: ${manifest.assets.filter((asset) => asset.status === "uploaded").length}/${manifest.assets.length}`,
      `Efeitos: ${report.effects.summary.total || 0} mapeado(s), ${report.effects.summary.customCss || 0} em CSS, ${report.effects.summary.flags || 0} flag(s).`,
      ...formatAssetReport(report.assets),
      `Elementor salvo como rascunho (${result.elementCount} elemento(s)).`,
      `Persistência confirmada após recarregar (${reloadResult.verification.elementCount} IDs verificados).`
    ].join("\n");
    await chrome.storage.local.set({
      lastFigmentorResult: {
        savedAt: new Date().toISOString(),
        source: workflow.selection,
        report
      }
    });
    updateDownloads();
    updateElementorState();
    setStatus(
      "Fluxo completo confirmado: assets, rascunho e persistência após reload.",
      false,
      "elementor"
    );
  } catch (error) {
    const report = createFigmentorReport(manifest, workflow.document);
    workflow = { ...workflow, manifest, report };
    $("upload-report").classList.add("visible");
    $("upload-report").textContent = report.assets.length
      ? formatAssetReport(report.assets).join("\n")
      : `Nenhum asset foi processado. Efeitos: ${report.effects.summary.total || 0} mapeado(s).`;
    updateDownloads();
    updateElementorState();
    setStatus(error.message, true, "elementor");
  } finally {
    $("insert-elementor").disabled = false;
    updateElementorState();
  }
}

$("continue-token").addEventListener("click", async () => {
  const token = $("token").value.trim();
  if (!token) {
    setStatus("Cole o token pessoal do Figma para continuar.", true, "token");
    return;
  }
  await chrome.storage.local.set({ figmaToken: token });
  setConnected(true);
  setStatus("Token salvo. Agora escolha o frame e prepare o JSON.", false, "token");
  showScreen("figma");
});

$("clear-token").addEventListener("click", async () => {
  await chrome.storage.local.remove("figmaToken");
  $("token").value = "";
  setConnected(false);
  workflow.wordpress = null;
  showScreen("token");
  setStatus("Token apagado. Insira um novo token para continuar.", false, "token");
});

$("back-to-token").addEventListener("click", () => showScreen("token"));
$("continue-elementor").addEventListener("click", () => {
  $("elementor-mode").value = $("export-mode").value;
  updateElementorState();
  showScreen("elementor");
});
$("back-to-figma").addEventListener("click", () => showScreen("figma"));

$("read-frame").addEventListener("click", readFrame);
$("use-figma-selection").addEventListener("click", useActiveFigmaSelection);
$("detect-wordpress").addEventListener("click", detectWordPress);
$("insert-elementor").addEventListener("click", () => insertIntoElementor(false));
$("retry-assets").addEventListener("click", () => insertIntoElementor(true));
$("download-json").addEventListener("click", () =>
  downloadJson("elementor-template.json", workflow.document)
);
$("download-manifest").addEventListener("click", () =>
  downloadJson("figmentor-assets-manifest.json", workflow.manifest)
);
$("download-report").addEventListener("click", () =>
  downloadJson("figmentor-report.json", workflow.report)
);

restoreState().catch((error) => setStatus(error.message, true, "token"));
