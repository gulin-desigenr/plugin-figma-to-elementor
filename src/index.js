import { traverseNode } from "./core/traverse.js";
import { annotateExportContent, validateExportDocument } from "./core/contract.js";
import {
  FIGMENTOR_SELECTION_KEY,
  FIGMENTOR_SHARED_NAMESPACE,
  isSupportedRootNode,
  serializeSelectionRecord
} from "./core/selection.js";
import { ELEMENTOR_SELECTOR_PROFILE } from "./styles/elementor-selectors.js";
import { summarizeEffects } from "./styles/effects.js";

const EXPORT_MODES = new Set(["section", "page"]);

function sendExportError(message) {
  figma.notify(`Exportação interrompida: ${message}`, { error: true });
  figma.ui.postMessage({ type: "export-error", message });
}

function persistSelectedRoot(rootNode, registeredAt = new Date().toISOString()) {
  const serialized = serializeSelectionRecord(rootNode, registeredAt);

  figma.root.setPluginData(FIGMENTOR_SELECTION_KEY, serialized);
  figma.root.setSharedPluginData(FIGMENTOR_SHARED_NAMESPACE, FIGMENTOR_SELECTION_KEY, serialized);

  return {
    nodeId: rootNode.id,
    name: rootNode.name || "",
    type: rootNode.type,
    registeredAt,
    pluginId: figma.pluginId || "figma-to-elementor-test",
    dataNamespace: FIGMENTOR_SHARED_NAMESPACE
  };
}

function syncCurrentSelection(notify = false) {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1 || !isSupportedRootNode(selection[0])) return null;

  const frame = persistSelectedRoot(selection[0]);
  figma.ui.postMessage({ type: "frame-selection-synced", data: frame });
  if (notify) figma.notify(`Frame sincronizado: ${frame.name || frame.nodeId}`);
  return frame;
}

