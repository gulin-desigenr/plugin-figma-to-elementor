import { traverseNode } from './core/traverse.js';

figma.showUI(__html__, { width: 400, height: 620 });

figma.ui.onmessage = (msg) => {
  try {
    if (msg.type === 'apply-tag') {
      const selection = figma.currentPage.selection;
      if (selection.length > 0) {
        selection.forEach(node => {
          node.setPluginData("elementor-tag", "");
          node.setPluginData("elementor-tag", msg.tag);

          let newName = node.name.replace(/\[.*?\]\s*/g, '');
          node.name = `[${msg.tag.toUpperCase()}] ${newName}`;
        });
        figma.notify("Tag Aplicada: " + msg.tag.toUpperCase());
      } else {
        figma.notify("Selecione algo primeiro.");
      }
    }

    if (msg.type === "export-json") {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) { figma.notify("Selecione o Frame Principal."); return; }

      let structure = traverseNode(selection[0], true);
      let content = Array.isArray(structure) ? structure : [structure];

      const elementorJSON = {
        version: "0.4",
        title: "Export V17 Icon Box Fix - " + selection[0].name,
        type: "container",
        content: content
      };

      figma.ui.postMessage({ type: "json-generated", data: JSON.stringify(elementorJSON, null, 2) });
      figma.notify("JSON Gerado: Larguras Fiéis ao Figma!");
    }
  } catch (e) {
    figma.notify("Erro: " + e.message);
    console.error(e);
  }
};
