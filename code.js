figma.showUI(__html__, { width: 400, height: 620 });

figma.ui.onmessage = (msg) => {
  try {
    if (msg.type === 'apply-tag') {
      const selection = figma.currentPage.selection;
      if (selection.length > 0) {
        selection.forEach(node => {
          node.setPluginData("elementor-tag", "");
          node.setPluginData("elementor-tag", msg.tag);

          let newName = node.name.replace(/\[.*?\]\s*/g, '');
          node.name = `[${msg.tag.toUpperCase()}] ${newName}`;
        });
        figma.notify("Tag Aplicada: " + msg.tag.toUpperCase());
      } else {
        figma.notify("Selecione algo primeiro.");
      }
    }

    if (msg.type === "export-json") {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) { figma.notify("Selecione o Frame Principal."); return; }

      const structure = traverseNode(selection[0], true);
      const elementorJSON = {
        version: "0.4",
        title: "Export V16 Width Fix - " + selection[0].name,
        type: "container",
        content: [structure]
      };

      figma.ui.postMessage({ type: "json-generated", data: JSON.stringify(elementorJSON, null, 2) });
      figma.notify("JSON Gerado: Larguras Fiéis ao Figma!");
    }
  } catch (e) {
    figma.notify("Erro: " + e.message);
    console.error(e);
  }
};

function traverseNode(node, isRoot) {
  if (!node || typeof node.visible === 'undefined' || !node.visible) return null;

  const manualTag = node.getPluginData("elementor-tag");

  if (manualTag) return handleManualTag(node, manualTag, isRoot);
  if (node.type === "TEXT") return mapText(node);
  if (hasImageFill(node)) return mapImage(node);

  if ("children" in node) {
    let childrenJSON = [];
    for (const child of node.children) {
      const data = traverseNode(child, false);
      if (data) {
        if (Array.isArray(data)) childrenJSON = childrenJSON.concat(data);
        else childrenJSON.push(data);
      }
    }
    if (!isRoot && node.layoutMode === "NONE") return childrenJSON;
    return mapContainer(node, childrenJSON, isRoot, false);
  }
  return null;
}

// --- UTILITÁRIOS ---