try {
  figma.showUI(__html__, { width: 400, height: 620 });
  figma.on("selectionchange", () => syncCurrentSelection(false));
  syncCurrentSelection(false);

  figma.ui.onmessage = (msg) => {
    try {
      if (msg.type === "apply-tag") {
        const selection = figma.currentPage.selection;
        if (selection.length > 0) {
          selection.forEach((node) => {
            node.setPluginData("elementor-tag", "");
            node.setPluginData("elementor-tag", msg.tag);
            node.setSharedPluginData(FIGMENTOR_SHARED_NAMESPACE, "elementor-tag", msg.tag);

            const newName = node.name.replace(/\[.*?\]\s*/g, "");
            node.name = `[${msg.tag.toUpperCase()}] ${newName}`;
          });
          figma.notify("Tag Aplicada: " + msg.tag.toUpperCase());
        } else {
          figma.notify("Selecione algo primeiro.");
        }
      }

      if (msg.type === "apply-role") {
        const selection = figma.currentPage.selection;
        if (selection.length > 0) {
          selection.forEach((node) => {
            node.setPluginData("elementor_role", msg.role);
            node.setSharedPluginData(FIGMENTOR_SHARED_NAMESPACE, "elementor_role", msg.role);

            const newName = node.name.replace(/\[(?:title|description|icon|image)\]\s*/gi, "");

            let roleLabel = msg.role;
            if (msg.role === "title_text") roleLabel = "title";
            if (msg.role === "description_text") roleLabel = "description";

            node.name = `[${roleLabel}] ${newName}`;
          });
          figma.notify("Sub-Tag Aplicada: " + msg.role);
        } else {
          figma.notify("Selecione um elemento interno primeiro.");
        }
      }

      if (msg.type === "register-frame") {
        const selection = figma.currentPage.selection;

        if (selection.length !== 1) {
          figma.ui.postMessage({
            type: "frame-registration-error",
            message: "Selecione exatamente um frame para registrar."
          });
          figma.notify("Selecione exatamente um frame para registrar.", { error: true });
          return;
        }

        const rootNode = selection[0];
        if (!isSupportedRootNode(rootNode)) {
          figma.ui.postMessage({
            type: "frame-registration-error",
            message: "O elemento selecionado precisa ser um frame, grupo, seção ou componente."
          });
          figma.notify("Selecione um frame, grupo, seção ou componente.", { error: true });
          return;
        }

        const frame = persistSelectedRoot(rootNode);

        figma.ui.postMessage({
          type: "frame-registered",
          data: frame
        });
        figma.notify(`Frame registrado: ${rootNode.name || rootNode.id}`);
        return;
      }

      if (msg.type === "export-json") {
        const selection = figma.currentPage.selection;
        const exportMode = msg.exportMode;

        if (!EXPORT_MODES.has(exportMode)) {
          sendExportError("Escolha se você está criando uma seção ou uma página.");
          return;
        }
        if (selection.length === 0) {
          sendExportError("Selecione o frame principal.");
          return;
        }
        if (selection.length > 1) {
          sendExportError("Selecione apenas um frame raiz.");
          return;
        }

        const rootTag = selection[0].getPluginData("elementor-tag");
        if (exportMode === "section" && rootTag !== "container") {
          sendExportError("No modo Seção, o frame principal precisa da tag Seção (1140px Boxed).");
          return;
        }
        if (exportMode === "page" && rootTag !== "page-wrapper") {
          sendExportError("No modo Página, o frame principal precisa da tag Página (Wrapper).");
          return;
        }

        figma.notify("⏳ Calculando árvore...");

        (async () => {
          try {
            const { colorMap, typoMap } = msg;
            const structure = await traverseNode(selection[0], true, { colorMap, typoMap });
            let content = Array.isArray(structure) ? structure : [structure];

            function sanitizeOutput(nodes, effectItems) {
              if (!nodes || !Array.isArray(nodes)) return;
              nodes.forEach((node) => {
                if (node && node.settings) {
                  if (node.settings.figmentor_effects) {
                    effectItems.push({
                      elementId: node.id || null,
                      widgetType: node.elType === "widget" ? node.widgetType : "container",
                      cssId: node.settings.css_id || null,
                      ...node.settings.figmentor_effects
                    });
                    delete node.settings.figmentor_effects;
                  }
                  delete node.settings._position;
                  delete node.settings.position;
                  delete node.settings.margin;
                  delete node.settings._margin;
                  delete node.settings._offset_x;
                  delete node.settings._offset_y;
                  delete node.settings._z_index;
                  delete node.settings.offset_x;
                  delete node.settings.offset_y;
                }
                if (node && node.elements) {
                  sanitizeOutput(node.elements, effectItems);
                }
              });
            }

            content = annotateExportContent(content);
            const effectItems = [];
            const effectsSummary = summarizeEffects(content);
            sanitizeOutput(content, effectItems);

            const elementorJSON = {
              version: "0.4",
              title: `${exportMode === "page" ? "Page" : "Container"} Export - ${selection[0].name}`,
              type: exportMode === "page" ? "page" : "container",
              ...(exportMode === "page" ? { page_settings: {} } : {}),
              content: content,
              figmentor: {
                version: "0.3",
                selectorProfile: ELEMENTOR_SELECTOR_PROFILE,
                customCssControl: "custom_css",
                effects: { summary: effectsSummary, items: effectItems },
                elements: {}
              }
            };

            const validation = validateExportDocument(elementorJSON, exportMode);
            if (!validation.valid) {
              sendExportError(validation.errors.join(" "));
              return;
            }

            figma.ui.postMessage({
              type: "json-generated",
              data: JSON.stringify(elementorJSON, null, 2)
            });
            figma.notify("✅ JSON Gerado com Sucesso!");
          } catch (err) {
            sendExportError(err.message);
            console.error(err);
          }
        })();
      }
    } catch (e) {
      figma.notify("Erro Msg: " + e.message);
      console.error(e);
    }
  };
} catch (globalError) {
  console.error(globalError);
  figma.notify("Erro Fatal: " + globalError.message, { error: true });
}
