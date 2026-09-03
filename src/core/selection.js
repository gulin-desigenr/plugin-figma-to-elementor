export const FIGMENTOR_SELECTION_KEY = "figmentor-selected-root";
export const FIGMENTOR_SHARED_NAMESPACE = "figmentor";
export const FIGMENTOR_SELECTION_VERSION = 1;

const ROOT_NODE_TYPES = new Set([
  "FRAME",
  "COMPONENT",
  "COMPONENT_SET",
  "INSTANCE",
  "SECTION",
  "GROUP"
]);

export function isSupportedRootNode(node) {
  return Boolean(node) && ROOT_NODE_TYPES.has(node.type);
}

export function createSelectionRecord(node, registeredAt = new Date().toISOString()) {
  return {
    version: FIGMENTOR_SELECTION_VERSION,
    nodeId: node.id,
    name: node.name || "",
    type: node.type,
    registeredAt
  };
}

export function serializeSelectionRecord(node, registeredAt) {
  return JSON.stringify(createSelectionRecord(node, registeredAt));
}
