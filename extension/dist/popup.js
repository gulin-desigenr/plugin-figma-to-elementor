// extension/src/constants.js
var DEFAULT_FIGMENTOR_NAMESPACE = "figmentor";
var FIGMA_API_BASE = "https://api.figma.com/v1";
var FIGMENTOR_SELECTION_KEY = "figmentor-selected-root";
var MAX_WEBP_BYTES = 150 * 1024;
var ASSET_TAGS = /* @__PURE__ */ new Set([
  "image",
  "image-box",
  "image-background",
  "background-image",
  "image-carousel"
]);
var FIGMENTOR_TAGS = /* @__PURE__ */ new Set([
  "page-wrapper",
  "container",
  "container-full",
  "heading",
  "text-editor",
  "image",
  "image-box",
  "image-background",
  "background-image",
  "icon-box",
  "icon-list",
  "button",
  "accordion",
  "accordeon",
  "image-carousel",
  "container-carousel",
  "ignore"
]);
var VECTOR_TYPES = /* @__PURE__ */ new Set(["VECTOR", "BOOLEAN_OPERATION"]);

// extension/src/figma-api.js
function parseFigmaFileUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Informe o endere\xE7o do arquivo Figma.");
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("O endere\xE7o informado n\xE3o \xE9 uma URL v\xE1lida.");
  }
  if (!url.hostname.endsWith("figma.com")) {
    throw new Error("O endere\xE7o precisa ser de um arquivo Figma.");
  }
  const segments = url.pathname.split("/").filter(Boolean);
  const fileIndex = segments.findIndex((segment) => ["design", "file", "proto"].includes(segment));
  const fileKey = fileIndex >= 0 ? segments[fileIndex + 1] : null;
  if (!fileKey) {
    throw new Error("N\xE3o foi poss\xEDvel identificar o file key do Figma.");
  }
  const rawNodeId = url.searchParams.get("node-id");
  const nodeId = rawNodeId ? rawNodeId.replace(/^(.+)-(\d+)$/, "$1:$2") : null;
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
      throw new Error("O token do Figma \xE9 inv\xE1lido ou expirou.");
    }
    if (response.status === 403) {
      if (/scope|permission|permiss/i.test(detail)) {
        throw new Error(
          "O token n\xE3o tem a permiss\xE3o necess\xE1ria. Gere um novo token com file_content:read e selections:read."
        );
      }
      throw new Error("O token do Figma n\xE3o tem acesso a este arquivo ou a esta opera\xE7\xE3o.");
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
  const fileKey = getSelectionField(candidate, ["fileKey", "file_key"]) || getSelectionField(candidate.file, ["key", "fileKey", "file_key"]) || getSelectionField(candidate.file?.document, ["key", "fileKey", "file_key"]);
  const nodeId = getSelectionField(candidate, ["nodeId", "node_id"]) || getSelectionField(candidate.node, ["id", "nodeId", "node_id"]);
  if (!nodeId) return null;
  return {
    fileKey: fileKey || expectedFileKey,
    nodeId,
    name: candidate.name || candidate.node?.name || "Sele\xE7\xE3o atual do Figma",
    type: candidate.type || candidate.node?.type || "REST_SELECTION",
    source: "REST_SELECTION"
  };
}
async function readCurrentSelection(token, fileKey) {
  const response = await figmaRequest(token, "/selections");
  const candidates = selectionCandidates(response).map((candidate) => normalizeCurrentSelection(candidate, fileKey)).filter(Boolean);
  const selection = candidates.find(
    (candidate) => !candidate.fileKey || candidate.fileKey === fileKey
  );
  if (!selection) {
    if (candidates.length > 0) {
      throw new Error(
        "A sele\xE7\xE3o atual pertence a outro arquivo Figma. Selecione um frame neste arquivo e tente novamente."
      );
    }
    throw new Error(
      "A API do Figma n\xE3o retornou um frame selecionado. Selecione um frame no Figma e tente novamente."
    );
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
async function readRegisteredSelection(token, fileKey, dataNamespace = DEFAULT_FIGMENTOR_NAMESPACE) {
  const document2 = await figmaRequest(
    token,
    `/files/${encodeURIComponent(fileKey)}?depth=1&plugin_data=shared`
  );
  const rawSelection = findSelectionValue(document2, dataNamespace);
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
async function readNode(token, fileKey, nodeId) {
  if (!nodeId) throw new Error("O nodeId do frame registrado n\xE3o est\xE1 dispon\xEDvel.");
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
    throw new Error("O frame selecionado n\xE3o foi encontrado no arquivo Figma.");
  }
  Object.defineProperty(node, "__figmentorStyles", {
    configurable: true,
    enumerable: false,
    value: response.styles || {}
  });
  return node;
}
async function renderNodeImage(token, fileKey, nodeId, format = "png") {
  if (!nodeId) throw new Error("O nodeId do asset n\xE3o est\xE1 dispon\xEDvel.");
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
    throw new Error(`A API do Figma n\xE3o conseguiu renderizar o asset ${nodeId}.`);
  }
  const imageResponse = await fetch(url);
  if (!imageResponse.ok) {
    throw new Error(`N\xE3o foi poss\xEDvel baixar o render do asset ${nodeId}.`);
  }
  return {
    blob: await imageResponse.blob(),
    url,
    format
  };
}

// extension/src/assets.js
var TAG_PATTERN = /^\[([^\]]+)\]/;
function toNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function slugify(value) {
  return String(value || "asset").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\[[^\]]+\]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "asset";
}
function readPluginData(node, key, pluginId) {
  const candidates = [node?.pluginData, node?.plugin_data, node?.sharedPluginData];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    if (typeof candidate[key] === "string") return candidate[key];
    if (pluginId && candidate[pluginId] && typeof candidate[pluginId] === "object") {
      if (typeof candidate[pluginId][key] === "string") return candidate[pluginId][key];
    }
    if (candidate.figmentor && typeof candidate.figmentor === "object") {
      if (typeof candidate.figmentor[key] === "string") return candidate.figmentor[key];
    }
  }
  return null;
}
function getNodeTag(node, pluginId) {
  const pluginTag = readPluginData(node, "elementor-tag", pluginId);
  if (pluginTag) {
    const normalizedPluginTag = pluginTag.trim().toLowerCase();
    if (FIGMENTOR_TAGS.has(normalizedPluginTag)) return normalizedPluginTag;
  }
  if (readPluginData(node, "elementor_role", pluginId)) return null;
  const match = String(node?.name || "").match(TAG_PATTERN);
  if (!match) return null;
  const normalizedNameTag = match[1].trim().toLowerCase();
  return FIGMENTOR_TAGS.has(normalizedNameTag) ? normalizedNameTag : null;
}
function getNodeRole(node, pluginId) {
  const pluginRole = readPluginData(node, "elementor_role", pluginId);
  if (pluginRole) return pluginRole;
  const match = String(node?.name || "").match(TAG_PATTERN);
  if (!match) return null;
  const role = match[1].trim().toLowerCase();
  if (["title", "description", "icon", "image"].includes(role)) {
    return role === "title" ? "title_text" : role === "description" ? "description_text" : role;
  }
  return null;
}
function walkNodes(node, visitor, path = "0") {
  if (!node || typeof node !== "object") return;
  visitor(node, path);
  if (Array.isArray(node.children)) {
    node.children.forEach((child, index) => walkNodes(child, visitor, `${path}.${index}`));
  }
}
function getDimensions(node) {
  const bounds = node.absoluteBoundingBox || node.size || {};
  const width = toNumber(bounds.width, toNumber(node.width));
  const height = toNumber(bounds.height, toNumber(node.height));
  return {
    width,
    height,
    aspectRatio: height > 0 ? Number((width / height).toFixed(4)) : null
  };
}
function createAssetRecord(node, path, pluginId, kind, sourceFormat, targetFormat) {
  const dimensions = getDimensions(node);
  const baseName = slugify(node.name);
  const extension = targetFormat.toLowerCase();
  return {
    assetRef: `figmentor-${node.id.replace(/[^a-zA-Z0-9-]/g, "-")}-${kind}`,
    figmaNodeId: node.id,
    nodePath: path,
    elementName: node.name || "",
    fileName: `${baseName}-${node.id.replace(/[^a-zA-Z0-9-]/g, "-")}.${extension}`,
    kind,
    sourceFormat,
    targetFormat,
    width: dimensions.width,
    height: dimensions.height,
    aspectRatio: dimensions.aspectRatio,
    sourceBytes: null,
    targetBytes: null,
    status: "pending",
    pluginId,
    mediaId: null,
    mediaUrl: null
  };
}
function getFontAwesomeIcon(node) {
  const value = String(node?.name || "").replace(/^\[icon\]\s*/i, "").trim();
  const match = value.match(/^(fas|far|fab)\s+fa-[a-z0-9-]+/i);
  if (!match) return null;
  const icon = match[0].toLowerCase();
  return {
    value: icon,
    library: icon.startsWith("fab ") ? "fa-brands" : icon.startsWith("far ") ? "fa-regular" : "fa-solid"
  };
}
function discoverAssets(root, pluginId) {
  const assets = [];
  const seen = /* @__PURE__ */ new Set();
  const carouselChildIds = /* @__PURE__ */ new Set();
  const iconTags = /* @__PURE__ */ new Set(["icon-box", "icon-list", "button"]);
  const add = (record) => {
    if (seen.has(record.assetRef)) return;
    seen.add(record.assetRef);
    assets.push(record);
  };
  const visit = (node, path = "0", inheritedIconTag = null, insideRasterTag = false) => {
    const tag = getNodeTag(node, pluginId);
    const role = getNodeRole(node, pluginId);
    const iconOwnerTag = iconTags.has(tag) ? tag : inheritedIconTag;
    if (tag === "image-carousel") {
      const children = Array.isArray(node.children) && node.children.length > 0 ? node.children : [node];
      children.forEach((child, index) => {
        if (child?.id) carouselChildIds.add(child.id);
        add(createAssetRecord(child, `${path}.${index}`, pluginId, "carousel", "PNG", "WEBP"));
      });
    } else if (tag && ASSET_TAGS.has(tag) && !carouselChildIds.has(node.id)) {
      const kind = tag === "image-background" || tag === "background-image" ? "background" : "image";
      const targetFormat = kind === "image" || kind === "background" || kind === "carousel" ? "WEBP" : "WEBP";
      add(createAssetRecord(node, path, pluginId, kind, "PNG", targetFormat));
    } else if (!insideRasterTag && !carouselChildIds.has(node.id) && Array.isArray(node.fills) && node.fills.some((fill) => fill?.type === "IMAGE" && fill.visible !== false)) {
      add(createAssetRecord(node, path, pluginId, "image", "PNG", "WEBP"));
    }
    if ((role === "icon" || iconOwnerTag) && VECTOR_TYPES.has(node.type) && !getFontAwesomeIcon(node)) {
      const record = createAssetRecord(node, path, pluginId, "icon", "SVG", "SVG");
      record.fileName = `${slugify(node.name)}-${node.id.replace(/[^a-zA-Z0-9-]/g, "-")}.svg`;
      record.elementorWidget = iconOwnerTag || null;
      add(record);
    }
    const childInsideRaster = insideRasterTag || Boolean(tag && ASSET_TAGS.has(tag));
    (node.children || []).forEach(
      (child, index) => visit(child, `${path}.${index}`, iconOwnerTag, childInsideRaster)
    );
  };
  visit(root);
  return assets;
}
function createAssetReport(manifest) {
  return (manifest?.assets || []).map((asset) => ({
    assetRef: asset.assetRef,
    name: asset.elementName || asset.fileName,
    nodeId: asset.figmaNodeId,
    elementorElement: asset.elementorWidget || asset.kind,
    status: asset.status,
    mediaId: asset.mediaId || null,
    mediaUrl: asset.mediaUrl || null,
    reason: asset.error || null,
    action: asset.status === "failed" ? asset.targetFormat === "SVG" ? "Envie o SVG manualmente ou use Repetir falhos." : "Revise o limite/convers\xE3o e use Repetir falhos." : null
  }));
}
function selectAssetsForProcessing(manifest, onlyFailed = false) {
  return (manifest?.assets || []).filter(
    (asset) => onlyFailed ? asset.status === "failed" : asset.status !== "uploaded"
  );
}
function buildAssetManifest(root, pluginId, selection) {
  const assets = discoverAssets(root, pluginId);
  return {
    version: "0.1",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    source: {
      fileKey: selection?.fileKey || null,
      rootNodeId: selection?.nodeId || root?.id || null,
      rootName: selection?.name || root?.name || null,
      pluginId
    },
    constraints: {
      rasterTargetFormat: "WEBP",
      rasterMaxBytes: 150 * 1024,
      vectorTargetFormat: "SVG"
    },
    assets
  };
}

// src/utils/colors.js
function figmaColorToRGBA(color, opacity = 1) {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const alpha = opacity !== void 0 ? opacity : 1;
  return `rgba(${r},${g},${b},${parseFloat(alpha.toFixed(2))})`;
}

// src/utils/typography.js
function mapFontWeight(style) {
  const weights = {
    Thin: "100",
    Hairline: "100",
    "Extra Light": "200",
    "Ultra Light": "200",
    Light: "300",
    Regular: "400",
    Normal: "400",
    Medium: "500",
    "Semi Bold": "600",
    "Demi Bold": "600",
    Bold: "700",
    "Extra Bold": "800",
    "Ultra Bold": "800",
    Black: "900",
    Heavy: "900"
  };
  const match = Object.keys(weights).find((key) => style.includes(key));
  return weights[match] || "400";
}
function applyTypographySettings(settings, style, prefix = "typography") {
  settings[`${prefix}_typography`] = "custom";
  if (style.size) settings[`${prefix}_font_size`] = { size: style.size, unit: "px" };
  if (style.weight) settings[`${prefix}_font_weight`] = style.weight;
  if (style.fontFamily) settings[`${prefix}_font_family`] = style.fontFamily;
  if (style.lineHeight) settings[`${prefix}_line_height`] = style.lineHeight;
  if (style.letterSpacing) settings[`${prefix}_letter_spacing`] = style.letterSpacing;
  if (style.textTransform) settings[`${prefix}_text_transform`] = style.textTransform;
  if (style.textDecoration) settings[`${prefix}_text_decoration`] = style.textDecoration;
  if (style.fontStyle) settings[`${prefix}_font_style`] = style.fontStyle;
}