function figmaColorToRGBA(color, opacity = 1) {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r},${g},${b},${parseFloat(opacity.toFixed(2))})`;
}

function mapFontWeight(style) {
  const weights = {
    "Thin": "100", "Hairline": "100",
    "Extra Light": "200", "Ultra Light": "200",
    "Light": "300", "Regular": "400", "Normal": "400",
    "Medium": "500", "Semi Bold": "600", "Demi Bold": "600",
    "Bold": "700", "Extra Bold": "800", "Ultra Bold": "800",
    "Black": "900", "Heavy": "900"
  };
  const match = Object.keys(weights).find(key => style.includes(key));
  return weights[match] || "400";
}

// --- INTELEGÊNCIA ESPACIAL ---

function getLayoutDirection(node) {
  if (node.layoutMode === "HORIZONTAL") return "row";
  if (node.layoutMode === "VERTICAL") return "column";

  if (node.children) {
    const visibleChildren = node.children.filter(c => c.visible);
    if (visibleChildren.length >= 2) {
      const child1 = visibleChildren[0];
      const child2 = visibleChildren[1];
      if (Math.abs(child1.y - child2.y) < 20) return "row";
    }
  }
  return "column";
}

// --- FUNÇÕES DE ESTILO ---

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
  }

  if (node.cornerRadius !== undefined) {
    if (node.cornerRadius === figma.mixed) {
      settings[radiusKey] = {
        unit: "px",
        top: String(node.topLeftRadius !== figma.mixed ? node.topLeftRadius || 0 : 0),
        right: String(node.topRightRadius !== figma.mixed ? node.topRightRadius || 0 : 0),
        bottom: String(node.bottomRightRadius !== figma.mixed ? node.bottomRightRadius || 0 : 0),
        left: String(node.bottomLeftRadius !== figma.mixed ? node.bottomLeftRadius || 0 : 0),
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

  if (node.strokes && node.strokes.length > 0 && node.strokeWeight !== figma.mixed && node.strokeWeight > 0) {
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
    const shadow = node.effects.find(e => e.type === "DROP_SHADOW" && e.visible);
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

function extractTextStyle(node) {
  let color = "";
  if (node.fills && node.fills !== figma.mixed && node.fills.length > 0) {
    if (node.fills[0].type === "SOLID") {
      color = figmaColorToRGBA(node.fills[0].color, node.fills[0].opacity);
    }
  }
  const size = (node.fontSize !== undefined && node.fontSize !== figma.mixed) ? node.fontSize : 16;
  let weight = "400";
  if (node.fontName !== undefined && node.fontName !== figma.mixed) {
    weight = mapFontWeight(node.fontName.style);
  }
  return { color, size, weight };
}

function extractBackground(node) {
  if (node.fills && node.fills !== figma.mixed && node.fills.length > 0) {
    if (node.fills[0].type === "SOLID") {
      return {
        background_background: "classic",
        background_color: figmaColorToRGBA(node.fills[0].color, node.fills[0].opacity)
      };
    }
  }
  return {};
}

// --- HANDLERS ---

function handleManualTag(node, tag, isRoot) {
  if (tag === 'container' || tag === 'container-full') {
    let children = [];
    if ("children" in node) {
      for (const child of node.children) {
        const res = traverseNode(child, false);
        if (res) {
          if (Array.isArray(res)) children = children.concat(res);
          else children.push(res);
        }
      }
    }
    return mapContainer(node, children, isRoot, tag === 'container-full');
  }

  let textNodes = [];
  if (node.type === "TEXT") textNodes.push(node);
  else if ("findAll" in node) textNodes = node.findAll(n => n.type === "TEXT");

  const texts = textNodes.map(t => t.characters);
  const styles = textNodes.map(t => extractTextStyle(t));
  const mainStyle = styles.length > 0 ? styles[0] : { color: "", size: 16, weight: "400" };
  const secStyle = styles.length > 1 ? styles[1] : mainStyle;

  let settings = { align: "center" };

  if (node.type !== "TEXT") {
    const bgSettings = extractBackground(node);
    if (bgSettings.background_background) {
      settings._background_background = bgSettings.background_background;
      settings._background_color = bgSettings.background_color;
    }
  }

  extractBorders(node, settings, true, tag);
  extractShadows(node, settings, true, tag);

  if (tag === "image-box") {
    settings.title_text = texts[0] || "Título";
    if (mainStyle.color) settings.title_color = mainStyle.color;
    settings.title_typography_typography = "custom";
    settings.title_typography_font_size = { size: mainStyle.size, unit: "px" };
    settings.title_typography_font_weight = mainStyle.weight;

    settings.description_text = texts.slice(1).join(" ");
    if (secStyle.color) settings.description_color = secStyle.color;
    settings.description_typography_typography = "custom";
    settings.description_typography_font_size = { size: secStyle.size, unit: "px" };
    settings.description_typography_font_weight = secStyle.weight;

    settings.image = { url: "", id: "" };
  }
  else if (tag === "icon-list") {
    let listItems = texts;
    if (listItems.length === 0) listItems = ["Item Lista 1", "Item Lista 2", "Item Lista 3"];

    settings.icon_list = listItems.map(t => ({
      text: t,
      selected_icon: { value: "fas fa-check", library: "fa-solid" }
    }));

    if (mainStyle.color) {
      settings.icon_color = mainStyle.color;
      settings.text_color = mainStyle.color;
    }
    settings.text_typography_typography = "custom";
    settings.text_typography_font_size = { size: mainStyle.size, unit: "px" };
    settings.text_typography_font_weight = mainStyle.weight;
  }
  else if (tag === "heading") {
    settings.title = texts.join(" ");
    if (mainStyle.color) settings.title_color = mainStyle.color;
    settings.typography_typography = "custom";
    settings.typography_font_size = { size: mainStyle.size, unit: "px" };
    settings.typography_font_weight = mainStyle.weight;
  }
  else if (tag === "text-editor") {
    settings.editor = texts.join("<br>");
    if (mainStyle.color) settings.text_color = mainStyle.color;
    settings.typography_typography = "custom";
    settings.typography_font_size = { size: mainStyle.size, unit: "px" };
    settings.typography_font_weight = mainStyle.weight;
  }
  else if (tag === "image") {
    settings.image = { url: "", id: "" };
    settings._width = { size: node.width, unit: "px" };
  }

  return { elType: "widget", widgetType: tag, settings: settings };
}

function mapContainer(node, children, isRoot, isForcedFull) {
  if (!children || children.length === 0) return null;
  const isBoxed = (isRoot === true && isForcedFull === false);
  const bgSettings = extractBackground(node);
  const direction = getLayoutDirection(node);

  let containerWidth = { size: 100, unit: "%" };

  if (isRoot) {
    containerWidth = isBoxed ? { size: 1140, unit: "px" } : { size: 100, unit: "%" };
  } else {
    if (node.layoutSizingHorizontal === 'FIXED') {
      containerWidth = { size: node.width, unit: "px" };
    } else if (node.layoutSizingHorizontal === 'FILL') {
      containerWidth = { size: 100, unit: "%" };
    } else {
      containerWidth = { size: node.width, unit: "px" };
    }
  }

  const settings = {
    content_width: isBoxed ? "boxed" : "full",
    width: containerWidth,
    flex_direction: direction,
    justify_content: node.primaryAxisAlignItems === "CENTER" ? "center" : "flex-start",
    align_items: node.counterAxisAlignItems === "CENTER" ? "center" : "flex-start",
    gap: { column: node.itemSpacing || 0, row: node.itemSpacing || 0, unit: "px" },
    padding: {
      top: node.paddingTop || 0, right: node.paddingRight || 0,
      bottom: node.paddingBottom || 0, left: node.paddingLeft || 0,
      unit: "px"
    }
  };

  if (direction === "row") {
    settings.flex_wrap = "nowrap";
  }

  if (bgSettings.background_background) {
    settings.background_background = bgSettings.background_background;
    settings.background_color = bgSettings.background_color;
  }

  extractBorders(node, settings, false);
  extractShadows(node, settings, false);

  return { elType: "container", settings: settings, elements: children };
}

function mapText(node) {
  const style = extractTextStyle(node);
  const widgetType = style.size >= 32 ? "heading" : "text-editor";
  let settings = {
    align: "center",
    typography_typography: "custom",
    typography_font_size: { size: style.size, unit: "px" },
    typography_font_weight: style.weight
  };

  extractShadows(node, settings, true);

  if (widgetType === "heading") {
    settings.title = node.characters;
    if (style.color) settings.title_color = style.color;
  } else {
    settings.editor = node.characters;
    if (style.color) settings.text_color = style.color;
  }
  return { elType: "widget", widgetType: widgetType, settings: settings };
}

function mapImage(node) {
  let settings = { image: { url: "", id: "" }, align: "center" };

  extractBorders(node, settings, true, "image");
  extractShadows(node, settings, true, "image");

  return { elType: "widget", widgetType: "image", settings: settings };
}

function hasImageFill(node) {
  if (!node.fills || node.fills === figma.mixed) return false;
  return Array.isArray(node.fills) && node.fills.some(f => f.type === 'IMAGE');
}