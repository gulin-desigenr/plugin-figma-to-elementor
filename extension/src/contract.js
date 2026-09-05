const ELEMENT_ID_PATTERN = /^[cw][a-z0-9]{6}$/;
const CSS_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

function sanitizeStableCssId(value, fallback) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (CSS_ID_PATTERN.test(normalized)) return normalized;
  return fallback;
}

const SUPPORTED_WIDGET_TYPES = new Set([
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

function validateNativeMedia(value, path, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${path} deve ser um objeto de mídia nativo do Elementor.`);
    return;
  }
  if (containsAssetRef(value)) errors.push(`${path} não pode conter assetRef do Figmentor.`);
  if (
    !(
      value.url &&
      value.id &&
      typeof value.url === "string" &&
      (typeof value.id === "string" || typeof value.id === "number")
    )
  ) {
    errors.push(`${path} deve conter id e url nativos.`);
  }
}

function validateNativeIcon(value, path, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${path} deve ser um ícone nativo do Elementor.`);
    return;
  }
  if (value.library === "svg") {
    if (!isPlainObject(value.value) || !value.value.id || !value.value.url) {
      errors.push(`${path} não pode usar SVG sem id e url de mídia válidos.`);
    }
    return;
  }
  if (
    typeof value.library !== "string" ||
    !value.library ||
    typeof value.value !== "string" ||
    !value.value.trim()
  ) {
    errors.push(`${path} deve conter value e library válidos.`);
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
    items.forEach((item, index) =>
      entries.push({ key, item, path: `${path}.${key}${Array.isArray(value) ? `[${index}]` : ""}` })
    );
  }
  for (const entry of entries) {
    if (!isPlainObject(entry.item) || typeof entry.item.assetRef !== "string") {
      errors.push(`${entry.path}.assetRef é obrigatório.`);
      continue;
    }
    if (entry.item.status === "uploaded" && (!entry.item.mediaId || !entry.item.mediaUrl)) {
      errors.push(`${entry.path} está marcado como uploaded sem mediaId/mediaUrl.`);
    }
    if (entry.item.status === "failed")
      warnings.push(`${entry.path} depende de ação manual ou retry.`);
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
  const hash = stableHash(`${path}:${element.elType}:${element.widgetType || "container"}`)
    .toString(36)
    .padStart(6, "0")
    .slice(-6);
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
    const legacyBackground =
      item.elType === "widget" &&
      ["image-background", "background-image"].includes(item.widgetType);
    const normalized = {
      ...item,
      elType: legacyBackground || item.elType === "container" ? "container" : "widget",
      widgetType: legacyBackground
        ? undefined
        : item.elType === "widget"
          ? normalizeWidgetType(item.widgetType)
          : undefined,
      settings: isPlainObject(item.settings) ? { ...item.settings } : {},
      isInner: depth > 0
    };

    if (normalized.elType === "container") delete normalized.widgetType;
    if (legacyBackground) normalized.settings.background_background ||= "classic";

    const requestedId = typeof item.id === "string" ? item.id : "";
    normalized.id =
      ELEMENT_ID_PATTERN.test(requestedId) && !seenIds.has(requestedId)
        ? requestedId
        : createElementId(normalized, path);
    while (seenIds.has(normalized.id)) {
      normalized.id = createElementId(normalized, `${path}.${seenIds.size}`);
    }
    seenIds.add(normalized.id);

    const requestedCssId =
      typeof normalized.settings.css_id === "string" ? normalized.settings.css_id : "";
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

export function normalizeElementorDocument(
  document,
  mode = document?.type === "page" ? "page" : "section"
) {
  const type = mode === "page" ? "page" : "container";
  const content = normalizeElements(document?.content, 0, "content", new Set(), new Set());
  return {
    version: "0.4",
    title: typeof document?.title === "string" ? document.title : "Figmentor Export",
    type,
    ...(type === "page"
      ? {
          page_settings: isPlainObject(document?.page_settings) ? { ...document.page_settings } : {}
        }
      : {}),
    content
  };
}

function validateElement(element, path, errors, warnings, seenIds, seenCssIds) {
  if (!isPlainObject(element)) {
    errors.push(`${path} deve ser um objeto.`);
    return;
  }

  if (!ELEMENT_ID_PATTERN.test(element.id || "")) {
    errors.push(`${path}.id deve ser um ID estável válido.`);
  } else if (seenIds.has(element.id)) {
    errors.push(`${path}.id está duplicado.`);
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
        `${path}.widgetType "${element.widgetType || ""}" não é um widget Elementor suportado.`
      );
    }
    if (!Array.isArray(element.elements))
      errors.push(`${path}.elements deve ser um array em widgets.`);
  }

  if (Array.isArray(element.elements)) {
    element.elements.forEach((child, index) => {
      validateElement(child, `${path}.elements[${index}]`, errors, warnings, seenIds, seenCssIds);
    });
  }

  const cssId = element.settings?.css_id;
  if (cssId) {
    if (!CSS_ID_PATTERN.test(cssId))
      errors.push(`${path}.settings.css_id deve ser um identificador CSS seguro.`);
    if (seenCssIds.has(cssId)) errors.push(`${path}.settings.css_id está duplicado.`);
    else seenCssIds.add(cssId);
  }

  if (isPlainObject(element.settings)) {
    if (element.settings.image !== undefined)
      validateNativeMedia(element.settings.image, `${path}.settings.image`, errors);
    if (element.settings.background_image !== undefined)
      validateNativeMedia(
        element.settings.background_image,
        `${path}.settings.background_image`,
        errors
      );
    if (element.settings.selected_icon !== undefined)
      validateNativeIcon(element.settings.selected_icon, `${path}.settings.selected_icon`, errors);
    if (element.settings.selected_active_icon !== undefined)
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
        if (item.selected_icon !== undefined) {
          validateNativeIcon(
            item.selected_icon,
            `${path}.settings.icon_list[${index}].selected_icon`,
            errors
          );
        }
      });
    }
    if (
      element.settings.figmentor_assets !== undefined ||
      element.settings.figmentor_source_node_id !== undefined
    ) {
      errors.push(
        `${path}.settings contém metadados do Figmentor; use o sidecar document.figmentor.`
      );
    }
    if (
      element.settings.custom_css !== undefined &&
      (typeof element.settings.custom_css !== "string" ||
        element.settings.custom_css.length > 20000 ||
        /<\/?script\b|@import\b/i.test(element.settings.custom_css) ||
        (typeof element.settings.custom_css === "string" &&
          (!element.settings.custom_css.includes(`#${element.settings.css_id}`) ||
            (element.settings.custom_css.match(/{/g) || []).length !==
              (element.settings.custom_css.match(/}/g) || []).length)))
    ) {
      errors.push(`${path}.settings.custom_css deve ser CSS texto válido e limitado a 20 KB.`);
    }
  }
}