// src/utils/nodes.js
function getIterableNodes(node) {
  if ("children" in node && node.children.length > 0) {
    return node.children.filter((c) => c.visible);
  }
  const selection = globalThis.figma?.currentPage?.selection || [];
  if (selection.length > 1 && selection.includes(node)) {
    return selection.filter((n) => n.visible);
  }
  return [node];
}
function getLayoutDirection(node) {
  if (node.layoutMode === "HORIZONTAL") return "row";
  if (node.layoutMode === "VERTICAL") return "column";
  if (node.children) {
    const visibleChildren = node.children.filter((c) => c.visible);
    if (visibleChildren.length >= 2) {
      const child1 = visibleChildren[0];
      const child2 = visibleChildren[1];
      if (Math.abs(child1.y - child2.y) < 20) return "row";
    }
  }
  return "column";
}
function hasImageFill(node) {
  if (!node.fills || isFigmaMixed(node.fills)) return false;
  return Array.isArray(node.fills) && node.fills.some((f) => f.type === "IMAGE");
}
function getNodeRole2(node) {
  const pluginRole = node.getPluginData?.("elementor_role");
  if (pluginRole) return pluginRole;
  const name = (node.name || "").toLowerCase();
  if (name.includes("[title]")) return "title_text";
  if (name.includes("[description]")) return "description_text";
  if (name.includes("[icon]")) return "icon";
  if (name.includes("[image]")) return "image";
  return null;
}
function getSafeFontFamily(node) {
  if (!node || isFigmaMixed(node.fontName) || !node.fontName) return null;
  return node.fontName.family || null;
}
function isFigmaMixed(value) {
  return Boolean(globalThis.figma) && value === globalThis.figma.mixed;
}
var TEXT_ALIGN_MAP = {
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
  JUSTIFIED: "justify"
};
function mapTextAlign(textAlignHorizontal) {
  return TEXT_ALIGN_MAP[textAlignHorizontal] || "left";
}
function getTextAlign(node) {
  if (!node) return "left";
  if (node.type === "TEXT" && node.textAlignHorizontal && !isFigmaMixed(node.textAlignHorizontal)) {
    return mapTextAlign(node.textAlignHorizontal);
  }
  if ("findOne" in node) {
    const textChild = node.findOne(
      (child) => child.type === "TEXT" && child.textAlignHorizontal && !isFigmaMixed(child.textAlignHorizontal)
    );
    if (textChild) {
      return mapTextAlign(textChild.textAlignHorizontal);
    }
  }
  return "left";
}

// src/styles/index.js
async function resolveStyleName(styleId, maps) {
  if (!styleId) return null;
  if (maps?.styleNameMap?.[styleId]) return maps.styleNameMap[styleId];
  if (globalThis.figma?.getStyleByIdAsync) {
    const style = await globalThis.figma.getStyleByIdAsync(styleId);
    return style?.name || null;
  }
  return null;
}
function extractBorders(node, settings, isWidget = false, widgetType = "") {
  let radiusKey = isWidget ? "_border_radius" : "border_radius";
  let borderKey = isWidget ? "_border_border" : "border_border";
  let widthKey = isWidget ? "_border_width" : "border_width";
  let colorKey = isWidget ? "_border_color" : "border_color";
  if (widgetType === "image") {
    radiusKey = "image_border_radius";
    borderKey = "image_border_border";
    widthKey = "image_border_width";
    colorKey = "image_border_color";
  } else if (widgetType === "button") {
    radiusKey = "border_radius";
    borderKey = "border_border";
    widthKey = "border_width";
    colorKey = "border_color";
  }
  if (node.cornerRadius !== void 0) {
    if (isFigmaMixed(node.cornerRadius)) {
      settings[radiusKey] = {
        unit: "px",
        top: String(!isFigmaMixed(node.topLeftRadius) ? node.topLeftRadius || 0 : 0),
        right: String(!isFigmaMixed(node.topRightRadius) ? node.topRightRadius || 0 : 0),
        bottom: String(!isFigmaMixed(node.bottomRightRadius) ? node.bottomRightRadius || 0 : 0),
        left: String(!isFigmaMixed(node.bottomLeftRadius) ? node.bottomLeftRadius || 0 : 0),
        isLinked: false
      };
    } else if (node.cornerRadius > 0) {
      settings[radiusKey] = {
        unit: "px",
        top: String(node.cornerRadius),
        right: String(node.cornerRadius),
        bottom: String(node.cornerRadius),
        left: String(node.cornerRadius),
        isLinked: true
      };
    }
  }
  if (node.strokes && node.strokes.length > 0 && !isFigmaMixed(node.strokeWeight) && node.strokeWeight > 0) {
    const stroke = node.strokes[0];
    if (stroke.type === "SOLID") {
      settings[borderKey] = "solid";
      settings[widthKey] = {
        unit: "px",
        top: String(node.strokeWeight),
        right: String(node.strokeWeight),
        bottom: String(node.strokeWeight),
        left: String(node.strokeWeight),
        isLinked: true
      };
      settings[colorKey] = figmaColorToRGBA(stroke.color, stroke.opacity);
    }
  }
}
function extractShadows(node, settings, isWidget = false, widgetType = "") {
  let prefix = isWidget ? "_box_shadow_" : "_box_shadow_";
  if (widgetType === "image") prefix = "image_box_shadow_";
  if (node.effects && node.effects.length > 0) {
    const shadow = node.effects.find((e) => e.type === "DROP_SHADOW" && e.visible);
    if (shadow) {
      const shadowKey = widgetType === "image" ? "image_box_shadow" : prefix + "box_shadow";
      const typeKey = widgetType === "image" ? "image_box_shadow_type" : prefix + "box_shadow_type";
      settings[typeKey] = "yes";
      settings[shadowKey] = {
        horizontal: shadow.offset.x,
        vertical: shadow.offset.y,
        blur: shadow.radius,
        spread: shadow.spread || 0,
        color: figmaColorToRGBA(shadow.color, shadow.color.a),
        position: "outline"
      };
    }
  }
}
async function extractTextStyle(node, maps = { colorMap: {}, typoMap: {} }) {
  let color = "";
  let globalColorId = null;
  let globalTypoId = null;
  if (node.fills && !isFigmaMixed(node.fills) && node.fills.length > 0) {
    if (node.fills[0].type === "SOLID") {
      color = figmaColorToRGBA(node.fills[0].color, node.fills[0].opacity);
      if (node.fillStyleId) {
        const styleName = await resolveStyleName(node.fillStyleId, maps);
        if (styleName && maps.colorMap && maps.colorMap[styleName]) {
          globalColorId = maps.colorMap[styleName];
        }
      }
    }
  }
  const size = node.fontSize !== void 0 && !isFigmaMixed(node.fontSize) ? node.fontSize : 16;
  let weight = "400";
  if (node.fontName !== void 0 && !isFigmaMixed(node.fontName)) {
    weight = mapFontWeight(node.fontName.style);
  }
  const fontFamily = getSafeFontFamily(node);
  let lineHeight2 = null;
  if (node.lineHeight !== void 0 && !isFigmaMixed(node.lineHeight)) {
    if (node.lineHeight.unit !== "AUTO") {
      lineHeight2 = {
        size: node.lineHeight.value,
        unit: node.lineHeight.unit === "PIXELS" ? "px" : "%"
      };
    }
  }
  let letterSpacing2 = null;
  if (node.letterSpacing !== void 0 && !isFigmaMixed(node.letterSpacing)) {
    if (node.letterSpacing.value !== 0) {
      letterSpacing2 = {
        size: node.letterSpacing.value,
        unit: node.letterSpacing.unit === "PIXELS" ? "px" : "em"
      };
    }
  }
  let textTransform = null;
  if (node.textCase !== void 0 && !isFigmaMixed(node.textCase)) {
    const caseMap = {
      UPPER: "uppercase",
      LOWER: "lowercase",
      TITLE: "capitalize",
      SMALL_CAPS: "uppercase"
    };
    textTransform = caseMap[node.textCase] || null;
  }
  let textDecoration = null;
  if (node.textDecoration !== void 0 && !isFigmaMixed(node.textDecoration)) {
    const decorMap = {
      UNDERLINE: "underline",
      STRIKETHROUGH: "line-through"
    };
    textDecoration = decorMap[node.textDecoration] || null;
  }
  let fontStyle = null;
  if (node.fontName !== void 0 && !isFigmaMixed(node.fontName)) {
    if (node.fontName.style.includes("Italic")) {
      fontStyle = "italic";
    }
  }
  if (node.textStyleId) {
    const styleName = await resolveStyleName(node.textStyleId, maps);
    if (styleName && maps.typoMap && maps.typoMap[styleName]) {
      globalTypoId = maps.typoMap[styleName];
    }
  }
  return {
    color,
    size,
    weight,
    fontFamily,
    globalColorId,
    globalTypoId,
    lineHeight: lineHeight2,
    letterSpacing: letterSpacing2,
    textTransform,
    textDecoration,
    fontStyle
  };
}
async function extractBackground(node, maps = { colorMap: {}, typoMap: {} }) {
  const result = {};
  if (node.fills && !isFigmaMixed(node.fills) && node.fills.length > 0) {
    const solidFill = node.fills.find((f) => f.type === "SOLID" && f.visible !== false);
    if (solidFill) {
      const color = figmaColorToRGBA(solidFill.color, solidFill.opacity);
      let globalColorId = null;
      if (node.fillStyleId) {
        const styleName = await resolveStyleName(node.fillStyleId, maps);
        if (styleName && maps.colorMap && maps.colorMap[styleName]) {
          globalColorId = maps.colorMap[styleName];
        }
      }
      result.background_background = "classic";
      result.background_color = color;
      if (globalColorId) result.globalColorId = globalColorId;
    }
  }
  return result;
}

// src/utils/cssId.js
var accentMap = {
  \u00E1: "a",
  \u00E0: "a",
  \u00E3: "a",
  \u00E2: "a",
  \u00E4: "a",
  \u00E9: "e",
  \u00E8: "e",
  \u00EA: "e",
  \u00EB: "e",
  \u00ED: "i",
  \u00EC: "i",
  \u00EE: "i",
  \u00EF: "i",
  \u00F3: "o",
  \u00F2: "o",
  \u00F5: "o",
  \u00F4: "o",
  \u00F6: "o",
  \u00FA: "u",
  \u00F9: "u",
  \u00FB: "u",
  \u00FC: "u",
  \u00E7: "c",
  \u00F1: "n",
  \u00C1: "a",
  \u00C0: "a",
  \u00C3: "a",
  \u00C2: "a",
  \u00C4: "a",
  \u00C9: "e",
  \u00C8: "e",
  \u00CA: "e",
  \u00CB: "e",
  \u00CD: "i",
  \u00CC: "i",
  \u00CE: "i",
  \u00CF: "i",
  \u00D3: "o",
  \u00D2: "o",
  \u00D5: "o",
  \u00D4: "o",
  \u00D6: "o",
  \u00DA: "u",
  \u00D9: "u",
  \u00DB: "u",
  \u00DC: "u",
  \u00C7: "c",
  \u00D1: "n"
};
function sanitizeCssId(name) {
  if (!name || typeof name !== "string") return "";
  let result = name.split("").map((char) => accentMap[char] || char).join("");
  result = result.toLowerCase().replace(/\[.*?\]/g, "").trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "").substring(0, 64);
  return result;
}

