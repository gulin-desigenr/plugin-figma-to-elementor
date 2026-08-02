const ELEMENT_ID_PATTERN = /^[cw][a-z0-9]{6}$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function annotateElements(elements, depth, parentPath, seenCssIds) {
  return elements.map((element, index) => {
    if (!isPlainObject(element)) return element;

    const path = `${parentPath}.${index}`;
    const annotated = {
      ...element,
      id: createElementId(element, path),
      isInner: depth > 0
    };

    if (annotated.settings && typeof annotated.settings.css_id === "string") {
      annotated.settings = {
        ...annotated.settings,
        css_id: uniqueCssId(annotated.settings.css_id, seenCssIds)
      };
    }

    if (Array.isArray(annotated.elements)) {
      annotated.elements = annotateElements(
        annotated.elements,
        depth + 1,
        path,
        seenCssIds
      );
    }

    return annotated;
  });
}

export function annotateExportContent(content) {
  if (!Array.isArray(content)) return content;
  return annotateElements(content, 0, "content", new Set());
}

function validateElement(element, path, errors, seenIds, seenCssIds) {
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

  if (typeof element.isInner !== "boolean") {
    errors.push(`${path}.isInner deve ser booleano.`);
  }

  if (element.elType !== "container" && element.elType !== "widget") {
    errors.push(`${path}.elType deve ser "container" ou "widget".`);
  }

  if (!isPlainObject(element.settings)) {
    errors.push(`${path}.settings deve ser um objeto.`);
  }

  if (element.elType === "container" && !Array.isArray(element.elements)) {
    errors.push(`${path}.elements deve ser um array em containers.`);
  }

  if (element.elType === "widget" && (!element.widgetType || typeof element.widgetType !== "string")) {
    errors.push(`${path}.widgetType é obrigatório em widgets.`);
  }

  if (Array.isArray(element.elements)) {
    element.elements.forEach((child, index) => {
      validateElement(child, `${path}.elements[${index}]`, errors, seenIds, seenCssIds);
    });
  }

  const cssId = element.settings && element.settings.css_id;
  if (cssId) {
    if (seenCssIds.has(cssId)) {
      errors.push(`${path}.settings.css_id está duplicado.`);
    } else {
      seenCssIds.add(cssId);
    }
  }
}

export function validateExportDocument(document, mode) {
  const errors = [];
  const expectedType = mode === "page" ? "page" : "container";

  if (!isPlainObject(document)) {
    return { valid: false, errors: ["O documento exportado deve ser um objeto."] };
  }

  if (document.version !== "0.4") {
    errors.push('version deve ser "0.4".');
  }

  if (document.type !== expectedType) {
    errors.push(`type deve ser "${expectedType}" no modo ${mode}.`);
  }

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
      validateElement(element, `content[${index}]`, errors, seenIds, seenCssIds);
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
