import { FIGMENTOR_TAGS } from "./constants.js";

const TAG_PATTERN = /^\[([^\]]+)\]/;

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
  const match = String(node?.name || "").match(TAG_PATTERN);
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
        const stack = [...(this.children || [])];
        while (stack.length) {
          const current = stack.shift();
          if (predicate(current)) return current;
          stack.unshift(...(current.children || []));
        }
        return null;
      }
    }
  });
  return node;
}

export function adaptRestNode(source, pluginId) {
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
    cornerRadius:
      source.cornerRadius ??
      (radii.length && radii.every((value) => value === radii[0]) ? radii[0] : undefined),
    topLeftRadius: source.topLeftRadius ?? radii[0],
    topRightRadius: source.topRightRadius ?? radii[1],
    bottomRightRadius: source.bottomRightRadius ?? radii[2],
    bottomLeftRadius: source.bottomLeftRadius ?? radii[3],
    fontName:
      source.fontName ||
      (style.fontFamily ? { family: style.fontFamily, style: fontStyleName(style) } : undefined),
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

export function buildRestStyleMaps(root) {
  const styles = root?.__figmentorStyles || {};
  return {
    colorMap: {},
    typoMap: {},
    styleNameMap: Object.fromEntries(
      Object.entries(styles).map(([id, value]) => [id, value?.name || ""])
    )
  };
}