// src/styles/elementor-selectors.js
var ELEMENTOR_SELECTOR_PROFILE = "elementor-core-3.x";
var CSS_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
var ROOT = { selector: "", label: "element root" };
var ELEMENTOR_SELECTOR_REGISTRY = Object.freeze({
  container: {
    profile: ELEMENTOR_SELECTOR_PROFILE,
    root: ROOT,
    slots: {
      inner: { selector: ".e-con-inner", label: "container inner" },
      backgroundVideo: {
        selector: ".elementor-background-video-container",
        label: "background video"
      },
      backgroundVideoEmbed: {
        selector: ".elementor-background-video-embed",
        label: "embedded background video"
      },
      backgroundVideoHosted: {
        selector: ".elementor-background-video-hosted",
        label: "hosted background video"
      },
      shapeTop: { selector: ".elementor-shape.elementor-shape-top", label: "top shape" },
      shapeBottom: { selector: ".elementor-shape.elementor-shape-bottom", label: "bottom shape" },
      overlay: { selector: "::before", label: "container overlay" }
    },
    classes: [".e-con", ".e-parent", ".e-child", ".e-con-inner", ".e-con-full", ".e-con-boxed"]
  },
  heading: {
    profile: ELEMENTOR_SELECTOR_PROFILE,
    root: ROOT,
    slots: { title: { selector: ".elementor-heading-title", label: "heading title" } },
    classes: [
      ".elementor-size-default",
      ".elementor-size-small",
      ".elementor-size-medium",
      ".elementor-size-large",
      ".elementor-size-xl",
      ".elementor-size-xxl"
    ]
  },
  "text-editor": {
    profile: ELEMENTOR_SELECTOR_PROFILE,
    root: ROOT,
    slots: {
      editor: { selector: ".elementor-text-editor", label: "text editor" },
      clearfix: { selector: ".elementor-clearfix", label: "clearfix content" },
      dropCap: { selector: ".elementor-drop-cap", label: "drop cap" },
      dropCapLetter: { selector: ".elementor-drop-cap-letter", label: "drop cap letter" }
    },
    classes: [
      ".elementor-drop-cap-view-default",
      ".elementor-drop-cap-view-stacked",
      ".elementor-drop-cap-view-framed"
    ]
  },
  image: {
    profile: ELEMENTOR_SELECTOR_PROFILE,
    root: ROOT,
    slots: {
      image: { selector: "img", label: "image" },
      figure: { selector: "figure.wp-caption", label: "caption figure" },
      caption: {
        selector: "figcaption.widget-image-caption.wp-caption-text",
        label: "image caption"
      }
    },
    classes: [".elementor-clickable"]
  },
  "image-box": {
    profile: ELEMENTOR_SELECTOR_PROFILE,
    root: ROOT,
    slots: {
      wrapper: { selector: ".elementor-image-box-wrapper", label: "image box wrapper" },
      image: { selector: ".elementor-image-box-img", label: "image box image" },
      imageElement: { selector: ".elementor-image-box-img img", label: "image box image element" },
      content: { selector: ".elementor-image-box-content", label: "image box content" },
      title: { selector: ".elementor-image-box-title", label: "image box title" },
      description: { selector: ".elementor-image-box-description", label: "image box description" }
    },
    classes: [
      ".elementor-position-top",
      ".elementor-position-left",
      ".elementor-position-right",
      ".elementor-position-bottom",
      ".elementor-vertical-align-top",
      ".elementor-vertical-align-middle",
      ".elementor-vertical-align-bottom"
    ]
  },
  "icon-box": {
    profile: ELEMENTOR_SELECTOR_PROFILE,
    root: ROOT,
    slots: {
      wrapper: { selector: ".elementor-icon-box-wrapper", label: "icon box wrapper" },
      icon: { selector: ".elementor-icon-box-icon", label: "icon box icon" },
      iconElement: { selector: ".elementor-icon", label: "icon element" },
      content: { selector: ".elementor-icon-box-content", label: "icon box content" },
      title: { selector: ".elementor-icon-box-title", label: "icon box title" },
      description: { selector: ".elementor-icon-box-description", label: "icon box description" }
    },
    classes: [
      ".elementor-view-default",
      ".elementor-view-stacked",
      ".elementor-view-framed",
      ".elementor-shape-circle",
      ".elementor-shape-square",
      ".elementor-animation-grow",
      ".elementor-animation-shrink",
      ".elementor-animation-pulse"
    ]
  },
  "icon-list": {
    profile: ELEMENTOR_SELECTOR_PROFILE,
    root: ROOT,
    slots: {
      items: { selector: ".elementor-icon-list-items", label: "icon list items" },
      item: { selector: ".elementor-icon-list-item", label: "icon list item" },
      inlineItem: { selector: ".elementor-inline-item", label: "inline icon list item" },
      icon: { selector: ".elementor-icon-list-icon", label: "icon list icon" },
      text: { selector: ".elementor-icon-list-text", label: "icon list text" }
    },
    classes: [
      ".elementor-inline-items",
      ".elementor-icon-list--layout-traditional",
      ".elementor-icon-list--layout-inline"
    ]
  },
  button: {
    profile: ELEMENTOR_SELECTOR_PROFILE,
    root: ROOT,
    slots: {
      wrapper: { selector: ".elementor-button-wrapper", label: "button wrapper" },
      button: { selector: ".elementor-button", label: "button" },
      link: { selector: ".elementor-button-link", label: "button link" },
      content: { selector: ".elementor-button-content-wrapper", label: "button content" },
      icon: { selector: ".elementor-button-icon", label: "button icon" },
      text: { selector: ".elementor-button-text", label: "button text" }
    },
    states: { hover: ":hover", focus: ":focus" },
    classes: [
      ".elementor-size-xs",
      ".elementor-size-sm",
      ".elementor-size-md",
      ".elementor-size-lg",
      ".elementor-size-xl",
      ".elementor-size-xxl",
      ".elementor-animation-grow",
      ".elementor-animation-shrink",
      ".elementor-animation-pulse"
    ]
  },
  accordion: {
    profile: ELEMENTOR_SELECTOR_PROFILE,
    root: ROOT,
    slots: {
      accordion: { selector: ".elementor-accordion", label: "accordion" },
      item: { selector: ".elementor-accordion-item", label: "accordion item" },
      title: { selector: ".elementor-tab-title", label: "accordion title" },
      content: { selector: ".elementor-tab-content", label: "accordion content" },
      icon: { selector: ".elementor-accordion-icon", label: "accordion icon" },
      titleText: { selector: ".elementor-accordion-title", label: "accordion title text" },
      openedIcon: { selector: ".elementor-accordion-icon-opened", label: "opened accordion icon" },
      closedIcon: { selector: ".elementor-accordion-icon-closed", label: "closed accordion icon" }
    },
    states: { active: ".elementor-active" },
    itemTarget: '.elementor-tab-title[data-tab="{index}"]'
  },
  "nested-accordion": {
    profile: ELEMENTOR_SELECTOR_PROFILE,
    root: ROOT,
    slots: {
      accordion: { selector: ".e-n-accordion", label: "nested accordion" },
      item: { selector: ".e-n-accordion-item", label: "nested accordion item" },
      title: { selector: ".e-n-accordion-item-title", label: "nested accordion title" },
      titleHeader: {
        selector: ".e-n-accordion-item-title-header",
        label: "nested accordion title header"
      },
      titleText: {
        selector: ".e-n-accordion-item-title-text",
        label: "nested accordion title text"
      },
      titleIcon: {
        selector: ".e-n-accordion-item-title-icon",
        label: "nested accordion title icon"
      }
    },
    states: { opened: ".e-opened", closed: ".e-closed", nativeOpened: "[open]" },
    itemTarget: ".e-n-accordion-item:nth-of-type({index})"
  },
  "image-carousel": {
    profile: ELEMENTOR_SELECTOR_PROFILE,
    root: ROOT,
    slots: {
      wrapper: { selector: ".elementor-image-carousel-wrapper", label: "image carousel wrapper" },
      carousel: { selector: ".elementor-image-carousel", label: "image carousel" },
      track: { selector: ".swiper-wrapper", label: "carousel track" },
      slide: { selector: ".swiper-slide", label: "carousel slide" },
      slideInner: { selector: ".swiper-slide-inner", label: "carousel slide inner" },
      image: { selector: ".swiper-slide-image", label: "carousel image" },
      caption: { selector: ".elementor-image-carousel-caption", label: "carousel caption" },
      navigation: { selector: ".elementor-swiper-button", label: "carousel navigation" },
      previous: { selector: ".elementor-swiper-button-prev", label: "previous navigation" },
      next: { selector: ".elementor-swiper-button-next", label: "next navigation" },
      pagination: { selector: ".swiper-pagination", label: "carousel pagination" },
      bullet: { selector: ".swiper-pagination-bullet", label: "carousel pagination bullet" },
      activeBullet: {
        selector: ".swiper-pagination-bullet-active",
        label: "active pagination bullet"
      }
    },
    itemTarget: ".swiper-slide:nth-of-type({index})"
  },
  "nested-carousel": {
    profile: ELEMENTOR_SELECTOR_PROFILE,
    experimental: true,
    reason: "O widget nested-carousel n\xE3o est\xE1 presente no core Elementor verificado; exige perfil alvo validado.",
    root: ROOT,
    slots: {}
  }
});
function getSelectorDefinition(widgetType) {
  return ELEMENTOR_SELECTOR_REGISTRY[widgetType] || null;
}
function selectorFor(widgetType, slot = "root") {
  const definition = getSelectorDefinition(widgetType);
  if (!definition) return null;
  return definition.slots?.[slot]?.selector ?? definition.root.selector;
}
function scopeSelector(cssId, relativeSelector = "") {
  if (!cssId || typeof cssId !== "string" || !CSS_ID_PATTERN.test(cssId)) return null;
  const root = `#${cssId}`;
  if (!relativeSelector) return root;
  if (relativeSelector.startsWith("::") || relativeSelector.startsWith(":") || relativeSelector.startsWith("[")) {
    return `${root}${relativeSelector}`;
  }
  return `${root} ${relativeSelector}`;
}
function resolveSelector(widgetType, cssId, slot = "root") {
  const relative = selectorFor(widgetType, slot);
  return relative === null ? null : scopeSelector(cssId, relative);
}
function resolveItemSelector(widgetType, cssId, index) {
  const definition = getSelectorDefinition(widgetType);
  if (!definition?.itemTarget || !Number.isInteger(index) || index < 1) return null;
  return scopeSelector(cssId, definition.itemTarget.replace("{index}", String(index)));
}

