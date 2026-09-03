import { ASSET_TAGS, FIGMENTOR_TAGS, VECTOR_TYPES } from "./constants.js";

const TAG_PATTERN = /^\[([^\]]+)\]/;

function toNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function slugify(value) {
  return String(value || "asset")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "asset";
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

export function getNodeTag(node, pluginId) {
  const pluginTag = readPluginData(node, "elementor-tag", pluginId);
  if (pluginTag) {
    const normalizedPluginTag = pluginTag.trim().toLowerCase();
    if (FIGMENTOR_TAGS.has(normalizedPluginTag)) return normalizedPluginTag;
  }

  // A role prefix such as [IMAGE] is not a tag when the plugin data explicitly
  // says that the node is an inner role. This keeps role-only nodes out of the
  // Elementor tree while preserving name fallback for genuinely untagged nodes.
  if (readPluginData(node, "elementor_role", pluginId)) return null;

  const match = String(node?.name || "").match(TAG_PATTERN);
  if (!match) return null;
  const normalizedNameTag = match[1].trim().toLowerCase();
  return FIGMENTOR_TAGS.has(normalizedNameTag) ? normalizedNameTag : null;
}

export function getNodeRole(node, pluginId) {
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

export function walkNodes(node, visitor, path = "0") {
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

export function getFontAwesomeIcon(node) {
  const value = String(node?.name || "").replace(/^\[icon\]\s*/i, "").trim();
  const match = value.match(/^(fas|far|fab)\s+fa-[a-z0-9-]+/i);
  if (!match) return null;
  const icon = match[0].toLowerCase();
  return {
    value: icon,
    library: icon.startsWith("fab ") ? "fa-brands" : icon.startsWith("far ") ? "fa-regular" : "fa-solid"
  };
}

export function discoverAssets(root, pluginId) {
  const assets = [];
  const seen = new Set();
  const carouselChildIds = new Set();
  const iconTags = new Set(["icon-box", "icon-list", "button"]);

  const add = record => {
    if (seen.has(record.assetRef)) return;
    seen.add(record.assetRef);
    assets.push(record);
  };

  const visit = (node, path = "0", inheritedIconTag = null, insideRasterTag = false) => {
    const tag = getNodeTag(node, pluginId);
    const role = getNodeRole(node, pluginId);
    const iconOwnerTag = iconTags.has(tag) ? tag : inheritedIconTag;

    if (tag === "image-carousel") {
      const children = Array.isArray(node.children) && node.children.length > 0
        ? node.children
        : [node];
      children.forEach((child, index) => {
        if (child?.id) carouselChildIds.add(child.id);
        add(createAssetRecord(
          child,
          `${path}.${index}`,
          pluginId,
          "carousel",
          "PNG",
          "WEBP"
        ));
      });
    } else if (tag && ASSET_TAGS.has(tag) && !carouselChildIds.has(node.id)) {
      const kind = tag === "image-background" || tag === "background-image"
        ? "background"
        : "image";
      const targetFormat = kind === "image" || kind === "background" || kind === "carousel"
        ? "WEBP"
        : "WEBP";
      add(createAssetRecord(node, path, pluginId, kind, "PNG", targetFormat));
    } else if (!insideRasterTag && !carouselChildIds.has(node.id) && Array.isArray(node.fills) && node.fills.some(fill => fill?.type === "IMAGE" && fill.visible !== false)) {
      add(createAssetRecord(node, path, pluginId, "image", "PNG", "WEBP"));
    }

    if ((role === "icon" || iconOwnerTag) && VECTOR_TYPES.has(node.type) && !getFontAwesomeIcon(node)) {
      const record = createAssetRecord(node, path, pluginId, "icon", "SVG", "SVG");
      record.fileName = `${slugify(node.name)}-${node.id.replace(/[^a-zA-Z0-9-]/g, "-")}.svg`;
      record.elementorWidget = iconOwnerTag || null;
      add(record);
    }

    const childInsideRaster = insideRasterTag || Boolean(tag && ASSET_TAGS.has(tag));
    (node.children || []).forEach((child, index) => visit(child, `${path}.${index}`, iconOwnerTag, childInsideRaster));
  };

  visit(root);

  return assets;
}

export function createAssetReport(manifest) {
  return (manifest?.assets || []).map(asset => ({
    assetRef: asset.assetRef,
    name: asset.elementName || asset.fileName,
    nodeId: asset.figmaNodeId,
    elementorElement: asset.elementorWidget || asset.kind,
    status: asset.status,
    mediaId: asset.mediaId || null,
    mediaUrl: asset.mediaUrl || null,
    reason: asset.error || null,
    action: asset.status === "failed"
      ? (asset.targetFormat === "SVG" ? "Envie o SVG manualmente ou use Repetir falhos." : "Revise o limite/conversão e use Repetir falhos.")
      : null
  }));
}

export function selectAssetsForProcessing(manifest, onlyFailed = false) {
  return (manifest?.assets || []).filter(asset => (
    onlyFailed ? asset.status === "failed" : asset.status !== "uploaded"
  ));
}

export function buildAssetManifest(root, pluginId, selection) {
  const assets = discoverAssets(root, pluginId);
  return {
    version: "0.1",
    generatedAt: new Date().toISOString(),
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
