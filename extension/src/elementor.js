import { traverseNode } from "../../src/core/traverse.js";
import { getFontAwesomeIcon, getNodeRole, getNodeTag, walkNodes } from "./assets.js";
import { normalizeElementorDocument } from "./contract.js";
import { adaptRestNode, buildRestStyleMaps } from "./figma-rest-adapter.js";
import { summarizeEffects } from "../../src/styles/effects.js";
import { ELEMENTOR_SELECTOR_PROFILE } from "../../src/styles/elementor-selectors.js";

const VECTOR_TYPES = new Set(["VECTOR", "BOOLEAN_OPERATION"]);
const SVG_FALLBACK_ICON = Object.freeze({ value: "fas fa-check", library: "fa-solid" });

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
  const vectors = descendants(source, (node) => VECTOR_TYPES.has(node.type));
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
  const vectors = descendants(source, (node) => VECTOR_TYPES.has(node.type));
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
  const source = settings?.figmentor_source_node_id
    ? sourceMap.get(settings.figmentor_source_node_id)
    : null;

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

  (element?.elements || []).forEach((child) =>
    bindElementAssets(child, sourceMap, pluginId, sidecar)
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

export async function buildElementorDocument(root, mode, pluginId) {
  const adaptedRoot = adaptRestNode(root, pluginId);
  const mapped = await traverseNode(adaptedRoot, true, buildRestStyleMaps(root));
  const type = mode === "page" ? "page" : "container";
  const content = Array.isArray(mapped) ? mapped : mapped ? [mapped] : [];
  sanitizeUnsupportedPositioning(content);

  const document = normalizeElementorDocument(
    {
      version: "0.4",
      title: `${type === "page" ? "Page" : "Container"} Export - ${root.name || root.id}`,
      type,
      ...(type === "page" ? { page_settings: {} } : {}),
      content
    },
    mode
  );

  const sourceMap = new Map();
  walkNodes(root, (node) => sourceMap.set(node.id, node));
  const sidecar = {};
  const effectsSummary = summarizeEffects(document.content);
  const effects = collectEffectMetadata(document.content);
  document.content.forEach((element) => bindElementAssets(element, sourceMap, pluginId, sidecar));
  document.figmentor = {
    version: "0.3",
    selectorProfile: ELEMENTOR_SELECTOR_PROFILE,
    customCssControl: "custom_css",
    effects: {
      summary: effectsSummary,
      items: effects
    },
    elements: sidecar
  };
  return document;
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
      settings.carousel = metadata.carousel.map((item) =>
        uploadedMedia(assetMap.get(item.assetRef))
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

export function patchElementorAssets(document, manifest) {
  const patched = JSON.parse(JSON.stringify(document));
  const assetMap = new Map((manifest?.assets || []).map((asset) => [asset.assetRef, asset]));
  const sidecar = patched.figmentor?.elements || {};
  patched.content?.forEach((element) => patchElement(element, assetMap, sidecar));
  return patched;
}