// src/styles/effects.js
var CSS_SAFE_PROPERTIES = /* @__PURE__ */ new Set([
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
var BLEND_MODE_MAP = {
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
  return figmaColorToRGBA(color, opacity === void 0 ? color.a : opacity);
}
function percent(value) {
  return `${Math.round(Math.max(0, Math.min(1, finite(value, 0))) * 1e4) / 100}%`;
}
function angleFromHandles(handles = []) {
  const start = handles[0];
  const end = handles[1];
  if (!start || !end) return 180;
  const radians = Math.atan2(finite(end.x) - finite(start.x), finite(start.y) - finite(end.y));
  return Math.round((radians * 180 / Math.PI + 360) % 360);
}
function gradientStops(paint) {
  return (paint.gradientStops || []).map(
    (stop) => `${alphaColor(stop.color, stop.color?.a * finite(paint.opacity, 1))} ${percent(stop.position)}`
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
  return Array.isArray(node?.fills) ? node.fills.filter((paint) => paint && paint.visible !== false) : [];
}
function visibleEffects(node) {
  return Array.isArray(node?.effects) ? node.effects.filter((effect) => effect && effect.visible !== false) : [];
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
  if (!CSS_SAFE_PROPERTIES.has(property) || value === null || value === void 0 || value === "")
    return null;
  return `${property}: ${value};`;
}
function extractAdvancedEffects(node, widgetType, cssId) {
  const definition = getSelectorDefinition(widgetType);
  const paints = visiblePaints(node);
  const effects = visibleEffects(node);
  const cssDeclarations = [];
  const flags = [];
  const blendMode = BLEND_MODE_MAP[node?.blendMode];
  const hasUnsupportedBlend = Boolean(node?.blendMode && !BLEND_MODE_MAP[node.blendMode]);
  const hasAdvancedEffect = effects.length > 1 || effects.some((effect) => effect.type !== "DROP_SHADOW") || node?.opacity !== void 0 && finite(node.opacity, 1) < 1 || blendMode && blendMode !== "normal" || hasUnsupportedBlend;
  const native = {
    background: null,
    shadow: nativeShadowPossible(effects) && !hasAdvancedEffect
  };
  const solidPaints = paints.filter((paint) => paint.type === "SOLID");
  const gradientPaints = paints.map(gradientToCss).filter(Boolean);
  const cssPaints = paints.map(paintToCss).filter(Boolean);
  const unsupportedPaints = paints.filter(
    (paint) => ![
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
    (effect) => !["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"].includes(effect.type)
  );
  if (unsupportedEffects.length > 0)
    flags.push(...unsupportedEffects.map((effect) => `effect:${effect.type}`));
  if (effects.filter((effect) => effect.type === "LAYER_BLUR").length > 1)
    flags.push("multiple-layer-blur:first-layer-applied");
  if (effects.filter((effect) => effect.type === "BACKGROUND_BLUR").length > 1)
    flags.push("multiple-background-blur:first-layer-applied");
  if (node?.opacity !== void 0 && finite(node.opacity, 1) < 1)
    cssDeclarations.push(
      declaration("opacity", String(Math.max(0, Math.min(1, finite(node.opacity, 1)))))
    );
  const textGradient = gradientPaints.length > 0 && ["heading", "text-editor"].includes(widgetType);
  if (textGradient) {
    cssDeclarations.push(declaration("background-clip", "text"));
    cssDeclarations.push(declaration("-webkit-background-clip", "text"));
    cssDeclarations.push(declaration("color", "transparent"));
  }
  const targetSlot = textGradient ? widgetType === "heading" ? "title" : "editor" : "root";
  const itemSelectors = definition?.itemTarget && cssId && Array.isArray(node?.children) ? node.children.map((_, index) => resolveItemSelector(widgetType, cssId, index + 1)).filter(Boolean) : [];
  const resolvedSelector = cssId ? resolveSelector(widgetType, cssId, targetSlot) : null;
  const customCss = cssDeclarations.length && cssId ? resolvedSelector ? `${resolvedSelector} {
  ${cssDeclarations.filter(Boolean).join("\n  ")}
}` : "" : "";
  if (cssDeclarations.length > 0 && !resolvedSelector)
    flags.push(cssId ? "invalid-css-id" : "missing-css-id");
  if (definition?.experimental) flags.push("experimental-selector-profile");
  if (shadows.some((effect) => effect.type === "INNER_SHADOW")) flags.push("inner-shadow-css");
  const cssCount = cssDeclarations.filter(Boolean).length;
  const strategy = customCss ? "custom_css" : native.background || native.shadow ? "native" : flags.length ? "flag" : "none";
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
function applyAdvancedEffects(settings, report) {
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
function summarizeEffects(content = []) {
  const summary = { total: 0, native: 0, customCss: 0, flags: 0, unsupported: 0 };
  const walk = (elements) => (elements || []).forEach((element) => {
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

// src/core/handlers.js
function applyOpacitySetting(settings, node) {
  if (node.opacity !== void 0 && node.opacity < 1) {
    settings._opacity = String(Math.round(node.opacity * 100));
  }
}
function applySourceMetadata(settings, node, tag = null) {
  if (!settings || !node?.id) return settings;
  if (!settings.css_id) {
    settings.css_id = sanitizeCssId(`figmentor-${tag || "element"}-${node.id}`) || "figmentor-element";
  }
  if (!node.__figmentorRest) return settings;
  settings.figmentor_source_node_id = node.id;
  const resolvedTag = tag || node.getPluginData?.("elementor-tag");
  if (resolvedTag) settings.figmentor_source_tag = resolvedTag;
  return settings;
}
function applyNodeEffects(settings, node, tag) {
  if (!settings || !node || !tag) return settings;
  const widgetType = tag === "accordeon" ? "nested-accordion" : tag === "container-carousel" ? "nested-carousel" : tag;
  return applyAdvancedEffects(settings, extractAdvancedEffects(node, widgetType, settings.css_id));
}
function getFontAwesomeName(node) {
  const value = String(node?.name || "").replace(/^\[icon\]\s*/i, "").trim();
  const match = value.match(/^(fas|far|fab)\s+fa-[a-z0-9-]+/i);
  return match ? match[0].toLowerCase() : null;
}
function getTextNodesFromNode(node) {
  if (!node) return [];
  if (node.type === "TEXT") return [node];
  if ("findAll" in node) return node.findAll((child) => child.type === "TEXT");
  return [];
}
async function buildAccordionItems(node, maps) {
  const iterableNodes = getIterableNodes(node);
  const items = [];
  let titleStyle = null;
  let contentStyle = null;
  for (const child of iterableNodes) {
    const childTextNodes = getTextNodesFromNode(child);
    if (childTextNodes.length === 0) {
      continue;
    }
    const explicitTitleNode = childTextNodes.find(
      (textNode) => getNodeRole2(textNode) === "title_text"
    );
    const explicitDescriptionNode = childTextNodes.find(
      (textNode) => getNodeRole2(textNode) === "description_text"
    );
    const fallbackTitleNode = explicitTitleNode || childTextNodes[0];
    const fallbackContentNodes = explicitDescriptionNode ? [explicitDescriptionNode] : childTextNodes.filter((textNode) => textNode.id !== fallbackTitleNode.id);
    const tabTitle = fallbackTitleNode && fallbackTitleNode.characters && fallbackTitleNode.characters.trim() || `Item ${items.length + 1}`;
    const tabContent = fallbackContentNodes.map((textNode) => textNode.characters.trim()).filter(Boolean).join("<br>") || "Conte\xFAdo do item";
    if (!titleStyle && fallbackTitleNode) {
      titleStyle = await extractTextStyle(fallbackTitleNode, maps);
    }
    if (!contentStyle) {
      const contentSourceNode = fallbackContentNodes[0] || fallbackTitleNode;
      if (contentSourceNode) {
        contentStyle = await extractTextStyle(contentSourceNode, maps);
      }
    }
    items.push({
      tab_title: tabTitle,
      tab_content: tabContent
    });
  }
  return {
    items,
    titleStyle,
    contentStyle
  };
}
async function buildAccordeonItems(node, maps) {
  const iterableNodes = getIterableNodes(node);
  const items = [];
  const elements = [];
  let titleStyle = null;
  for (let index = 0; index < iterableNodes.length; index++) {
    const child = iterableNodes[index];
    const childTextNodes = getTextNodesFromNode(child);
    if (childTextNodes.length === 0) {
      continue;
    }
    const explicitTitleNode = childTextNodes.find(
      (textNode) => getNodeRole2(textNode) === "title_text"
    );
    const fallbackTitleNode = explicitTitleNode || childTextNodes[0];
    const directChildren = "children" in child ? child.children.filter((item) => item.visible) : [];
    let explicitContentNode = null;
    if ("findAll" in child) {
      explicitContentNode = child.findAll(
        (nodeItem) => nodeItem.visible && nodeItem.id !== fallbackTitleNode.id && getNodeRole2(nodeItem) === "description_text"
      )[0] || null;
    }
    let titleBranchNode = null;
    if (directChildren.length > 0 && fallbackTitleNode) {
      titleBranchNode = directChildren.find(
        (nodeItem) => nodeItem.id === fallbackTitleNode.id || "findOne" in nodeItem && nodeItem.findOne((descendant) => descendant.id === fallbackTitleNode.id)
      ) || null;
    }
    let contentNodes = [];
    if (explicitContentNode) {
      if ("children" in explicitContentNode && explicitContentNode.children.length > 0) {
        contentNodes = explicitContentNode.children.filter((item) => item.visible);
      } else {
        contentNodes = [explicitContentNode];
      }
    } else if (directChildren.length > 0) {
      contentNodes = directChildren.filter(
        (nodeItem) => nodeItem.id !== (titleBranchNode && titleBranchNode.id)
      );
    }
    if (contentNodes.length === 0) {
      contentNodes = childTextNodes.filter((textNode) => textNode.id !== fallbackTitleNode.id);
    }
    const tabTitle = fallbackTitleNode && fallbackTitleNode.characters && fallbackTitleNode.characters.trim() || `Accordion #${items.length + 1}`;
    if (!titleStyle && fallbackTitleNode) {
      titleStyle = await extractTextStyle(fallbackTitleNode, maps);
    }
    let itemElements = [];
    for (const contentNode of contentNodes) {
      const result = applyChildFillSizing(
        contentNode,
        await traverseNode(contentNode, false, maps, true)
      );
      if (result) {
        if (Array.isArray(result)) itemElements = itemElements.concat(result);
        else itemElements.push(result);
      }
    }
    items.push({
      item_title: tabTitle,
      element_css_id: sanitizeCssId(child.name) || ""
    });
    elements.push({
      elType: "container",
      settings: {
        _title: `item #${index + 1}`,
        content_width: "full"
      },
      elements: itemElements
    });
  }
  return {
    items,
    elements,
    titleStyle
  };
}
function applyChildFillSizing(childNode, childResult) {
  if (!childNode || !childResult || Array.isArray(childResult) || !childResult.elType) {
    return childResult;
  }
  if (childNode.layoutSizingHorizontal !== "FILL") {
    return childResult;
  }
  childResult.settings = childResult.settings || {};
  if (childResult.elType === "container") {
    childResult.settings.width = { size: 100, unit: "%" };
    if (childResult.settings.content_width !== "boxed") {
      childResult.settings.content_width = "full";
    }
  } else if (childResult.elType === "widget") {
    childResult.settings._width = { size: 100, unit: "%" };
  }
  return childResult;
}
async function handleManualTag(node, tag, isRoot, maps) {
  if (tag === "container" || tag === "container-full" || tag === "page-wrapper" || tag === "image-background" || tag === "background-image") {
    let children = [];
    const childIsRoot = tag === "page-wrapper";
    if ("children" in node) {
      for (const child of node.children) {
        const res = applyChildFillSizing(child, await traverseNode(child, childIsRoot, maps, true));
        if (res) {
          if (Array.isArray(res)) children = children.concat(res);
          else children.push(res);
        }
      }
    }
    if (tag === "page-wrapper") {
      return children;
    }
    const container = await mapContainer(
      node,
      children,
      isRoot,
      tag === "container-full" || tag === "image-background" || tag === "background-image",
      maps,
      true
    );
    if (container) {
      applySourceMetadata(container.settings, node, tag);
      applyNodeEffects(container.settings, node, "container");
    }
    return container;
  }
  let textNodes = [];
  if (node.type === "TEXT") textNodes.push(node);
  else if ("findAll" in node) textNodes = node.findAll((n) => n.type === "TEXT");
  const texts = textNodes.map((t) => t.characters);
  const styles = await Promise.all(textNodes.map((t) => extractTextStyle(t, maps)));
  const mainStyle = styles.length > 0 ? styles[0] : { color: "", size: 16, weight: "400" };
  const secStyle = styles.length > 1 ? styles[1] : mainStyle;
  const settings = {};
  let bgSettings = {};
  if (node.type !== "TEXT") {
    bgSettings = await extractBackground(node, maps);
    if (bgSettings.background_background) {
      settings._background_background = bgSettings.background_background;
      settings._background_color = bgSettings.background_color;
      if (bgSettings.__globals__)
        settings.__globals__ = Object.assign(
          {},
          settings.__globals__ || {},
          bgSettings.__globals__
        );
    }
  }
  extractBorders(node, settings, true, tag);
  extractShadows(node, settings, true, tag);
  if (tag === "image-box") {
    const titleNode = textNodes.find((n) => getNodeRole2(n) === "title_text");
    const descNode = textNodes.find((n) => getNodeRole2(n) === "description_text");
    settings.title_text = titleNode ? titleNode.characters : texts[0] || "T\xEDtulo";
    const tStyle = titleNode ? await extractTextStyle(titleNode, maps) : mainStyle;
    if (tStyle.color) settings.title_color = tStyle.color;
    if (tStyle.globalColorId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.title_color = `globals/colors?id=${tStyle.globalColorId}`;
    }
    if (tStyle.globalTypoId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.title_typography_typography = `globals/typography?id=${tStyle.globalTypoId}`;
    }
    applyTypographySettings(settings, tStyle, "title_typography");
    settings.description_text = descNode ? descNode.characters : texts.slice(1).join(" ");
    const dStyle = descNode ? await extractTextStyle(descNode, maps) : secStyle;
    if (dStyle.color) settings.description_color = dStyle.color;
    if (dStyle.globalColorId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.description_color = `globals/colors?id=${dStyle.globalColorId}`;
    }
    if (dStyle.globalTypoId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.description_typography_typography = `globals/typography?id=${dStyle.globalTypoId}`;
    }
    applyTypographySettings(settings, dStyle, "description_typography");
    settings.text_align = getTextAlign(node);
    settings.image = { url: "", id: "" };
  } else if (tag === "icon-box") {
    const titleNode = textNodes.find((n) => getNodeRole2(n) === "title_text");
    const descNode = textNodes.find((n) => getNodeRole2(n) === "description_text");
    settings.title_text = titleNode ? titleNode.characters : texts[0] || "T\xEDtulo do \xCDcone";
    settings.title = settings.title_text;
    const tStyle = titleNode ? await extractTextStyle(titleNode, maps) : mainStyle;
    if (tStyle.color) settings.title_color = tStyle.color;
    if (tStyle.globalColorId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.title_color = `globals/colors?id=${tStyle.globalColorId}`;
    }
    if (tStyle.globalTypoId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.title_typography_typography = `globals/typography?id=${tStyle.globalTypoId}`;
    }
    applyTypographySettings(settings, tStyle, "title_typography");
    settings.description_text = descNode ? descNode.characters : texts.slice(1).join(" ");
    settings.description = settings.description_text;
    const dStyle = descNode ? await extractTextStyle(descNode, maps) : secStyle;
    if (dStyle.color) settings.description_color = dStyle.color;
    if (dStyle.globalColorId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.description_color = `globals/colors?id=${dStyle.globalColorId}`;
    }
    if (dStyle.globalTypoId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.description_typography_typography = `globals/typography?id=${dStyle.globalTypoId}`;
    }
    applyTypographySettings(settings, dStyle, "description_typography");
    let iconColor = mainStyle.color;
    let iconName = "fas fa-star";
    let vectorNodes = [];
    if (node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION") vectorNodes.push(node);
    else if ("findAll" in node)
      vectorNodes = node.findAll((n) => n.type === "VECTOR" || n.type === "BOOLEAN_OPERATION");
    const specificIconVector = vectorNodes.find((n) => getNodeRole2(n) === "icon");
    if (specificIconVector) vectorNodes = [specificIconVector];
    if (vectorNodes.length > 0) {
      const vector = vectorNodes[0];
      const detectedIconName = getFontAwesomeName(vector);
      if (detectedIconName) iconName = detectedIconName;
      if (vector.fills && !isFigmaMixed(vector.fills) && vector.fills.length > 0) {
        if (vector.fills[0].type === "SOLID") {
          iconColor = figmaColorToRGBA(vector.fills[0].color, vector.fills[0].opacity);
        }
      }
    }
    settings.selected_icon = {
      value: iconName,
      library: iconName.startsWith("fab") ? "fa-brands" : "fa-solid"
    };
    if (iconColor) settings.primary_color = iconColor;
    settings.text_align = getTextAlign(node);
  } else if (tag === "icon-list") {
    let listItems = texts;
    if (listItems.length === 0) listItems = ["Item Lista 1", "Item Lista 2", "Item Lista 3"];
    settings.icon_list = listItems.map((t) => ({
      text: t,
      selected_icon: { value: "fas fa-check", library: "fa-solid" }
    }));
    if (mainStyle.color) {
      settings.icon_color = mainStyle.color;
      settings.text_color = mainStyle.color;
    }
    if (mainStyle.globalColorId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.icon_color = `globals/colors?id=${mainStyle.globalColorId}`;
      settings.__globals__.text_color = `globals/colors?id=${mainStyle.globalColorId}`;
    }
    if (mainStyle.globalTypoId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.text_typography_typography = `globals/typography?id=${mainStyle.globalTypoId}`;
    }
    applyTypographySettings(settings, mainStyle, "text_typography");
  } else if (tag === "heading") {
    settings.align = getTextAlign(node);
    settings.title = texts.join(" ");
    if (mainStyle.color) settings.title_color = mainStyle.color;
    if (mainStyle.globalColorId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.title_color = `globals/colors?id=${mainStyle.globalColorId}`;
    }
    if (mainStyle.globalTypoId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.typography_typography = `globals/typography?id=${mainStyle.globalTypoId}`;
    }
    applyTypographySettings(settings, mainStyle, "typography");
  } else if (tag === "text-editor") {
    settings.align = getTextAlign(node);
    settings.editor = texts.join("<br>");
    if (mainStyle.color) settings.text_color = mainStyle.color;
    if (mainStyle.globalColorId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.text_color = `globals/colors?id=${mainStyle.globalColorId}`;
    }
    if (mainStyle.globalTypoId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.typography_typography = `globals/typography?id=${mainStyle.globalTypoId}`;
    }
    applyTypographySettings(settings, mainStyle, "typography");
  } else if (tag === "button") {
    try {
      settings.text = texts.join(" ") || "Clique Aqui";
      if (mainStyle.color) {
        settings.text_color = mainStyle.color;
      }
      if (mainStyle.globalColorId) {
        settings.__globals__ = settings.__globals__ || {};
        settings.__globals__.button_text_color = `globals/colors?id=${mainStyle.globalColorId}`;
      }
      if (mainStyle.globalTypoId) {
        settings.__globals__ = settings.__globals__ || {};
        settings.__globals__.typography_typography = `globals/typography?id=${mainStyle.globalTypoId}`;
      }
      applyTypographySettings(settings, mainStyle, "typography");
      if (settings._background_color) {
        settings.background_color = settings._background_color;
        if (bgSettings.globalColorId) {
          settings.__globals__ = settings.__globals__ || {};
          settings.__globals__.background_color = `globals/colors?id=${bgSettings.globalColorId}`;
        }
        delete settings._background_color;
        delete settings._background_background;
      }
      const paddingTop = node.paddingTop || 0;
      const paddingBottom = node.paddingBottom || 0;
      const sumPadding = paddingTop + paddingBottom;
      if (sumPadding >= 40) settings.size = "lg";
      else if (sumPadding >= 20) settings.size = "md";
      else settings.size = "sm";
      let align = "justify";
      if (node.layoutSizingHorizontal === "FILL") align = "justify";
      else if (node.primaryAxisAlignItems === "CENTER") align = "center";
      else if (node.primaryAxisAlignItems === "MAX") align = "right";
      else align = "left";
      settings.align = align;
      let vectorNodes = [];
      if ("findAll" in node) {
        vectorNodes = node.findAll((n) => n.type === "VECTOR" || n.type === "BOOLEAN_OPERATION");
      }
      const specificIconVector = vectorNodes.find((n) => getNodeRole2(n) === "icon");
      if (specificIconVector) vectorNodes = [specificIconVector];
      if (vectorNodes.length > 0) {
        const vector = vectorNodes[0];
        const detectedIconName = getFontAwesomeName(vector);
        if (detectedIconName) {
          settings.selected_icon = {
            value: detectedIconName,
            library: detectedIconName.startsWith("fab") ? "fa-brands" : detectedIconName.startsWith("far") ? "fa-regular" : "fa-solid"
          };
          if (textNodes.length > 0 && vector.x > textNodes[0].x) {
            settings.icon_align = "right";
          } else {
            settings.icon_align = "left";
          }
          settings.icon_indent = { size: node.itemSpacing || 5, unit: "px" };
        }
      }
      if (node.reactions && node.reactions.length > 0) {
        const reaction = node.reactions.find((r) => r.action && r.action.type === "URL");
        if (reaction) {
          settings.link = { url: reaction.action.url, is_external: true };
        }
      }
    } catch (err) {
      console.error("Erro cr\xEDtico extraindo button, ignorando componente:", err);
      return null;
    }
  } else if (tag === "accordion") {
    const { items, titleStyle, contentStyle } = await buildAccordionItems(node, maps);
    settings.tabs = items.length > 0 ? items : [
      {
        tab_title: "Accordion #1",
        tab_content: "Conte\xFAdo do accordion"
      }
    ];
    settings.selected_icon = { value: "fas fa-plus", library: "fa-solid" };
    settings.selected_active_icon = { value: "fas fa-minus", library: "fa-solid" };
    settings.title_html_tag = "div";
    settings.icon_align = "left";
    if (titleStyle && titleStyle.color) settings.title_color = titleStyle.color;
    if (titleStyle && titleStyle.globalColorId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.title_color = `globals/colors?id=${titleStyle.globalColorId}`;
    }
    if (titleStyle && titleStyle.globalTypoId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.title_typography_typography = `globals/typography?id=${titleStyle.globalTypoId}`;
    }
    if (titleStyle) {
      applyTypographySettings(settings, titleStyle, "title_typography");
    }
    if (contentStyle && contentStyle.color) settings.content_color = contentStyle.color;
    if (contentStyle && contentStyle.globalColorId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.content_color = `globals/colors?id=${contentStyle.globalColorId}`;
    }
    if (contentStyle && contentStyle.globalTypoId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.content_typography_typography = `globals/typography?id=${contentStyle.globalTypoId}`;
    }
    if (contentStyle) {
      applyTypographySettings(settings, contentStyle, "content_typography");
    }
  } else if (tag === "accordeon") {
    const { items, elements, titleStyle } = await buildAccordeonItems(node, maps);
    settings.items = items.length > 0 ? items : [
      {
        item_title: "Item #1",
        element_css_id: ""
      },
      {
        item_title: "Item #2",
        element_css_id: ""
      }
    ];
    settings.accordion_item_title_icon = { value: "fas fa-plus", library: "fa-solid" };
    settings.accordion_item_title_icon_active = { value: "fas fa-minus", library: "fa-solid" };
    settings.accordion_item_title_icon_position = "start";
    settings.accordion_item_title_position_horizontal = "stretch";
    settings.title_tag = "div";
    settings.faq_schema = "no";
    settings.default_state = "expanded";
    settings.max_items_expended = "one";
    settings.n_accordion_animation_duration = { unit: "ms", size: 400 };
    if (titleStyle && titleStyle.color) settings.normal_title_color = titleStyle.color;
    if (titleStyle && titleStyle.globalColorId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.normal_title_color = `globals/colors?id=${titleStyle.globalColorId}`;
    }
    if (titleStyle && titleStyle.globalTypoId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.title_typography_typography = `globals/typography?id=${titleStyle.globalTypoId}`;
    }
    if (titleStyle) {
      applyTypographySettings(settings, titleStyle, "title_typography");
    }
    applyOpacitySetting(settings, node);
    applySourceMetadata(settings, node, tag);
    applyNodeEffects(settings, node, "nested-accordion");
    return {
      elType: "widget",
      widgetType: "nested-accordion",
      settings,
      elements: elements.length > 0 ? elements : [
        {
          elType: "container",
          settings: {
            _title: "item #1",
            content_width: "full"
          },
          elements: []
        },
        {
          elType: "container",
          settings: {
            _title: "item #2",
            content_width: "full"
          },
          elements: []
        }
      ]
    };
  } else if (tag === "image") {
    settings.image = { url: "", id: "" };
    settings._width = { size: node.width, unit: "px" };
  } else if (tag === "image-carousel") {
    const iterableNodes = getIterableNodes(node);
    const carouselItems = [];
    for (const child of iterableNodes) {
      if (child.type === "IMAGE" || hasImageFill(child) || child.type === "RECTANGLE" || child.type === "FRAME") {
        carouselItems.push({ id: child.id || "", url: "" });
      } else {
        carouselItems.push({ id: "", url: "" });
      }
    }
    if (carouselItems.length === 0) carouselItems.push({ id: "", url: "" });
    settings.carousel = carouselItems;
    settings.slides_to_show = "3";
    settings.slides_to_scroll = "1";
    settings.navigation = "both";
    settings.image_size = "full";
  } else if (tag === "container-carousel") {
    const iterableNodes = getIterableNodes(node);
    const elements = [];
    for (const child of iterableNodes) {
      const res = applyChildFillSizing(child, await traverseNode(child, false, maps, true));
      if (res) {
        if (Array.isArray(res)) {
          elements.push({ elType: "container", settings: {}, elements: res });
        } else if (res.elType !== "container") {
          elements.push({ elType: "container", settings: {}, elements: [res] });
        } else {
          elements.push(res);
        }
      }
    }
    settings.slides_to_show = "3";
    settings.slides_to_scroll = "1";
    settings.navigation = "both";
    applyOpacitySetting(settings, node);
    applySourceMetadata(settings, node, tag);
    applyNodeEffects(settings, node, "nested-carousel");
    return {
      elType: "widget",
      widgetType: "nested-carousel",
      settings,
      elements
    };
  }
  applyOpacitySetting(settings, node);
  applySourceMetadata(settings, node, tag);
  applyNodeEffects(settings, node, tag);
  return { elType: "widget", widgetType: tag, settings };
}
async function mapContainer(node, children, isRoot, isForcedFull, maps, allowEmpty = false) {
  try {
    if (!children || children.length === 0 && !allowEmpty) return null;
    const bgSettings = await extractBackground(node, maps);
    const direction = getLayoutDirection(node);
    let containerWidth = { size: 100, unit: "%" };
    if (isForcedFull) {
      containerWidth = { size: 100, unit: "%" };
    } else if (isRoot) {
      containerWidth = { size: 100, unit: "%" };
    } else {
      if (node.layoutSizingHorizontal === "FIXED") {
        containerWidth = { size: node.width, unit: "px" };
      } else if (node.layoutSizingHorizontal === "FILL") {
        containerWidth = { size: 100, unit: "%" };
      } else {
        containerWidth = { size: node.width, unit: "px" };
      }
    }
    let justifyContent = "flex-start";
    if (node.primaryAxisAlignItems === "CENTER") justifyContent = "center";
    else if (node.primaryAxisAlignItems === "MAX") justifyContent = "flex-end";
    else if (node.primaryAxisAlignItems === "SPACE_BETWEEN") justifyContent = "space-between";
    let alignItems = "flex-start";
    if (node.counterAxisAlignItems === "CENTER") alignItems = "center";
    else if (node.counterAxisAlignItems === "MAX") alignItems = "flex-end";
    let alignContent = "flex-start";
    if (node.primaryAxisAlignItems === "SPACE_BETWEEN") alignContent = "space-between";
    const settings = {
      width: containerWidth,
      flex_direction: direction,
      justify_content: justifyContent,
      align_items: alignItems,
      align_content: alignContent,
      gap: { column: node.itemSpacing || 0, row: node.itemSpacing || 0, unit: "px" },
      padding: {
        top: node.paddingTop || 0,
        right: isRoot ? 0 : node.paddingRight || 0,
        bottom: node.paddingBottom || 0,
        left: isRoot ? 0 : node.paddingLeft || 0,
        unit: "px"
      }
    };
    if (isRoot && !isForcedFull) {
      settings.content_width = "boxed";
      settings.boxed_width = { size: 1140, unit: "px" };
    } else if (isForcedFull) {
      settings.content_width = "full";
    }
    if (node.layoutSizingVertical === "FIXED" && node.height > 0) {
      settings.min_height = { size: Math.round(node.height), unit: "px" };
    }
    if (direction === "row") {
      settings.flex_wrap = "nowrap";
    }
    if (bgSettings.background_background) {
      settings.background_background = bgSettings.background_background;
      settings.background_color = bgSettings.background_color;
      if (bgSettings.globalColorId) {
        settings.__globals__ = settings.__globals__ || {};
        settings.__globals__.background_color = `globals/colors?id=${bgSettings.globalColorId}`;
      }
    }
    extractBorders(node, settings, false);
    extractShadows(node, settings, false);
    applyOpacitySetting(settings, node);
    applySourceMetadata(settings, node);
    applyNodeEffects(settings, node, "container");
    return { elType: "container", settings, elements: children };
  } catch (err) {
    console.error("Erro cr\xEDtico em mapContainer, ignorando:", err);
    return null;
  }
}
async function mapText(node, maps) {
  try {
    const style = await extractTextStyle(node, maps);
    const widgetType = style.size >= 32 ? "heading" : "text-editor";
    const settings = {
      align: getTextAlign(node)
    };
    applyTypographySettings(settings, style, "typography");
    applyOpacitySetting(settings, node);
    if (style.globalColorId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__[widgetType === "heading" ? "title_color" : "text_color"] = `globals/colors?id=${style.globalColorId}`;
    }
    if (style.globalTypoId) {
      settings.__globals__ = settings.__globals__ || {};
      settings.__globals__.typography_typography = `globals/typography?id=${style.globalTypoId}`;
    }
    extractShadows(node, settings, true);
    applySourceMetadata(settings, node);
    applyNodeEffects(settings, node, widgetType);
    if (widgetType === "heading") {
      settings.title = node.characters;
      if (style.color) settings.title_color = style.color;
    } else {
      settings.editor = node.characters;
      if (style.color) settings.text_color = style.color;
    }
    return { elType: "widget", widgetType, settings };
  } catch (err) {
    console.error("Erro cr\xEDtico em mapText, ignorando:", err);
    return null;
  }
}
async function mapImage(node) {
  const settings = { image: { url: "", id: "" }, align: "center" };
  extractBorders(node, settings, true, "image");
  extractShadows(node, settings, true, "image");
  applyOpacitySetting(settings, node);
  applySourceMetadata(settings, node);
  applyNodeEffects(settings, node, "image");
  return { elType: "widget", widgetType: "image", settings };
}

// src/core/traverse.js
async function traverseNode(node, isRoot, maps = { colorMap: {}, typoMap: {} }, isInsideValidated = false) {
  if (!node || node.visible === false) return null;
  const manualTag = node.getPluginData?.("elementor-tag") || null;
  if (manualTag === "ignore") {
    return null;
  }
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
      const data = applyChildFillSizing(
        child,
        await traverseNode(child, false, maps, passValidated)
      );
      if (data) {
        if (Array.isArray(data)) childrenJSON = childrenJSON.concat(data);
        else childrenJSON.push(data);
      }
    }
    childrenJSON = childrenJSON.filter((item) => item && typeof item === "object" && item.elType);
    if (!isRoot && node.layoutMode === "NONE") return childrenJSON;
    return await mapContainer(node, childrenJSON, isRoot, false, maps);
  }
  return null;
}

// extension/src/contract.js
var ELEMENT_ID_PATTERN = /^[cw][a-z0-9]{6}$/;
var CSS_ID_PATTERN2 = /^[a-z][a-z0-9-]{0,63}$/;
function sanitizeStableCssId(value, fallback) {
  const normalized = String(value || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  if (CSS_ID_PATTERN2.test(normalized)) return normalized;
  return fallback;
}
var SUPPORTED_WIDGET_TYPES = /* @__PURE__ */ new Set([
  "heading",
  "text-editor",
  "button",
  "image",
  "image-box",
  "icon-box",
  "icon-list",
  "accordion",
  "nested-accordion",
  "image-carousel",
  "nested-carousel"
]);
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function containsAssetRef(value) {
  if (!value || typeof value !== "object") return false;
  if (typeof value.assetRef === "string") return true;
  if (Array.isArray(value)) return value.some(containsAssetRef);
  return Object.values(value).some(containsAssetRef);
}
function validateNativeMedia(value, path, errors, options = {}) {
  if (!isPlainObject(value)) {
    errors.push(`${path} deve ser um objeto de m\xEDdia nativo do Elementor.`);
    return;
  }
  if (containsAssetRef(value)) errors.push(`${path} n\xE3o pode conter assetRef do Figmentor.`);
  const { requireNativeMedia = true } = options;
  if (requireNativeMedia && !(value.url && value.id && typeof value.url === "string" && (typeof value.id === "string" || typeof value.id === "number"))) {
    errors.push(`${path} deve conter id e url nativos.`);
  }
}
function validateNativeIcon(value, path, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${path} deve ser um \xEDcone nativo do Elementor.`);
    return;
  }
  if (value.library === "svg") {
    if (!isPlainObject(value.value) || !value.value.id || !value.value.url) {
      errors.push(`${path} n\xE3o pode usar SVG sem id e url de m\xEDdia v\xE1lidos.`);
    }
    return;
  }
  if (typeof value.library !== "string" || !value.library || typeof value.value !== "string" || !value.value.trim()) {
    errors.push(`${path} deve conter value e library v\xE1lidos.`);
  }
}
function validateAssetMetadata(metadata, path, errors, warnings) {
  if (!isPlainObject(metadata)) {
    errors.push(`${path} deve ser um objeto separado dos campos nativos.`);
    return;
  }
  const entries = [];
  for (const [key, value] of Object.entries(metadata)) {
    const items = Array.isArray(value) ? value : [value];
    items.forEach(
      (item, index) => entries.push({ key, item, path: `${path}.${key}${Array.isArray(value) ? `[${index}]` : ""}` })
    );
  }
  for (const entry of entries) {
    if (!isPlainObject(entry.item) || typeof entry.item.assetRef !== "string") {
      errors.push(`${entry.path}.assetRef \xE9 obrigat\xF3rio.`);
      continue;
    }
    if (entry.item.status === "uploaded" && (!entry.item.mediaId || !entry.item.mediaUrl)) {
      errors.push(`${entry.path} est\xE1 marcado como uploaded sem mediaId/mediaUrl.`);
    }
    if (entry.item.status === "failed")
      warnings.push(`${entry.path} depende de a\xE7\xE3o manual ou retry.`);
  }
}
function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function createElementId(element, path) {
  const prefix = element.elType === "widget" ? "w" : "c";
  const hash = stableHash(`${path}:${element.elType}:${element.widgetType || "container"}`).toString(36).padStart(6, "0").slice(-6);
  return `${prefix}${hash}`;
}
function uniqueCssId(value, seen) {
  if (typeof value !== "string" || !value) return value;
  const base = value.slice(0, 64);
  let candidate = base;
  let suffixIndex = 1;
  while (seen.has(candidate)) {
    suffixIndex += 1;
    const suffix = `-${suffixIndex}`;
    candidate = `${base.slice(0, 64 - suffix.length)}${suffix}`;
  }
  seen.add(candidate);
  return candidate;
}
function normalizeWidgetType(widgetType) {
  if (widgetType === "accordeon") return "nested-accordion";
  if (widgetType === "container-carousel") return "nested-carousel";
  return widgetType;
}
function normalizeElements(value, depth, parentPath, seenCssIds, seenIds) {
  const input = Array.isArray(value) ? value : value ? [value] : [];
  const result = [];
  for (const item of input) {
    if (Array.isArray(item)) {
      result.push(...normalizeElements(item, depth, parentPath, seenCssIds, seenIds));
      continue;
    }
    if (!isPlainObject(item)) continue;
    const index = result.length;
    const path = `${parentPath}.${index}`;
    const legacyBackground = item.elType === "widget" && ["image-background", "background-image"].includes(item.widgetType);
    const normalized = {
      ...item,
      elType: legacyBackground || item.elType === "container" ? "container" : "widget",
      widgetType: legacyBackground ? void 0 : item.elType === "widget" ? normalizeWidgetType(item.widgetType) : void 0,
      settings: isPlainObject(item.settings) ? { ...item.settings } : {},
      isInner: depth > 0
    };
    if (normalized.elType === "container") delete normalized.widgetType;
    if (legacyBackground) normalized.settings.background_background ||= "classic";
    const requestedId = typeof item.id === "string" ? item.id : "";
    normalized.id = ELEMENT_ID_PATTERN.test(requestedId) && !seenIds.has(requestedId) ? requestedId : createElementId(normalized, path);
    while (seenIds.has(normalized.id)) {
      normalized.id = createElementId(normalized, `${path}.${seenIds.size}`);
    }
    seenIds.add(normalized.id);
    const requestedCssId = typeof normalized.settings.css_id === "string" ? normalized.settings.css_id : "";
    const fallbackCssId = `figmentor-${normalized.id}`;
    normalized.settings.css_id = uniqueCssId(
      sanitizeStableCssId(requestedCssId, fallbackCssId),
      seenCssIds
    );
    if (normalized.elType === "container" || Array.isArray(item.elements)) {
      normalized.elements = normalizeElements(item.elements, depth + 1, path, seenCssIds, seenIds);
    } else {
      normalized.elements = [];
    }
    result.push(normalized);
  }
  return result;
}
function normalizeElementorDocument(document2, mode = document2?.type === "page" ? "page" : "section") {
  const type = mode === "page" ? "page" : "container";
  const content = normalizeElements(document2?.content, 0, "content", /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set());
  return {
    version: "0.4",
    title: typeof document2?.title === "string" ? document2.title : "Figmentor Export",
    type,
    ...type === "page" ? {
      page_settings: isPlainObject(document2?.page_settings) ? { ...document2.page_settings } : {}
    } : {},
    content
  };
}
function validateElement(element, path, errors, warnings, seenIds, seenCssIds, options = {}) {
  if (!isPlainObject(element)) {
    errors.push(`${path} deve ser um objeto.`);
    return;
  }
  if (!ELEMENT_ID_PATTERN.test(element.id || "")) {
    errors.push(`${path}.id deve ser um ID est\xE1vel v\xE1lido.`);
  } else if (seenIds.has(element.id)) {
    errors.push(`${path}.id est\xE1 duplicado.`);
  } else {
    seenIds.add(element.id);
  }
  if (typeof element.isInner !== "boolean") errors.push(`${path}.isInner deve ser booleano.`);
  if (element.elType !== "container" && element.elType !== "widget") {
    errors.push(`${path}.elType deve ser "container" ou "widget".`);
  }
  if (!isPlainObject(element.settings)) errors.push(`${path}.settings deve ser um objeto.`);
  if (element.elType === "container") {
    if (!Array.isArray(element.elements))
      errors.push(`${path}.elements deve ser um array em containers.`);
  } else {
    if (!SUPPORTED_WIDGET_TYPES.has(element.widgetType)) {
      errors.push(
        `${path}.widgetType "${element.widgetType || ""}" n\xE3o \xE9 um widget Elementor suportado.`
      );
    }
    if (!Array.isArray(element.elements))
      errors.push(`${path}.elements deve ser um array em widgets.`);
  }
  if (Array.isArray(element.elements)) {
    element.elements.forEach((child, index) => {
      validateElement(
        child,
        `${path}.elements[${index}]`,
        errors,
        warnings,
        seenIds,
        seenCssIds,
        options
      );
    });
  }
  const cssId = element.settings?.css_id;
  if (cssId) {
    if (!CSS_ID_PATTERN2.test(cssId))
      errors.push(`${path}.settings.css_id deve ser um identificador CSS seguro.`);
    if (seenCssIds.has(cssId)) errors.push(`${path}.settings.css_id est\xE1 duplicado.`);
    else seenCssIds.add(cssId);
  }
  if (isPlainObject(element.settings)) {
    if (element.settings.image !== void 0)
      validateNativeMedia(element.settings.image, `${path}.settings.image`, errors, options);
    if (element.settings.background_image !== void 0)
      validateNativeMedia(
        element.settings.background_image,
        `${path}.settings.background_image`,
        errors,
        options
      );
    if (element.settings.selected_icon !== void 0)
      validateNativeIcon(element.settings.selected_icon, `${path}.settings.selected_icon`, errors);
    if (element.settings.selected_active_icon !== void 0)
      validateNativeIcon(
        element.settings.selected_active_icon,
        `${path}.settings.selected_active_icon`,
        errors
      );
    if (Array.isArray(element.settings.icon_list)) {
      element.settings.icon_list.forEach((item, index) => {
        if (!isPlainObject(item)) {
          errors.push(`${path}.settings.icon_list[${index}] deve ser um objeto.`);
          return;
        }
        if (typeof item.text !== "string")
          errors.push(`${path}.settings.icon_list[${index}].text deve ser texto.`);
        if (item.selected_icon !== void 0) {
          validateNativeIcon(
            item.selected_icon,
            `${path}.settings.icon_list[${index}].selected_icon`,
            errors
          );
        }
      });
    }
    if (element.settings.figmentor_assets !== void 0 || element.settings.figmentor_source_node_id !== void 0) {
      errors.push(
        `${path}.settings cont\xE9m metadados do Figmentor; use o sidecar document.figmentor.`
      );
    }
    if (element.settings.custom_css !== void 0 && (typeof element.settings.custom_css !== "string" || element.settings.custom_css.length > 2e4 || /<\/?script\b|@import\b/i.test(element.settings.custom_css) || typeof element.settings.custom_css === "string" && (!element.settings.custom_css.includes(`#${element.settings.css_id}`) || (element.settings.custom_css.match(/{/g) || []).length !== (element.settings.custom_css.match(/}/g) || []).length))) {
      errors.push(`${path}.settings.custom_css deve ser CSS texto v\xE1lido e limitado a 20 KB.`);
    }
  }
}
function validateElementorDocument(document2, mode = document2?.type === "page" ? "page" : "section", options = {}) {
  const errors = [];
  const warnings = [];
  const expectedType = mode === "page" ? "page" : "container";
  if (!isPlainObject(document2)) {
    return { valid: false, errors: ["O documento exportado deve ser um objeto."] };
  }
  if (document2.version !== "0.4") errors.push('version deve ser "0.4".');
  if (document2.type !== expectedType)
    errors.push(`type deve ser "${expectedType}" no modo ${mode}.`);
  if (!Array.isArray(document2.content) || document2.content.length === 0) {
    errors.push("content deve conter pelo menos um elemento.");
  }
  if (mode === "page" && !isPlainObject(document2.page_settings)) {
    errors.push("page_settings deve ser um objeto no modo p\xE1gina.");
  }
  if (Array.isArray(document2.content)) {
    const seenIds = /* @__PURE__ */ new Set();
    const seenCssIds = /* @__PURE__ */ new Set();
    document2.content.forEach((element, index) => {
      validateElement(element, `content[${index}]`, errors, warnings, seenIds, seenCssIds, options);
    });
  }
  if (document2.figmentor !== void 0) {
    if (!isPlainObject(document2.figmentor) || !isPlainObject(document2.figmentor.elements)) {
      errors.push("figmentor.elements deve ser um sidecar indexado por ID de elemento.");
    } else {
      for (const [elementId, metadata] of Object.entries(document2.figmentor.elements)) {
        if (!isPlainObject(metadata)) {
          errors.push(`figmentor.elements.${elementId} deve ser um objeto.`);
          continue;
        }
        if (metadata.assets !== void 0) {
          validateAssetMetadata(
            metadata.assets,
            `figmentor.elements.${elementId}.assets`,
            errors,
            warnings
          );
        }
      }
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

// extension/src/figma-rest-adapter.js
var TAG_PATTERN2 = /^\[([^\]]+)\]/;
function pluginValue(node, key, pluginId) {
  for (const candidate of [node?.pluginData, node?.plugin_data, node?.sharedPluginData]) {
    if (!candidate || typeof candidate !== "object") continue;
    if (typeof candidate[key] === "string") return candidate[key];
    if (pluginId && typeof candidate[pluginId]?.[key] === "string") {
      return candidate[pluginId][key];
    }
    if (typeof candidate.figmentor?.[key] === "string") return candidate.figmentor[key];
  }
  return null;
}
function inferredPluginValue(node, key) {
  const match = String(node?.name || "").match(TAG_PATTERN2);
  if (!match) return "";
  const value = match[1].trim().toLowerCase();
  if (key === "elementor-tag") return FIGMENTOR_TAGS.has(value) ? value : "";
  if (key !== "elementor_role") return "";
  if (value === "title") return "title_text";
  if (value === "description") return "description_text";
  return ["icon", "image"].includes(value) ? value : "";
}
function fontStyleName(style = {}) {
  const weights = {
    100: "Thin",
    200: "Extra Light",
    300: "Light",
    400: "Regular",
    500: "Medium",
    600: "Semi Bold",
    700: "Bold",
    800: "Extra Bold",
    900: "Black"
  };
  const base = weights[Math.round(Number(style.fontWeight || 400) / 100) * 100] || "Regular";
  return style.italic ? `${base} Italic` : base;
}
function lineHeight(style = {}) {
  if (Number.isFinite(style.lineHeightPx)) return { unit: "PIXELS", value: style.lineHeightPx };
  if (Number.isFinite(style.lineHeightPercentFontSize)) {
    return { unit: "PERCENT", value: style.lineHeightPercentFontSize };
  }
  return { unit: "AUTO" };
}
function letterSpacing(style = {}) {
  return {
    unit: "PIXELS",
    value: Number.isFinite(style.letterSpacing) ? style.letterSpacing : 0
  };
}
function attachSearchMethods(node) {
  Object.defineProperties(node, {
    findAll: {
      enumerable: false,
      value(predicate) {
        const result = [];
        const visit = (current) => {
          for (const child of current.children || []) {
            if (predicate(child)) result.push(child);
            visit(child);
          }
        };
        visit(this);
        return result;
      }
    },
    findOne: {
      enumerable: false,
      value(predicate) {
        const stack = [...this.children || []];
        while (stack.length) {
          const current = stack.shift();
          if (predicate(current)) return current;
          stack.unshift(...current.children || []);
        }
        return null;
      }
    }
  });
  return node;
}
function adaptRestNode(source, pluginId) {
  if (!source || typeof source !== "object") return source;
  const style = source.style || {};
  const bounds = source.absoluteBoundingBox || source.size || {};
  const radii = Array.isArray(source.rectangleCornerRadii) ? source.rectangleCornerRadii : [];
  const adapted = {
    ...source,
    __figmentorRest: true,
    visible: source.visible !== false,
    width: Number.isFinite(source.width) ? source.width : Number(bounds.width ?? bounds.x ?? 0),
    height: Number.isFinite(source.height) ? source.height : Number(bounds.height ?? bounds.y ?? 0),
    x: Number.isFinite(source.x) ? source.x : Number(source.absoluteBoundingBox?.x || 0),
    y: Number.isFinite(source.y) ? source.y : Number(source.absoluteBoundingBox?.y || 0),
    cornerRadius: source.cornerRadius ?? (radii.length && radii.every((value) => value === radii[0]) ? radii[0] : void 0),
    topLeftRadius: source.topLeftRadius ?? radii[0],
    topRightRadius: source.topRightRadius ?? radii[1],
    bottomRightRadius: source.bottomRightRadius ?? radii[2],
    bottomLeftRadius: source.bottomLeftRadius ?? radii[3],
    fontName: source.fontName || (style.fontFamily ? { family: style.fontFamily, style: fontStyleName(style) } : void 0),
    fontSize: source.fontSize ?? style.fontSize,
    lineHeight: source.lineHeight || lineHeight(style),
    letterSpacing: source.letterSpacing || letterSpacing(style),
    textCase: source.textCase ?? style.textCase,
    textDecoration: source.textDecoration ?? style.textDecoration,
    textAlignHorizontal: source.textAlignHorizontal ?? style.textAlignHorizontal,
    children: (source.children || []).map((child) => adaptRestNode(child, pluginId))
  };
  Object.defineProperty(adapted, "getPluginData", {
    enumerable: false,
    value(key) {
      const directValue = pluginValue(source, key, pluginId);
      if (directValue) return directValue;
      if (key === "elementor-tag" && pluginValue(source, "elementor_role", pluginId)) return "";
      return inferredPluginValue(source, key);
    }
  });
  return attachSearchMethods(adapted);
}
function buildRestStyleMaps(root) {
  const styles = root?.__figmentorStyles || {};
  return {
    colorMap: {},
    typoMap: {},
    styleNameMap: Object.fromEntries(
      Object.entries(styles).map(([id, value]) => [id, value?.name || ""])
    )
  };
}

// extension/src/elementor.js
var VECTOR_TYPES2 = /* @__PURE__ */ new Set(["VECTOR", "BOOLEAN_OPERATION"]);
var SVG_FALLBACK_ICON = Object.freeze({ value: "fas fa-check", library: "fa-solid" });
function fallbackIcon() {
  return { ...SVG_FALLBACK_ICON };
}
function uploadedSvgIcon(asset) {
  if (asset?.status === "uploaded" && asset.mediaId && asset.mediaUrl) {
    return {
      value: { id: asset.mediaId, url: asset.mediaUrl },
      library: "svg"
    };
  }
  return fallbackIcon();
}
function assetRef(nodeId, kind) {
  return `figmentor-${String(nodeId).replace(/[^a-zA-Z0-9-]/g, "-")}-${kind}`;
}
function assetMetadata(node, kind, nativeField) {
  return {
    assetRef: assetRef(node.id, kind),
    figmaNodeId: node.id,
    kind,
    nativeField,
    status: "pending"
  };
}
function descendants(node, predicate) {
  const result = [];
  walkNodes(node, (child) => {
    if (child !== node && predicate(child)) result.push(child);
  });
  return result;
}
function nativeImage() {
  return { id: "", url: "", size: "full" };
}
function bindIcon(settings, source, pluginId) {
  const vectors = descendants(source, (node) => VECTOR_TYPES2.has(node.type));
  const explicit = vectors.find((node) => getNodeRole(node, pluginId) === "icon");
  const iconNode = explicit || vectors[0];
  if (!iconNode) return;
  const fontAwesome = getFontAwesomeIcon(iconNode);
  if (fontAwesome) {
    settings.selected_icon = fontAwesome;
    return;
  }
  settings.selected_icon = fallbackIcon();
  settings.figmentor_assets.selected_icon = assetMetadata(iconNode, "icon", "selected_icon");
}
function bindIconList(settings, source) {
  const vectors = descendants(source, (node) => VECTOR_TYPES2.has(node.type));
  if (!Array.isArray(settings.icon_list) || !vectors.length) return;
  settings.figmentor_assets.icon_list = [];
  settings.icon_list = settings.icon_list.map((item, index) => {
    const iconNode = vectors[index] || vectors[0];
    const fontAwesome = getFontAwesomeIcon(iconNode);
    if (fontAwesome) return { ...item, selected_icon: fontAwesome };
    settings.figmentor_assets.icon_list.push({
      ...assetMetadata(iconNode, "icon", "icon_list"),
      index
    });
    return {
      ...item,
      selected_icon: fallbackIcon()
    };
  });
}
function bindElementAssets(element, sourceMap, pluginId, sidecar) {
  const settings = element?.settings;
  const source = settings?.figmentor_source_node_id ? sourceMap.get(settings.figmentor_source_node_id) : null;
  if (source) {
    const tag = settings.figmentor_source_tag || getNodeTag(source, pluginId);
    settings.figmentor_assets = settings.figmentor_assets || {};
    if (element.widgetType === "image" || element.widgetType === "image-box" || tag === "image") {
      settings.image = nativeImage();
      settings.figmentor_assets.image = assetMetadata(source, "image", "image");
    }
    if (element.elType === "container" && ["image-background", "background-image"].includes(tag)) {
      settings.background_background = "classic";
      settings.background_image = nativeImage();
      settings.background_position = settings.background_position || "center center";
      settings.background_repeat = settings.background_repeat || "no-repeat";
      settings.background_size = settings.background_size || "cover";
      settings.figmentor_assets.background_image = assetMetadata(
        source,
        "background",
        "background_image"
      );
    }
    if (element.widgetType === "image-carousel" && Array.isArray(settings.carousel)) {
      const children = source.children?.length ? source.children : [source];
      settings.carousel = children.map(() => nativeImage());
      settings.figmentor_assets.carousel = children.map((node, index) => ({
        ...assetMetadata(node, "carousel", "carousel"),
        index
      }));
    }
    if (["icon-box", "button"].includes(element.widgetType)) bindIcon(settings, source, pluginId);
    if (element.widgetType === "icon-list") bindIconList(settings, source);
    sidecar[element.id] = {
      sourceNodeId: settings.figmentor_source_node_id,
      sourceTag: tag || null,
      assets: settings.figmentor_assets
    };
    delete settings.figmentor_source_node_id;
    delete settings.figmentor_source_tag;
    if (Object.keys(settings.figmentor_assets).length === 0) delete sidecar[element.id].assets;
    delete settings.figmentor_assets;
  }
  (element?.elements || []).forEach(
    (child) => bindElementAssets(child, sourceMap, pluginId, sidecar)
  );
}
function sanitizeUnsupportedPositioning(elements) {
  for (const element of elements || []) {
    if (element?.settings) {
      for (const key of [
        "_position",
        "position",
        "margin",
        "_margin",
        "_offset_x",
        "_offset_y",
        "_z_index",
        "offset_x",
        "offset_y"
      ])
        delete element.settings[key];
    }
    sanitizeUnsupportedPositioning(element?.elements);
  }
}
function collectEffectMetadata(elements, items = []) {
  for (const element of elements || []) {
    const report = element?.settings?.figmentor_effects;
    if (report) {
      items.push({
        elementId: element.id,
        widgetType: element.elType === "widget" ? element.widgetType : "container",
        cssId: element.settings.css_id || null,
        ...report
      });
      delete element.settings.figmentor_effects;
    }
    collectEffectMetadata(element?.elements, items);
  }
  return items;
}
async function buildElementorDocument(root, mode, pluginId) {
  const adaptedRoot = adaptRestNode(root, pluginId);
  const mapped = await traverseNode(adaptedRoot, true, buildRestStyleMaps(root));
  const type = mode === "page" ? "page" : "container";
  const content = Array.isArray(mapped) ? mapped : mapped ? [mapped] : [];
  sanitizeUnsupportedPositioning(content);
  const document2 = normalizeElementorDocument(
    {
      version: "0.4",
      title: `${type === "page" ? "Page" : "Container"} Export - ${root.name || root.id}`,
      type,
      ...type === "page" ? { page_settings: {} } : {},
      content
    },
    mode
  );
  const sourceMap = /* @__PURE__ */ new Map();
  walkNodes(root, (node) => sourceMap.set(node.id, node));
  const sidecar = {};
  const effectsSummary = summarizeEffects(document2.content);
  const effects = collectEffectMetadata(document2.content);
  document2.content.forEach((element) => bindElementAssets(element, sourceMap, pluginId, sidecar));
  document2.figmentor = {
    version: "0.3",
    selectorProfile: ELEMENTOR_SELECTOR_PROFILE,
    customCssControl: "custom_css",
    effects: {
      summary: effectsSummary,
      items: effects
    },
    elements: sidecar
  };
  return document2;
}
function uploadedMedia(asset) {
  return {
    id: asset?.mediaId || "",
    url: asset?.mediaUrl || "",
    size: "full"
  };
}
function patchMetadata(metadata, assetMap) {
  if (!metadata?.assetRef) return metadata;
  const asset = assetMap.get(metadata.assetRef);
  if (!asset) return metadata;
  return {
    ...metadata,
    status: asset.status || "pending",
    mediaId: asset.mediaId || null,
    mediaUrl: asset.mediaUrl || null,
    error: asset.error || null
  };
}
function patchElement(element, assetMap, sidecar) {
  const settings = element?.settings;
  const elementMetadata = sidecar?.[element?.id];
  const metadata = elementMetadata?.assets;
  if (metadata) {
    if (metadata.image) {
      const asset = assetMap.get(metadata.image.assetRef);
      settings.image = uploadedMedia(asset);
      metadata.image = patchMetadata(metadata.image, assetMap);
    }
    if (metadata.background_image) {
      const asset = assetMap.get(metadata.background_image.assetRef);
      settings.background_image = uploadedMedia(asset);
      metadata.background_image = patchMetadata(metadata.background_image, assetMap);
    }
    if (Array.isArray(metadata.carousel)) {
      metadata.carousel = metadata.carousel.map((item) => patchMetadata(item, assetMap));
      settings.carousel = metadata.carousel.map(
        (item) => uploadedMedia(assetMap.get(item.assetRef))
      );
    }
    if (metadata.selected_icon) {
      const asset = assetMap.get(metadata.selected_icon.assetRef);
      settings.selected_icon = uploadedSvgIcon(asset);
      metadata.selected_icon = patchMetadata(metadata.selected_icon, assetMap);
    }
    if (Array.isArray(metadata.icon_list) && Array.isArray(settings.icon_list)) {
      metadata.icon_list = metadata.icon_list.map((item) => patchMetadata(item, assetMap));
      for (const item of metadata.icon_list) {
        const asset = assetMap.get(item.assetRef);
        if (!settings.icon_list[item.index]) continue;
        settings.icon_list[item.index].selected_icon = uploadedSvgIcon(asset);
      }
    }
  }
  (element?.elements || []).forEach((child) => patchElement(child, assetMap, sidecar));
}
function patchElementorAssets(document2, manifest) {
  const patched = JSON.parse(JSON.stringify(document2));
  const assetMap = new Map((manifest?.assets || []).map((asset) => [asset.assetRef, asset]));
  const sidecar = patched.figmentor?.elements || {};
  patched.content?.forEach((element) => patchElement(element, assetMap, sidecar));
  return patched;
}

// extension/src/webp.js
function defaultCanvasFactory(width, height) {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(width, height);
  if (typeof document !== "undefined") {
    return Object.assign(document.createElement("canvas"), { width, height });
  }
  throw new Error("A convers\xE3o para WebP precisa ser executada em um navegador.");
}
function defaultBitmapFactory(blob) {
  if (typeof createImageBitmap !== "function") {
    throw new Error("A convers\xE3o para WebP precisa ser executada em um navegador.");
  }
  return createImageBitmap(blob);
}
function encodeCanvas(canvas, quality) {
  if (typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type: "image/webp", quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("O navegador n\xE3o conseguiu gerar o WebP.")),
      "image/webp",
      quality
    );
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
async function convertPngBlobToWebp(pngBlob, options = {}) {
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
      if (!context) throw new Error("O navegador n\xE3o criou o contexto 2D para o WebP.");
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
  if (!best) throw new Error("O navegador n\xE3o conseguiu gerar uma imagem WebP.");
  return {
    ok: false,
    ...best,
    targetBytes: maxBytes,
    resized: best.scale !== 1,
    reason: `A melhor vers\xE3o gerada ficou com ${best.bytes} bytes, acima do limite de ${maxBytes} bytes.`
  };
}

// extension/src/wordpress.js
function normalizeRestRoot(value, origin) {
  const fallback = `${origin.replace(/\/$/, "")}/wp-json/`;
  if (!value || typeof value !== "string") return fallback;
  return value.endsWith("/") ? value : `${value}/`;
}
function extractWordPressContext(probe = {}) {
  const origin = (() => {
    try {
      return new URL(probe.href || "").origin;
    } catch {
      return "";
    }
  })();
  return {
    tabId: probe.tabId || null,
    href: probe.href || "",
    title: probe.title || "",
    isWordPress: Boolean(probe.isWordPress),
    isElementor: Boolean(probe.isElementor),
    postId: probe.postId ? String(probe.postId) : null,
    nonce: typeof probe.nonce === "string" && probe.nonce ? probe.nonce : null,
    restRoot: normalizeRestRoot(probe.restRoot, origin),
    elementorNonce: typeof probe.elementorNonce === "string" && probe.elementorNonce ? probe.elementorNonce : null,
    elementorAjaxUrl: typeof probe.elementorAjaxUrl === "string" && probe.elementorAjaxUrl ? probe.elementorAjaxUrl : origin ? `${origin}/wp-admin/admin-ajax.php` : null,
    elementorVersion: probe.elementorVersion || null,
    postStatus: typeof probe.postStatus === "string" ? probe.postStatus : probe.postStatus?.value || null,
    postType: probe.postType || "page",
    postRestBase: probe.postRestBase || (probe.postType === "post" ? "posts" : "pages")
  };
}
function validateWordPressContext(context, options = {}) {
  if (!context?.isWordPress) throw new Error("A aba ativa n\xE3o parece ser um painel WordPress.");
  if (!context.nonce)
    throw new Error("N\xE3o foi poss\xEDvel encontrar o nonce REST do WordPress nesta aba.");
  if (options.requireElementor !== false) {
    if (!context.isElementor) throw new Error("A aba ativa n\xE3o parece ser o editor Elementor.");
    if (!context.postId)
      throw new Error("N\xE3o foi poss\xEDvel identificar o post aberto no Elementor.");
    if (!context.elementorNonce || !context.elementorAjaxUrl) {
      throw new Error(
        "N\xE3o foi poss\xEDvel encontrar o endpoint e o nonce de salvamento do Elementor."
      );
    }
  }
  return context;
}
async function probeWordPressTab(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      const parseAssignedText = (text, variableName) => {
        const markerIndex = text.indexOf(`${variableName} =`);
        if (markerIndex < 0) return null;
        const start = text.indexOf("{", markerIndex);
        if (start < 0) return null;
        let depth = 0;
        let quote = "";
        let escaped = false;
        for (let index = start; index < text.length; index += 1) {
          const character = text[index];
          if (quote) {
            if (escaped) escaped = false;
            else if (character === "\\") escaped = true;
            else if (character === quote) quote = "";
            continue;
          }
          if (character === '"' || character === "'") {
            quote = character;
            continue;
          }
          if (character === "{") depth += 1;
          if (character === "}") {
            depth -= 1;
            if (depth === 0) {
              try {
                return JSON.parse(text.slice(start, index + 1));
              } catch {
                return null;
              }
            }
          }
        }
        return null;
      };
      const parseAssignedObject = (scriptId, variableName) => parseAssignedText(document.getElementById(scriptId)?.textContent || "", variableName);
      const common = window.elementorCommonConfig || parseAssignedObject("elementor-common-js-before", "elementorCommonConfig") || {};
      const editor = window.ElementorConfig || parseAssignedObject("elementor-editor-js-before", "ElementorConfig") || {};
      const wpApiScript = [...document.scripts].map((script) => script.textContent || "").find((text) => text.includes("wpApiSettings =")) || "";
      const parsedWpApi = window.wpApiSettings || parseAssignedText(wpApiScript, "wpApiSettings") || {};
      const initialDocument = editor.initial_document || editor.document || {};
      const postFromUrl = new URL(location.href).searchParams.get("post");
      const postType = initialDocument.post_type || String(initialDocument.type || "wp-page").replace(/^wp-/, "");
      const status = initialDocument.status?.value || initialDocument.settings?.settings?.post_status || initialDocument.settings?.controls?.post_status?.default || null;
      return {
        href: location.href,
        title: document.title,
        isWordPress: Boolean(
          parsedWpApi?.nonce || document.body?.classList.contains("wp-admin") || document.querySelector("#wpadminbar, #wpbody-content")
        ),
        isElementor: Boolean(
          initialDocument.id || document.body?.classList.contains("elementor-editor-active") || document.querySelector("#elementor-editor-wrapper")
        ),
        postId: initialDocument.id || postFromUrl || null,
        nonce: parsedWpApi?.nonce || document.querySelector('meta[name="wp-rest-nonce"]')?.content || null,
        restRoot: parsedWpApi?.root || `${location.origin}/wp-json/`,
        elementorNonce: common.ajax?.nonce || null,
        elementorAjaxUrl: common.ajax?.url || `${location.origin}/wp-admin/admin-ajax.php`,
        elementorVersion: common.version || initialDocument.version || null,
        postStatus: status,
        postType,
        postRestBase: postType === "post" ? "posts" : postType === "page" ? "pages" : postType
      };
    }
  });
  return extractWordPressContext({ ...results[0]?.result || {}, tabId });
}
function buildElementorSavePayload(document2, existingElements = [], mode = "page", existingSettings = {}) {
  const schemaMode = document2?.type === "page" ? "page" : "section";
  const validation = validateElementorDocument(document2, schemaMode);
  if (!validation.valid) {
    throw new Error(
      `O documento n\xE3o pode ser enviado ao Elementor:
${validation.errors.join("\n")}`
    );
  }
  const incomingElements = Array.isArray(document2?.content) ? document2.content : [];
  const elements = mode === "section" ? [...Array.isArray(existingElements) ? existingElements : [], ...incomingElements] : incomingElements;
  return {
    status: "draft",
    elements,
    settings: mode === "section" ? { ...existingSettings || {}, ...document2?.page_settings || {} } : { ...document2?.page_settings || {} }
  };
}
function buildElementorAjaxBody(context, requestId, action, data = {}) {
  validateWordPressContext(context);
  return new URLSearchParams({
    action: "elementor_ajax",
    editor_post_id: String(context.postId),
    _nonce: context.elementorNonce,
    actions: JSON.stringify({
      [requestId]: {
        action,
        data
      }
    })
  }).toString();
}
async function executeElementorAjax(tabId, context, requestId, action, data = {}) {
  const body = buildElementorAjaxBody(context, requestId, action, data);
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [{ url: context.elementorAjaxUrl, body }],
    func: async ({ url, body: requestBody }) => {
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: requestBody
      });
      const text = await response.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      return {
        ok: response.ok,
        status: response.status,
        json,
        text: json ? "" : text.slice(0, 500)
      };
    }
  });
  const transport = results[0]?.result;
  if (!transport?.ok || !transport.json) {
    throw new Error(
      `O Elementor respondeu ${transport?.status || "sem status"}: ${transport?.text || "resposta inv\xE1lida"}`
    );
  }
  if (transport.json.success !== true) {
    throw new Error(
      transport.json?.data?.message || "O endpoint do Elementor recusou a requisi\xE7\xE3o."
    );
  }
  const actionResponse = transport.json?.data?.responses?.[requestId];
  if (!actionResponse || actionResponse.success !== true) {
    const detail = actionResponse?.data?.message || actionResponse?.data || actionResponse?.message || "A a\xE7\xE3o do Elementor falhou.";
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return actionResponse.data;
}
function snapshotFromConfig(config = {}) {
  const document2 = config.document || config.config?.document || config;
  const elementEnvelope = document2.elements || config.elements || [];
  const elements = Array.isArray(elementEnvelope) ? elementEnvelope : elementEnvelope?.data || [];
  const settingsEnvelope = document2.settings || config.settings || {};
  const settings = settingsEnvelope?.settings || settingsEnvelope;
  const rawStatus = document2.status || config.status || null;
  return {
    elements: Array.isArray(elements) ? elements : [],
    settings: settings && typeof settings === "object" ? settings : {},
    status: typeof rawStatus === "string" ? rawStatus : rawStatus?.value || null
  };
}
function collectElementIds(elements, result = []) {
  for (const element of elements || []) {
    if (element?.id) result.push(element.id);
    collectElementIds(element?.elements, result);
  }
  return result;
}
function collectMediaIds(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if ((typeof value.id === "number" || /^\d+$/.test(String(value.id || ""))) && typeof value.url === "string" && value.url) {
    result.push(String(value.id));
  }
  for (const child of Object.values(value)) collectMediaIds(child, result);
  return result;
}
function verifyElementorPersistence(snapshot, expectedElements) {
  const actualIds = new Set(collectElementIds(snapshot?.elements));
  const expectedIds = collectElementIds(expectedElements);
  const missingElementIds = expectedIds.filter((id) => !actualIds.has(id));
  const actualMediaIds = new Set(collectMediaIds(snapshot?.elements));
  const expectedMediaIds = [...new Set(collectMediaIds(expectedElements))];
  const missingMediaIds = expectedMediaIds.filter((id) => !actualMediaIds.has(id));
  return {
    persistent: missingElementIds.length === 0 && missingMediaIds.length === 0,
    elementCount: actualIds.size,
    expectedElementCount: expectedIds.length,
    missingElementIds,
    missingMediaIds
  };
}
async function readElementorDocument(tabId, context) {
  const config = await executeElementorAjax(
    tabId,
    context,
    "figmentor_get_document",
    "get_document_config",
    { id: Number(context.postId) || context.postId }
  );
  return snapshotFromConfig(config);
}
async function insertElementorDocument(tabId, context, document2, mode = "page") {
  validateWordPressContext(context);
  const schemaMode = document2?.type === "page" ? "page" : "section";
  const validation = validateElementorDocument(document2, schemaMode);
  if (!validation.valid) {
    throw new Error(
      `O JSON final n\xE3o pode ser enviado ao Elementor:
${validation.errors.join("\n")}`
    );
  }
  const draftResult = await ensureWordPressDraft(tabId, context);
  context = { ...context, postStatus: draftResult.status };
  const before = await readElementorDocument(tabId, context);
  const payload = buildElementorSavePayload(document2, before.elements, mode, before.settings);
  const saveResponse = await executeElementorAjax(
    tabId,
    context,
    "figmentor_save_builder",
    "save_builder",
    payload
  );
  const savedStatus = typeof saveResponse?.status === "string" ? saveResponse.status : saveResponse?.config?.document?.status?.value;
  if (savedStatus !== "draft") {
    throw new Error(
      `O servidor n\xE3o confirmou o status draft (retornou ${savedStatus || "indefinido"}).`
    );
  }
  const after = await readElementorDocument(tabId, context);
  const verification = verifyElementorPersistence(after, payload.elements);
  if (!verification.persistent) {
    throw new Error(
      `O conte\xFAdo n\xE3o foi confirmado ap\xF3s o salvamento. IDs ausentes: ${verification.missingElementIds.join(", ") || "nenhum"}; m\xEDdias ausentes: ${verification.missingMediaIds.join(", ") || "nenhuma"}.`
    );
  }
  return {
    saved: true,
    verified: true,
    status: savedStatus,
    elementCount: payload.elements.length,
    expectedElements: payload.elements,
    verification,
    responseStatus: "ok"
  };
}
async function ensureWordPressDraft(tabId, context) {
  validateWordPressContext(context);
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [
      {
        url: `${context.restRoot}wp/v2/${context.postRestBase}/${context.postId}`,
        nonce: context.nonce
      }
    ],
    func: async ({ url, nonce }) => {
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-WP-Nonce": nonce,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: "draft" })
      });
      const body = await response.json().catch(() => ({}));
      return {
        ok: response.ok,
        httpStatus: response.status,
        status: body.status || null,
        code: body.code || null,
        message: body.message || null
      };
    }
  });
  const result = results[0]?.result;
  if (!result?.ok || result.status !== "draft") {
    throw new Error(
      result?.message || `O WordPress n\xE3o confirmou a mudan\xE7a para rascunho (HTTP ${result?.httpStatus || "indefinido"}, status ${result?.status || "indefinido"}).`
    );
  }
  return result;
}
async function reloadAndVerifyElementorDocument(tabId, context, expectedElements, options = {}) {
  await chrome.tabs.reload(tabId);
  const timeoutMs = options.timeoutMs || 45e3;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const tab2 = await chrome.tabs.get(tabId);
    if (tab2.status === "complete") break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  const tab = await chrome.tabs.get(tabId);
  if (tab.status !== "complete")
    throw new Error("A aba do Elementor n\xE3o terminou de recarregar para a verifica\xE7\xE3o.");
  const refreshedContext = await probeWordPressTab(tabId);
  validateWordPressContext(refreshedContext);
  const snapshot = await readElementorDocument(tabId, refreshedContext);
  const verification = verifyElementorPersistence(snapshot, expectedElements);
  if (!verification.persistent) {
    throw new Error(
      `O conte\xFAdo n\xE3o persistiu ap\xF3s recarregar. IDs ausentes: ${verification.missingElementIds.join(", ") || "nenhum"}; m\xEDdias ausentes: ${verification.missingMediaIds.join(", ") || "nenhuma"}.`
    );
  }
  return { verified: true, context: refreshedContext, verification };
}
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 32768;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}
async function uploadMediaToWordPress(tabId, context, blob, filename, mimeType) {
  validateWordPressContext(context, { requireElementor: false });
  const base64 = arrayBufferToBase64(await blob.arrayBuffer());
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [{ restRoot: context.restRoot, nonce: context.nonce, filename, mimeType, base64 }],
    func: async ({
      restRoot,
      nonce,
      filename: uploadName,
      mimeType: uploadType,
      base64: encoded
    }) => {
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const response = await fetch(`${restRoot}wp/v2/media`, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-WP-Nonce": nonce,
          "Content-Disposition": `attachment; filename="${uploadName.replace(/"/g, "")}"`,
          "Content-Type": uploadType
        },
        body: bytes
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.code || !body.id) {
        const detail = body.message || body.code || `resposta sem ID (${Object.keys(body).join(", ") || "vazia"})`;
        throw new Error(`Upload recusado pelo WordPress: ${detail} [HTTP ${response.status}]`);
      }
      let mediaUrl = body.source_url || body.guid?.rendered || null;
      if (!mediaUrl) {
        const mediaResponse = await fetch(`${restRoot}wp/v2/media/${body.id}?context=edit`, {
          method: "GET",
          credentials: "include",
          headers: { "X-WP-Nonce": nonce }
        });
        const media = await mediaResponse.json().catch(() => ({}));
        mediaUrl = media.source_url || media.guid?.rendered || null;
      }
      return {
        id: body.id,
        source_url: mediaUrl,
        guid: { rendered: mediaUrl },
        mime_type: body.mime_type || uploadType,
        file: body.media_details?.file || uploadName,
        httpStatus: response.status
      };
    }
  });
  return results[0]?.result || null;
}

