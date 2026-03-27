import { handleManualTag, mapText, mapImage, mapContainer } from './handlers.js';
import { hasImageFill } from '../utils/nodes.js';

export async function traverseNode(node, isRoot, maps = { colorMap: {}, typoMap: {} }) {
  if (!node || typeof node.visible === 'undefined' || !node.visible) return null;

  const manualTag = node.getPluginData("elementor-tag");

  if (manualTag === 'image-background' || manualTag === 'ignore') {
    return null;
  }

  if (manualTag) return await handleManualTag(node, manualTag, isRoot, maps);
  if (node.type === "TEXT") return await mapText(node, maps);
  if (hasImageFill(node)) return mapImage(node);

  if ("children" in node) {
    let childrenJSON = [];
    for (const child of node.children) {
      const data = await traverseNode(child, false, maps);
      if (data) {
        if (Array.isArray(data)) childrenJSON = childrenJSON.concat(data);
        else childrenJSON.push(data);
      }
    }
    childrenJSON = childrenJSON.filter(item => item && typeof item === 'object' && item.elType);
    if (!isRoot && node.layoutMode === "NONE") return childrenJSON;
    return await mapContainer(node, childrenJSON, isRoot, false, maps);
  }
  return null;
}
