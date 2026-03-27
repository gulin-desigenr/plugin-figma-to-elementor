import { handleManualTag, mapText, mapImage, mapContainer } from './handlers.js';
import { hasImageFill } from '../utils/nodes.js';

export function traverseNode(node, isRoot) {
  if (!node || typeof node.visible === 'undefined' || !node.visible) return null;

  const manualTag = node.getPluginData("elementor-tag");

  if (manualTag === 'image-background' || manualTag === 'ignore') {
    return null;
  }

  if (manualTag) return handleManualTag(node, manualTag, isRoot);
  if (node.type === "TEXT") return mapText(node);
  if (hasImageFill(node)) return mapImage(node);

  if ("children" in node) {
    let childrenJSON = [];
    for (const child of node.children) {
      const data = traverseNode(child, false);
      if (data) {
        if (Array.isArray(data)) childrenJSON = childrenJSON.concat(data);
        else childrenJSON.push(data);
      }
    }
    childrenJSON = childrenJSON.filter(item => item && typeof item === 'object' && item.elType);
    if (!isRoot && node.layoutMode === "NONE") return childrenJSON;
    return mapContainer(node, childrenJSON, isRoot, false);
  }
  return null;
}