// extension/popup.js
var $ = (id) => document.getElementById(id);
var workflow = {
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
      name !== screen && (name === "token" ? Boolean($("token").value.trim()) : name === "figma" ? Boolean(workflow.document) : false)
    );
  }
}
function setConnected(connected) {
  const state = $("connection-state");
  state.textContent = connected ? "Figma conectado" : "N\xE3o conectado";
  state.classList.toggle("connected", connected);
}
function updateElementorState() {
  const ready = Boolean(workflow.document && workflow.manifest && workflow.wordpress);
  $("insert-elementor").disabled = !ready;
  $("continue-elementor").disabled = !(workflow.document && workflow.manifest);
  $("retry-assets").disabled = !workflow.manifest?.assets?.some((asset) => asset.status === "failed") || !workflow.wordpress;
  if (workflow.selection) {
    $("elementor-source").textContent = `${workflow.selection.name || workflow.selection.nodeId}
${workflow.manifest.assets.length} asset(s) encontrado(s)`;
  }
}
function updateDownloads() {
  const enabled = Boolean(workflow.document && workflow.manifest);
  $("download-json").disabled = !enabled;
  $("download-manifest").disabled = !enabled;
  $("download-report").disabled = !workflow.report;
}
function createFigmentorReport(manifest, document2) {
  return {
    version: "0.3",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    assets: createAssetReport(manifest),
    effects: document2?.figmentor?.effects || { summary: {}, items: [] }
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
    setStatus("Informe a URL do arquivo Figma ou use a sele\xE7\xE3o da aba Figma.", true, "figma");
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
        name: "Sele\xE7\xE3o indicada pelo link do Figma",
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
            `${selectionError.message}

Fallback do plugin: ${pluginError.message}`
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
    const document2 = await buildElementorDocument(root, mode, pluginId);
    const validation = validateElementorDocument(document2, mode, { requireNativeMedia: false });
    if (!validation.valid) {
      throw new Error(
        `O JSON preparado n\xE3o passou na valida\xE7\xE3o do Elementor:
${validation.errors.join("\n")}`
      );
    }
    const manifest = buildAssetManifest(root, pluginId, resolvedSelection);
    const report = createFigmentorReport(manifest, document2);
    workflow = { ...workflow, selection: resolvedSelection, root, document: document2, manifest, report };
    $("json-output").value = JSON.stringify(document2, null, 2);
    $("summary").classList.add("visible");
    $("summary").textContent = [
      `Frame: ${resolvedSelection.name || resolvedSelection.nodeId}`,
      `Node ID: ${resolvedSelection.nodeId}`,
      `Tipo: ${resolvedSelection.type || "n\xE3o informado"}`,
      `Fonte: ${resolvedSelection.source === "REST_SELECTION" ? "sele\xE7\xE3o atual pela API" : resolvedSelection.source === "PLUGIN_DATA_FALLBACK" ? "registro do plugin" : "link do Figma"}`,
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
    setStatus("A aba ativa n\xE3o parece ser um arquivo Figma.", true);
    return;
  }
  try {
    const parsed = parseFigmaFileUrl(tab.url);
    $("figma-url").value = tab.url;
    setStatus(
      parsed.nodeId ? `Node ID encontrado no link: ${parsed.nodeId}` : "Consultando a sele\xE7\xE3o atual pela API do Figma..."
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
    setStatus("A aba ativa n\xE3o \xE9 uma p\xE1gina HTTPS dispon\xEDvel para o WordPress.", true, "elementor");
    return;
  }
  try {
    const origin = new URL(tab.url).origin;
    const permission = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!permission) {
      setStatus("O acesso tempor\xE1rio a este site foi recusado.", true);
      return;
    }
    const context = extractWordPressContext(await probeWordPressTab(tab.id));
    validateWordPressContext(context);
    workflow.wordpress = { tabId: tab.id, ...context };
    updateElementorState();
    setStatus(
      [
        `WordPress detectado: ${context.title || context.href}`,
        `Elementor detectado: ${context.isElementor ? "sim" : "n\xE3o confirmado"}`,
        "Sess\xE3o e nonce encontrados."
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
    const prefix = item.status === "uploaded" ? "\u2713" : item.status === "failed" ? "\u2715" : "\u2022";
    const details = item.status === "failed" ? ` \u2014 ${item.reason || "falha sem detalhe"}. ${item.action || ""}` : item.mediaId ? ` \u2014 m\xEDdia ${item.mediaId}` : "";
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
        asset.aspectRatio = converted.height > 0 ? Number((converted.width / converted.height).toFixed(4)) : asset.aspectRatio;
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
        throw new Error("O WordPress n\xE3o retornou o ID ou a URL da m\xEDdia.");
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
    setStatus("N\xE3o h\xE1 assets falhos para repetir.", false, "elementor");
    return;
  }
  const destination = workflow.wordpress.title || workflow.wordpress.href;
  const modeLabel = $("elementor-mode").value === "section" ? "adicionar a se\xE7\xE3o ao final" : "substituir o conte\xFAdo da p\xE1gina";
  if (!window.confirm(
    `Confirmar envio para ${destination}?

A extens\xE3o ir\xE1 ${modeLabel}, salvar como rascunho e recarregar a aba para verificar a persist\xEAncia.`
  ))
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
        `O JSON final n\xE3o passou na valida\xE7\xE3o do Elementor:
${validation.errors.join("\n")}`
      );
    }
    const result = await insertElementorDocument(
      workflow.wordpress.tabId,
      workflow.wordpress,
      patchedDocument,
      mode
    );
    setStatus(
      "Servidor confirmou o rascunho. Recarregando a aba para verificar persist\xEAncia...",
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
      `Persist\xEAncia confirmada ap\xF3s recarregar (${reloadResult.verification.elementCount} IDs verificados).`
    ].join("\n");
    await chrome.storage.local.set({
      lastFigmentorResult: {
        savedAt: (/* @__PURE__ */ new Date()).toISOString(),
        source: workflow.selection,
        report
      }
    });
    updateDownloads();
    updateElementorState();
    setStatus(
      "Fluxo completo confirmado: assets, rascunho e persist\xEAncia ap\xF3s reload.",
      false,
      "elementor"
    );
  } catch (error) {
    const report = createFigmentorReport(manifest, workflow.document);
    workflow = { ...workflow, manifest, report };
    $("upload-report").classList.add("visible");
    $("upload-report").textContent = report.assets.length ? formatAssetReport(report.assets).join("\n") : `Nenhum asset foi processado. Efeitos: ${report.effects.summary.total || 0} mapeado(s).`;
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
$("download-json").addEventListener(
  "click",
  () => downloadJson("elementor-template.json", workflow.document)
);
$("download-manifest").addEventListener(
  "click",
  () => downloadJson("figmentor-assets-manifest.json", workflow.manifest)
);
$("download-report").addEventListener(
  "click",
  () => downloadJson("figmentor-report.json", workflow.report)
);
restoreState().catch((error) => setStatus(error.message, true, "token"));
