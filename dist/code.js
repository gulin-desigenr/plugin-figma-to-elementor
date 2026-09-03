(() => {
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
      "Thin": "100",
      "Hairline": "100",
      "Extra Light": "200",
      "Ultra Light": "200",
      "Light": "300",
      "Regular": "400",
      "Normal": "400",
      "Medium": "500",
      "Semi Bold": "600",
      "Demi Bold": "600",
      "Bold": "700",
      "Extra Bold": "800",
      "Ultra Bold": "800",
      "Black": "900",
      "Heavy": "900"
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
  function getNodeRole(node) {
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
      const textChild = node.findOne((child) => child.type === "TEXT" && child.textAlignHorizontal && !isFigmaMixed(child.textAlignHorizontal));
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
    let lineHeight = null;
    if (node.lineHeight !== void 0 && !isFigmaMixed(node.lineHeight)) {
      if (node.lineHeight.unit !== "AUTO") {
        lineHeight = {
          size: node.lineHeight.value,
          unit: node.lineHeight.unit === "PIXELS" ? "px" : "%"
        };
      }
    }
    let letterSpacing = null;
    if (node.letterSpacing !== void 0 && !isFigmaMixed(node.letterSpacing)) {
      if (node.letterSpacing.value !== 0) {
        letterSpacing = {
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
      lineHeight,
      letterSpacing,
      textTransform,
      textDecoration,
      fontStyle
    };
  }
  async function extractBackground(node, maps = { colorMap: {}, typoMap: {} }) {
    let result = {};
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
    "\xE1": "a",
    "\xE0": "a",
    "\xE3": "a",
    "\xE2": "a",
    "\xE4": "a",
    "\xE9": "e",
    "\xE8": "e",
    "\xEA": "e",
    "\xEB": "e",
    "\xED": "i",
    "\xEC": "i",
    "\xEE": "i",
    "\xEF": "i",
    "\xF3": "o",
    "\xF2": "o",
    "\xF5": "o",
    "\xF4": "o",
    "\xF6": "o",
    "\xFA": "u",
    "\xF9": "u",
    "\xFB": "u",
    "\xFC": "u",
    "\xE7": "c",
    "\xF1": "n",
    "\xC1": "a",
    "\xC0": "a",
    "\xC3": "a",
    "\xC2": "a",
    "\xC4": "a",
    "\xC9": "e",
    "\xC8": "e",
    "\xCA": "e",
    "\xCB": "e",
    "\xCD": "i",
    "\xCC": "i",
    "\xCE": "i",
    "\xCF": "i",
    "\xD3": "o",
    "\xD2": "o",
    "\xD5": "o",
    "\xD4": "o",
    "\xD6": "o",
    "\xDA": "u",
    "\xD9": "u",
    "\xDB": "u",
    "\xDC": "u",
    "\xC7": "c",
    "\xD1": "n"
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
        backgroundVideo: { selector: ".elementor-background-video-container", label: "background video" },
        backgroundVideoEmbed: { selector: ".elementor-background-video-embed", label: "embedded background video" },
        backgroundVideoHosted: { selector: ".elementor-background-video-hosted", label: "hosted background video" },
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
      classes: [".elementor-size-default", ".elementor-size-small", ".elementor-size-medium", ".elementor-size-large", ".elementor-size-xl", ".elementor-size-xxl"]
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
      classes: [".elementor-drop-cap-view-default", ".elementor-drop-cap-view-stacked", ".elementor-drop-cap-view-framed"]
    },
    image: {
      profile: ELEMENTOR_SELECTOR_PROFILE,
      root: ROOT,
      slots: {
        image: { selector: "img", label: "image" },
        figure: { selector: "figure.wp-caption", label: "caption figure" },
        caption: { selector: "figcaption.widget-image-caption.wp-caption-text", label: "image caption" }
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
      classes: [".elementor-position-top", ".elementor-position-left", ".elementor-position-right", ".elementor-position-bottom", ".elementor-vertical-align-top", ".elementor-vertical-align-middle", ".elementor-vertical-align-bottom"]
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
      classes: [".elementor-view-default", ".elementor-view-stacked", ".elementor-view-framed", ".elementor-shape-circle", ".elementor-shape-square", ".elementor-animation-grow", ".elementor-animation-shrink", ".elementor-animation-pulse"]
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
      classes: [".elementor-inline-items", ".elementor-icon-list--layout-traditional", ".elementor-icon-list--layout-inline"]
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
      classes: [".elementor-size-xs", ".elementor-size-sm", ".elementor-size-md", ".elementor-size-lg", ".elementor-size-xl", ".elementor-size-xxl", ".elementor-animation-grow", ".elementor-animation-shrink", ".elementor-animation-pulse"]
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
        titleHeader: { selector: ".e-n-accordion-item-title-header", label: "nested accordion title header" },
        titleText: { selector: ".e-n-accordion-item-title-text", label: "nested accordion title text" },
        titleIcon: { selector: ".e-n-accordion-item-title-icon", label: "nested accordion title icon" }
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
        activeBullet: { selector: ".swiper-pagination-bullet-active", label: "active pagination bullet" }
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
    return (paint.gradientStops || []).map((stop) => `${alphaColor(stop.color, stop.color?.a * finite(paint.opacity, 1))} ${percent(stop.position)}`);
  }
  function gradientToCss(paint) {
    const stops = gradientStops(paint);
    if (stops.length < 2) return null;
    if (paint.type === "GRADIENT_RADIAL") return `radial-gradient(circle, ${stops.join(", ")})`;
    if (paint.type === "GRADIENT_ANGULAR") return `conic-gradient(from ${angleFromHandles(paint.gradientHandlePositions)}deg, ${stops.join(", ")})`;
    if (paint.type === "GRADIENT_DIAMOND") return `radial-gradient(farthest-corner, ${stops.join(", ")})`;
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
    if (!CSS_SAFE_PROPERTIES.has(property) || value === null || value === void 0 || value === "") return null;
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
    const unsupportedPaints = paints.filter((paint) => !["SOLID", "GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"].includes(paint.type));
    if (paints.length === 1 && solidPaints.length === 1 && !hasAdvancedEffect) {
      native.background = "solid";
    } else if (cssPaints.length > 0) {
      cssDeclarations.push(declaration("background", cssPaints.join(", ")));
      if (solidPaints.length > 0 && gradientPaints.length > 0) cssDeclarations.push(declaration("background-blend-mode", "normal"));
    }
    if (unsupportedPaints.length > 0) flags.push(...unsupportedPaints.map((paint) => `paint:${paint.type}`));
    if (paints.some((paint) => paint.type === "GRADIENT_DIAMOND")) flags.push("approximation:gradient-diamond-to-radial");
    const shadows = effects.filter((effect) => ["DROP_SHADOW", "INNER_SHADOW"].includes(effect.type));
    if (shadows.length > 0 && !native.shadow) cssDeclarations.push(declaration("box-shadow", shadows.map(shadowToCss).join(", ")));
    if (effects.some((effect) => effect.type === "LAYER_BLUR")) {
      const blur = effects.find((effect) => effect.type === "LAYER_BLUR");
      cssDeclarations.push(declaration("filter", `blur(${finite(blur.radius)}px)`));
    }
    if (effects.some((effect) => effect.type === "BACKGROUND_BLUR")) {
      const blur = effects.find((effect) => effect.type === "BACKGROUND_BLUR");
      cssDeclarations.push(declaration("backdrop-filter", `blur(${finite(blur.radius)}px)`));
      cssDeclarations.push(declaration("-webkit-backdrop-filter", `blur(${finite(blur.radius)}px)`));
    }
    if (blendMode && blendMode !== "normal") cssDeclarations.push(declaration("mix-blend-mode", blendMode));
    if (hasUnsupportedBlend) flags.push(`blend-mode:${node.blendMode}`);
    const unsupportedEffects = effects.filter((effect) => !["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"].includes(effect.type));
    if (unsupportedEffects.length > 0) flags.push(...unsupportedEffects.map((effect) => `effect:${effect.type}`));
    if (effects.filter((effect) => effect.type === "LAYER_BLUR").length > 1) flags.push("multiple-layer-blur:first-layer-applied");
    if (effects.filter((effect) => effect.type === "BACKGROUND_BLUR").length > 1) flags.push("multiple-background-blur:first-layer-applied");
    if (node?.opacity !== void 0 && finite(node.opacity, 1) < 1) cssDeclarations.push(declaration("opacity", String(Math.max(0, Math.min(1, finite(node.opacity, 1))))));
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
    if (cssDeclarations.length > 0 && !resolvedSelector) flags.push(cssId ? "invalid-css-id" : "missing-css-id");
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
      const explicitTitleNode = childTextNodes.find((textNode) => getNodeRole(textNode) === "title_text");
      const explicitDescriptionNode = childTextNodes.find((textNode) => getNodeRole(textNode) === "description_text");
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
      const explicitTitleNode = childTextNodes.find((textNode) => getNodeRole(textNode) === "title_text");
      const explicitDescriptionNode = childTextNodes.find((textNode) => getNodeRole(textNode) === "description_text");
      const fallbackTitleNode = explicitTitleNode || childTextNodes[0];
      const directChildren = "children" in child ? child.children.filter((item) => item.visible) : [];
      let explicitContentNode = null;
      if ("findAll" in child) {
        explicitContentNode = child.findAll((nodeItem) => nodeItem.visible && nodeItem.id !== fallbackTitleNode.id && getNodeRole(nodeItem) === "description_text")[0] || null;
      }
      let titleBranchNode = null;
      if (directChildren.length > 0 && fallbackTitleNode) {
        titleBranchNode = directChildren.find((nodeItem) => nodeItem.id === fallbackTitleNode.id || "findOne" in nodeItem && nodeItem.findOne((descendant) => descendant.id === fallbackTitleNode.id)) || null;
      }
      let contentNodes = [];
      if (explicitContentNode) {
        if ("children" in explicitContentNode && explicitContentNode.children.length > 0) {
          contentNodes = explicitContentNode.children.filter((item) => item.visible);
        } else {
          contentNodes = [explicitContentNode];
        }
      } else if (directChildren.length > 0) {
        contentNodes = directChildren.filter((nodeItem) => nodeItem.id !== (titleBranchNode && titleBranchNode.id));
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
    let settings = {};
    let bgSettings = {};
    if (node.type !== "TEXT") {
      bgSettings = await extractBackground(node, maps);
      if (bgSettings.background_background) {
        settings._background_background = bgSettings.background_background;
        settings._background_color = bgSettings.background_color;
        if (bgSettings.__globals__) settings.__globals__ = Object.assign({}, settings.__globals__ || {}, bgSettings.__globals__);
      }
    }
    extractBorders(node, settings, true, tag);
    extractShadows(node, settings, true, tag);
    if (tag === "image-box") {
      let titleNode = textNodes.find((n) => getNodeRole(n) === "title_text");
      let descNode = textNodes.find((n) => getNodeRole(n) === "description_text");
      settings.title_text = titleNode ? titleNode.characters : texts[0] || "T\xEDtulo";
      let tStyle = titleNode ? await extractTextStyle(titleNode, maps) : mainStyle;
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
      let dStyle = descNode ? await extractTextStyle(descNode, maps) : secStyle;
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
      let titleNode = textNodes.find((n) => getNodeRole(n) === "title_text");
      let descNode = textNodes.find((n) => getNodeRole(n) === "description_text");
      settings.title_text = titleNode ? titleNode.characters : texts[0] || "T\xEDtulo do \xCDcone";
      settings.title = settings.title_text;
      let tStyle = titleNode ? await extractTextStyle(titleNode, maps) : mainStyle;
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
      let dStyle = descNode ? await extractTextStyle(descNode, maps) : secStyle;
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
      else if ("findAll" in node) vectorNodes = node.findAll((n) => n.type === "VECTOR" || n.type === "BOOLEAN_OPERATION");
      let specificIconVector = vectorNodes.find((n) => getNodeRole(n) === "icon");
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
      settings.selected_icon = { value: iconName, library: iconName.startsWith("fab") ? "fa-brands" : "fa-solid" };
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
        let paddingTop = node.paddingTop || 0;
        let paddingBottom = node.paddingBottom || 0;
        let sumPadding = paddingTop + paddingBottom;
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
        let specificIconVector = vectorNodes.find((n) => getNodeRole(n) === "icon");
        if (specificIconVector) vectorNodes = [specificIconVector];
        if (vectorNodes.length > 0) {
          const vector = vectorNodes[0];
          const detectedIconName = getFontAwesomeName(vector);
          if (detectedIconName) {
            settings.selected_icon = { value: detectedIconName, library: detectedIconName.startsWith("fab") ? "fa-brands" : detectedIconName.startsWith("far") ? "fa-regular" : "fa-solid" };
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
      let elements = [];
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
      return { elType: "widget", widgetType: "nested-carousel", settings, elements };
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
      let settings = {
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
    let settings = { image: { url: "", id: "" }, align: "center" };
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
        const data = applyChildFillSizing(child, await traverseNode(child, false, maps, passValidated));
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

  // src/core/contract.js
  var ELEMENT_ID_PATTERN = /^[cw][a-z0-9]{6}$/;
  var CSS_ID_PATTERN2 = /^[a-z][a-z0-9-]{0,63}$/;
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
  function safeCssId(value, fallback) {
    const normalized = String(value || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
    return CSS_ID_PATTERN2.test(normalized) ? normalized : fallback;
  }
  function validateCustomCss(value, cssId, path, errors) {
    if (typeof value !== "string" || value.length > 2e4) {
      errors.push(`${path} deve ser CSS texto v\xE1lido e limitado a 20 KB.`);
      return;
    }
    const openBraces = (value.match(/{/g) || []).length;
    const closeBraces = (value.match(/}/g) || []).length;
    if (/<\/?script\b|@import\b/i.test(value) || openBraces !== closeBraces || !value.includes(`#${cssId}`)) {
      errors.push(`${path} deve ser CSS escopado pelo css_id, sem imports/scripts e com chaves balanceadas.`);
    }
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
      if (annotated.settings) {
        annotated.settings = {
          ...annotated.settings,
          css_id: uniqueCssId(safeCssId(annotated.settings.css_id, `figmentor-${annotated.id}`), seenCssIds)
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
  function annotateExportContent(content) {
    if (!Array.isArray(content)) return content;
    return annotateElements(content, 0, "content", /* @__PURE__ */ new Set());
  }
  function validateElement(element, path, errors, seenIds, seenCssIds) {
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
      errors.push(`${path}.widgetType \xE9 obrigat\xF3rio em widgets.`);
    }
    if (Array.isArray(element.elements)) {
      element.elements.forEach((child, index) => {
        validateElement(child, `${path}.elements[${index}]`, errors, seenIds, seenCssIds);
      });
    }
    const cssId = element.settings && element.settings.css_id;
    if (cssId) {
      if (!CSS_ID_PATTERN2.test(cssId)) errors.push(`${path}.settings.css_id deve ser um identificador CSS seguro.`);
      if (seenCssIds.has(cssId)) {
        errors.push(`${path}.settings.css_id est\xE1 duplicado.`);
      } else {
        seenCssIds.add(cssId);
      }
    }
    if (element.settings?.custom_css !== void 0) {
      validateCustomCss(element.settings.custom_css, cssId, `${path}.settings.custom_css`, errors);
    }
  }
  function validateExportDocument(document, mode) {
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
      errors.push("page_settings deve ser um objeto no modo p\xE1gina.");
    }
    if (Array.isArray(document.content)) {
      const seenIds = /* @__PURE__ */ new Set();
      const seenCssIds = /* @__PURE__ */ new Set();
      document.content.forEach((element, index) => {
        validateElement(element, `content[${index}]`, errors, seenIds, seenCssIds);
      });
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // src/core/selection.js
  var FIGMENTOR_SELECTION_KEY = "figmentor-selected-root";
  var FIGMENTOR_SHARED_NAMESPACE = "figmentor";
  var FIGMENTOR_SELECTION_VERSION = 1;
  var ROOT_NODE_TYPES = /* @__PURE__ */ new Set([
    "FRAME",
    "COMPONENT",
    "COMPONENT_SET",
    "INSTANCE",
    "SECTION",
    "GROUP"
  ]);
  function isSupportedRootNode(node) {
    return Boolean(node) && ROOT_NODE_TYPES.has(node.type);
  }
  function createSelectionRecord(node, registeredAt = (/* @__PURE__ */ new Date()).toISOString()) {
    return {
      version: FIGMENTOR_SELECTION_VERSION,
      nodeId: node.id,
      name: node.name || "",
      type: node.type,
      registeredAt
    };
  }
  function serializeSelectionRecord(node, registeredAt) {
    return JSON.stringify(createSelectionRecord(node, registeredAt));
  }

  // src/index.js
  var EXPORT_MODES = /* @__PURE__ */ new Set(["section", "page"]);
  function sendExportError(message) {
    figma.notify(`Exporta\xE7\xE3o interrompida: ${message}`, { error: true });
    figma.ui.postMessage({ type: "export-error", message });
  }
  function persistSelectedRoot(rootNode, registeredAt = (/* @__PURE__ */ new Date()).toISOString()) {
    const serialized = serializeSelectionRecord(rootNode, registeredAt);
    figma.root.setPluginData(FIGMENTOR_SELECTION_KEY, serialized);
    figma.root.setSharedPluginData(FIGMENTOR_SHARED_NAMESPACE, FIGMENTOR_SELECTION_KEY, serialized);
    return {
      nodeId: rootNode.id,
      name: rootNode.name || "",
      type: rootNode.type,
      registeredAt,
      pluginId: figma.pluginId || "figma-to-elementor-test",
      dataNamespace: FIGMENTOR_SHARED_NAMESPACE
    };
  }
  function syncCurrentSelection(notify = false) {
    const selection = figma.currentPage.selection;
    if (selection.length !== 1 || !isSupportedRootNode(selection[0])) return null;
    const frame = persistSelectedRoot(selection[0]);
    figma.ui.postMessage({ type: "frame-selection-synced", data: frame });
    if (notify) figma.notify(`Frame sincronizado: ${frame.name || frame.nodeId}`);
    return frame;
  }
  try {
    figma.showUI(__html__, { width: 400, height: 620 });
    figma.on("selectionchange", () => syncCurrentSelection(false));
    syncCurrentSelection(false);
    figma.ui.onmessage = (msg) => {
      try {
        if (msg.type === "apply-tag") {
          const selection = figma.currentPage.selection;
          if (selection.length > 0) {
            selection.forEach((node) => {
              node.setPluginData("elementor-tag", "");
              node.setPluginData("elementor-tag", msg.tag);
              node.setSharedPluginData(FIGMENTOR_SHARED_NAMESPACE, "elementor-tag", msg.tag);
              let newName = node.name.replace(/\[.*?\]\s*/g, "");
              node.name = `[${msg.tag.toUpperCase()}] ${newName}`;
            });
            figma.notify("Tag Aplicada: " + msg.tag.toUpperCase());
          } else {
            figma.notify("Selecione algo primeiro.");
          }
        }
        if (msg.type === "apply-role") {
          const selection = figma.currentPage.selection;
          if (selection.length > 0) {
            selection.forEach((node) => {
              node.setPluginData("elementor_role", msg.role);
              node.setSharedPluginData(FIGMENTOR_SHARED_NAMESPACE, "elementor_role", msg.role);
              let newName = node.name.replace(/\[(?:title|description|icon|image)\]\s*/gi, "");
              let roleLabel = msg.role;
              if (msg.role === "title_text") roleLabel = "title";
              if (msg.role === "description_text") roleLabel = "description";
              node.name = `[${roleLabel}] ${newName}`;
            });
            figma.notify("Sub-Tag Aplicada: " + msg.role);
          } else {
            figma.notify("Selecione um elemento interno primeiro.");
          }
        }
        if (msg.type === "register-frame") {
          const selection = figma.currentPage.selection;
          if (selection.length !== 1) {
            figma.ui.postMessage({
              type: "frame-registration-error",
              message: "Selecione exatamente um frame para registrar."
            });
            figma.notify("Selecione exatamente um frame para registrar.", { error: true });
            return;
          }
          const rootNode = selection[0];
          if (!isSupportedRootNode(rootNode)) {
            figma.ui.postMessage({
              type: "frame-registration-error",
              message: "O elemento selecionado precisa ser um frame, grupo, se\xE7\xE3o ou componente."
            });
            figma.notify("Selecione um frame, grupo, se\xE7\xE3o ou componente.", { error: true });
            return;
          }
          const frame = persistSelectedRoot(rootNode);
          figma.ui.postMessage({
            type: "frame-registered",
            data: frame
          });
          figma.notify(`Frame registrado: ${rootNode.name || rootNode.id}`);
          return;
        }
        if (msg.type === "export-json") {
          const selection = figma.currentPage.selection;
          const exportMode = msg.exportMode;
          if (!EXPORT_MODES.has(exportMode)) {
            sendExportError("Escolha se voc\xEA est\xE1 criando uma se\xE7\xE3o ou uma p\xE1gina.");
            return;
          }
          if (selection.length === 0) {
            sendExportError("Selecione o frame principal.");
            return;
          }
          if (selection.length > 1) {
            sendExportError("Selecione apenas um frame raiz.");
            return;
          }
          const rootTag = selection[0].getPluginData("elementor-tag");
          if (exportMode === "section" && rootTag !== "container") {
            sendExportError("No modo Se\xE7\xE3o, o frame principal precisa da tag Se\xE7\xE3o (1140px Boxed).");
            return;
          }
          if (exportMode === "page" && rootTag !== "page-wrapper") {
            sendExportError("No modo P\xE1gina, o frame principal precisa da tag P\xE1gina (Wrapper).");
            return;
          }
          figma.notify("\u23F3 Calculando \xE1rvore...");
          (async () => {
            try {
              let sanitizeOutput = function(nodes, effectItems2) {
                if (!nodes || !Array.isArray(nodes)) return;
                nodes.forEach((node) => {
                  if (node && node.settings) {
                    if (node.settings.figmentor_effects) {
                      effectItems2.push({
                        elementId: node.id || null,
                        widgetType: node.elType === "widget" ? node.widgetType : "container",
                        cssId: node.settings.css_id || null,
                        ...node.settings.figmentor_effects
                      });
                      delete node.settings.figmentor_effects;
                    }
                    delete node.settings._position;
                    delete node.settings.position;
                    delete node.settings.margin;
                    delete node.settings._margin;
                    delete node.settings._offset_x;
                    delete node.settings._offset_y;
                    delete node.settings._z_index;
                    delete node.settings.offset_x;
                    delete node.settings.offset_y;
                  }
                  if (node && node.elements) {
                    sanitizeOutput(node.elements, effectItems2);
                  }
                });
              };
              const { colorMap, typoMap } = msg;
              let structure = await traverseNode(selection[0], true, { colorMap, typoMap });
              let content = Array.isArray(structure) ? structure : [structure];
              content = annotateExportContent(content);
              const effectItems = [];
              const effectsSummary = summarizeEffects(content);
              sanitizeOutput(content, effectItems);
              const elementorJSON = {
                version: "0.4",
                title: `${exportMode === "page" ? "Page" : "Container"} Export - ${selection[0].name}`,
                type: exportMode === "page" ? "page" : "container",
                ...exportMode === "page" ? { page_settings: {} } : {},
                content,
                figmentor: {
                  version: "0.3",
                  selectorProfile: ELEMENTOR_SELECTOR_PROFILE,
                  customCssControl: "custom_css",
                  effects: { summary: effectsSummary, items: effectItems },
                  elements: {}
                }
              };
              const validation = validateExportDocument(elementorJSON, exportMode);
              if (!validation.valid) {
                sendExportError(validation.errors.join(" "));
                return;
              }
              figma.ui.postMessage({ type: "json-generated", data: JSON.stringify(elementorJSON, null, 2) });
              figma.notify("\u2705 JSON Gerado com Sucesso!");
            } catch (err) {
              sendExportError(err.message);
              console.error(err);
            }
          })();
        }
      } catch (e) {
        figma.notify("Erro Msg: " + e.message);
        console.error(e);
      }
    };
  } catch (globalError) {
    console.error(globalError);
    figma.notify("Erro Fatal: " + globalError.message, { error: true });
  }
})();
