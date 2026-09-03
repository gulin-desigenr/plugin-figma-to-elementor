import { applyChildFillSizing, handleManualTag, mapText, mapImage, mapContainer } from './handlers.js';
import { hasImageFill } from '../utils/nodes.js';

export async function traverseNode(node, isRoot, maps = { colorMap: {}, typoMap: {} }, isInsideValidated = false) {
  if (!node || node.visible === false) return null;

  const manualTag = node.getPluginData?.("elementor-tag") || null;

  if (manualTag === 'ignore') {
    return null;
  }

  // Interrupção Segura: se não possui tag e é órfão (não está em container validado)
  if (!manualTag && !isInsideValidated) {
    if (!isRoot) {
      return null;
    }
  }

  const passValidated = manualTag ? true : isInsideValidated;

  if (manualTag) return await handleManualTag(node, manualTag, isRoot, maps);
  if (node.type === "TEXT") return await mapText(node, maps);
  if (hasImageFill(node)) return mapImage(node);

  if ("children" in node) {
    let childrenJSON = [];
    for (const child of node.children) {
      const data = applyChildFillSizing(child, await traverseNode(child, false, maps, passValidated));
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
