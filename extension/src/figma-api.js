import {
  DEFAULT_FIGMENTOR_NAMESPACE,
  FIGMA_API_BASE,
  FIGMENTOR_SELECTION_KEY
} from "./constants.js";

export function parseFigmaFileUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Informe o endereço do arquivo Figma.");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("O endereço informado não é uma URL válida.");
  }

  if (!url.hostname.endsWith("figma.com")) {
    throw new Error("O endereço precisa ser de um arquivo Figma.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const fileIndex = segments.findIndex(segment => ["design", "file", "proto"].includes(segment));
  const fileKey = fileIndex >= 0 ? segments[fileIndex + 1] : null;

  if (!fileKey) {
    throw new Error("Não foi possível identificar o file key do Figma.");
  }

  const rawNodeId = url.searchParams.get("node-id");
  const nodeId = rawNodeId
    ? rawNodeId.replace(/^(.+)-(\d+)$/, "$1:$2")
    : null;

  return {
    fileKey,
    nodeId,
    url: url.toString()
  };
}

async function figmaRequest(token, path) {
  if (!token || typeof token !== "string") {
    throw new Error("Informe o token pessoal do Figma.");
  }

  const response = await fetch(`${FIGMA_API_BASE}${path}`, {
    headers: {
      "X-Figma-Token": token
    }
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body.err || body.message || "";
    } catch {
      detail = "";
    }

    if (response.status === 401) {
      throw new Error("O token do Figma é inválido ou expirou.");
    }

    if (response.status === 403) {
      if (/scope|permission|permiss/i.test(detail)) {
        throw new Error("O token não tem a permissão necessária. Gere um novo token com file_content:read e selections:read.");
      }
      throw new Error("O token do Figma não tem acesso a este arquivo ou a esta operação.");
    }

    throw new Error(`A API do Figma respondeu ${response.status}${detail ? `: ${detail}` : "."}`);
  }

  return response.json();
}

function getSelectionField(value, keys) {
  if (!value || typeof value !== "object") return null;
  for (const key of keys) {
    if (typeof value[key] === "string" && value[key]) return value[key];
  }
  return null;
}

function selectionCandidates(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const candidates = [];
  for (const value of [
    payload.selections,
    payload.selection,
    payload.data?.selections,
    payload.data?.selection,
    payload.items,
    payload.data?.items
  ]) {
    if (Array.isArray(value)) candidates.push(...value);
    else if (value && typeof value === "object") candidates.push(value);
  }

  if (candidates.length === 0) candidates.push(payload);
  return candidates;
}

function normalizeCurrentSelection(candidate, expectedFileKey) {
  if (!candidate || typeof candidate !== "object") return null;

  const fileKey = getSelectionField(candidate, ["fileKey", "file_key"])
    || getSelectionField(candidate.file, ["key", "fileKey", "file_key"])
    || getSelectionField(candidate.file?.document, ["key", "fileKey", "file_key"]);
  const nodeId = getSelectionField(candidate, ["nodeId", "node_id"])
    || getSelectionField(candidate.node, ["id", "nodeId", "node_id"]);

  if (!nodeId) return null;

  return {
    fileKey: fileKey || expectedFileKey,
    nodeId,
    name: candidate.name || candidate.node?.name || "Seleção atual do Figma",
    type: candidate.type || candidate.node?.type || "REST_SELECTION",
    source: "REST_SELECTION"
  };
}

/**
 * Reads the most recent Figma selection exposed by the REST API.
 * The token must include the `selections:read` scope.
 */
export async function readCurrentSelection(token, fileKey) {
  const response = await figmaRequest(token, "/selections");
  const candidates = selectionCandidates(response)
    .map(candidate => normalizeCurrentSelection(candidate, fileKey))
    .filter(Boolean);

  const selection = candidates.find(candidate => !candidate.fileKey || candidate.fileKey === fileKey);
  if (!selection) {
    if (candidates.length > 0) {
      throw new Error("A seleção atual pertence a outro arquivo Figma. Selecione um frame neste arquivo e tente novamente.");
    }
    throw new Error("A API do Figma não retornou um frame selecionado. Selecione um frame no Figma e tente novamente.");
  }

  return selection;
}

function findSelectionValue(value, pluginId) {
  if (!value || typeof value !== "object") return null;

  if (typeof value[FIGMENTOR_SELECTION_KEY] === "string") {
    return value[FIGMENTOR_SELECTION_KEY];
  }

  if (pluginId && value[pluginId]) {
    const nested = findSelectionValue(value[pluginId], null);
    if (nested) return nested;
  }

  for (const child of Object.values(value)) {
    const nested = findSelectionValue(child, null);
    if (nested) return nested;
  }

  return null;
}

function parseSelectionRecord(raw) {
  if (!raw) return null;

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed.nodeId !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function readRegisteredSelection(
  token,
  fileKey,
  dataNamespace = DEFAULT_FIGMENTOR_NAMESPACE
) {
  const document = await figmaRequest(
    token,
    `/files/${encodeURIComponent(fileKey)}?depth=1&plugin_data=shared`
  );

  const rawSelection = findSelectionValue(document, dataNamespace);
  const selection = parseSelectionRecord(rawSelection);

  if (!selection) {
    throw new Error("Nenhum frame registrado foi encontrado neste arquivo Figma.");
  }

  return {
    fileKey,
    dataNamespace,
    ...selection
  };
}

export async function readNode(
  token,
  fileKey,
  nodeId,
  dataNamespace = DEFAULT_FIGMENTOR_NAMESPACE
) {
  if (!nodeId) throw new Error("O nodeId do frame registrado não está disponível.");

  const query = new URLSearchParams({
    ids: nodeId,
    geometry: "paths",
    plugin_data: "shared"
  });
  const response = await figmaRequest(
    token,
    `/files/${encodeURIComponent(fileKey)}/nodes?${query.toString()}`
  );
  const node = response.nodes?.[nodeId]?.document || response.nodes?.[nodeId];

  if (!node) {
    throw new Error("O frame selecionado não foi encontrado no arquivo Figma.");
  }

  Object.defineProperty(node, "__figmentorStyles", {
    configurable: true,
    enumerable: false,
    value: response.styles || {}
  });

  return node;
}

export async function renderNodeImage(token, fileKey, nodeId, format = "png") {
  if (!nodeId) throw new Error("O nodeId do asset não está disponível.");

  const query = new URLSearchParams({
    ids: nodeId,
    format
  });
  const response = await figmaRequest(
    token,
    `/images/${encodeURIComponent(fileKey)}?${query.toString()}`
  );
  const url = response.images?.[nodeId];

  if (!url) {
    throw new Error(`A API do Figma não conseguiu renderizar o asset ${nodeId}.`);
  }

  const imageResponse = await fetch(url);
  if (!imageResponse.ok) {
    throw new Error(`Não foi possível baixar o render do asset ${nodeId}.`);
  }

  return {
    blob: await imageResponse.blob(),
    url,
    format
  };
}