export function validateElementorDocument(
  document,
  mode = document?.type === "page" ? "page" : "section"
) {
  const errors = [];
  const warnings = [];
  const expectedType = mode === "page" ? "page" : "container";

  if (!isPlainObject(document)) {
    return { valid: false, errors: ["O documento exportado deve ser um objeto."] };
  }
  if (document.version !== "0.4") errors.push('version deve ser "0.4".');
  if (document.type !== expectedType)
    errors.push(`type deve ser "${expectedType}" no modo ${mode}.`);
  if (!Array.isArray(document.content) || document.content.length === 0) {
    errors.push("content deve conter pelo menos um elemento.");
  }
  if (mode === "page" && !isPlainObject(document.page_settings)) {
    errors.push("page_settings deve ser um objeto no modo página.");
  }
  if (Array.isArray(document.content)) {
    const seenIds = new Set();
    const seenCssIds = new Set();
    document.content.forEach((element, index) => {
      validateElement(element, `content[${index}]`, errors, warnings, seenIds, seenCssIds);
    });
  }

  if (document.figmentor !== undefined) {
    if (!isPlainObject(document.figmentor) || !isPlainObject(document.figmentor.elements)) {
      errors.push("figmentor.elements deve ser um sidecar indexado por ID de elemento.");
    } else {
      for (const [elementId, metadata] of Object.entries(document.figmentor.elements)) {
        if (!isPlainObject(metadata)) {
          errors.push(`figmentor.elements.${elementId} deve ser um objeto.`);
          continue;
        }
        if (metadata.assets !== undefined) {
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
