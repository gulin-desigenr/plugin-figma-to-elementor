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
    const selection = figma.currentPage.selection;
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
    if (!node.fills || node.fills === figma.mixed) return false;
    return Array.isArray(node.fills) && node.fills.some((f) => f.type === "IMAGE");
  }
  function getNodeRole(node) {
    const pluginRole = node.getPluginData("elementor_role");
    if (pluginRole) return pluginRole;
    const name = (node.name || "").toLowerCase();
    if (name.includes("[title]")) return "title_text";
    if (name.includes("[description]")) return "description_text";
    if (name.includes("[icon]")) return "icon";
    if (name.includes("[image]")) return "image";
    return null;
  }
  function getSafeFontFamily(node) {
    if (!node || node.fontName === figma.mixed || !node.fontName) return null;
    return node.fontName.family || null;
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
    if (node.type === "TEXT" && node.textAlignHorizontal && node.textAlignHorizontal !== figma.mixed) {
      return mapTextAlign(node.textAlignHorizontal);
    }
    if ("findOne" in node) {
      const textChild = node.findOne((child) => child.type === "TEXT" && child.textAlignHorizontal && child.textAlignHorizontal !== figma.mixed);
      if (textChild) {
        return mapTextAlign(textChild.textAlignHorizontal);
      }
    }
    return "left";
  }

  // src/styles/index.js
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
    if (node.fills && node.fills !== figma.mixed && node.fills.length > 0) {
      if (node.fills[0].type === "SOLID") {
        color = figmaColorToRGBA(node.fills[0].color, node.fills[0].opacity);
        if (node.fillStyleId) {
          const style = await figma.getStyleByIdAsync(node.fillStyleId);
          if (style && maps.colorMap && maps.colorMap[style.name]) {
            globalColorId = maps.colorMap[style.name];
          }
        }
      }
    }
    const size = node.fontSize !== void 0 && node.fontSize !== figma.mixed ? node.fontSize : 16;
    let weight = "400";
    if (node.fontName !== void 0 && node.fontName !== figma.mixed) {
      weight = mapFontWeight(node.fontName.style);
    }
    const fontFamily = getSafeFontFamily(node);
    let lineHeight = null;
    if (node.lineHeight !== void 0 && node.lineHeight !== figma.mixed) {
      if (node.lineHeight.unit !== "AUTO") {
        lineHeight = {
          size: node.lineHeight.value,
          unit: node.lineHeight.unit === "PIXELS" ? "px" : "%"
        };
      }
    }
    let letterSpacing = null;
    if (node.letterSpacing !== void 0 && node.letterSpacing !== figma.mixed) {
      if (node.letterSpacing.value !== 0) {
        letterSpacing = {
          size: node.letterSpacing.value,
          unit: node.letterSpacing.unit === "PIXELS" ? "px" : "em"
        };
      }
    }
    let textTransform = null;
    if (node.textCase !== void 0 && node.textCase !== figma.mixed) {
      const caseMap = {
        UPPER: "uppercase",
        LOWER: "lowercase",
        TITLE: "capitalize",
        SMALL_CAPS: "uppercase"
      };
      textTransform = caseMap[node.textCase] || null;
    }
    let textDecoration = null;
    if (node.textDecoration !== void 0 && node.textDecoration !== figma.mixed) {
      const decorMap = {
        UNDERLINE: "underline",
        STRIKETHROUGH: "line-through"
      };
      textDecoration = decorMap[node.textDecoration] || null;
    }
    let fontStyle = null;
    if (node.fontName !== void 0 && node.fontName !== figma.mixed) {
      if (node.fontName.style.includes("Italic")) {
        fontStyle = "italic";
      }
    }
    if (node.textStyleId) {
      const style = await figma.getStyleByIdAsync(node.textStyleId);
      if (style && maps.typoMap && maps.typoMap[style.name]) {
        globalTypoId = maps.typoMap[style.name];
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
    if (node.fills && node.fills !== figma.mixed && node.fills.length > 0) {
      const solidFill = node.fills.find((f) => f.type === "SOLID" && f.visible !== false);
      if (solidFill) {
        const color = figmaColorToRGBA(solidFill.color, solidFill.opacity);
        let globalColorId = null;
        if (node.fillStyleId) {
          const style = await figma.getStyleByIdAsync(node.fillStyleId);
          if (style && maps.colorMap && maps.colorMap[style.name]) {
            globalColorId = maps.colorMap[style.name];
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

  // src/core/handlers.js
  function applyOpacitySetting(settings, node) {
    if (node.opacity !== void 0 && node.opacity < 1) {
      settings._opacity = String(Math.round(node.opacity * 100));
    }
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
    if (tag === "container" || tag === "container-full" || tag === "page-wrapper") {
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
      return await mapContainer(node, children, isRoot, tag === "container-full", maps);
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
        if (vector.name.startsWith("fas ") || vector.name.startsWith("fab ") || vector.name.startsWith("far ")) {
          iconName = vector.name;
        }
        if (vector.fills && vector.fills !== figma.mixed && vector.fills.length > 0) {
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
          if (vector.name.startsWith("fas ") || vector.name.startsWith("fab ") || vector.name.startsWith("far ")) {
            settings.selected_icon = { value: vector.name, library: vector.name.startsWith("fab") ? "fa-brands" : "fa-solid" };
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
      const cssId2 = sanitizeCssId(node.name);
      if (cssId2) settings.css_id = cssId2;
      applyOpacitySetting(settings, node);
      return { elType: "widget", widgetType: "nested-carousel", settings, elements };
    }
    const cssId = sanitizeCssId(node.name);
    if (cssId) settings.css_id = cssId;
    applyOpacitySetting(settings, node);
    return { elType: "widget", widgetType: tag, settings };
  }
  async function mapContainer(node, children, isRoot, isForcedFull, maps) {
    try {
      if (!children || children.length === 0) return null;
      const bgSettings = await extractBackground(node, maps);
      const direction = getLayoutDirection(node);
      let containerWidth = { size: 100, unit: "%" };
      if (isRoot) {
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
      if (isRoot) {
        settings.content_width = "boxed";
        settings.boxed_width = { size: 1140, unit: "px" };
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
      const cssId = sanitizeCssId(node.name);
      if (cssId) settings.css_id = cssId;
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
      const cssId = sanitizeCssId(node.name);
      if (cssId) settings.css_id = cssId;
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
    const cssId = sanitizeCssId(node.name);
    if (cssId) settings.css_id = cssId;
    return { elType: "widget", widgetType: "image", settings };
  }

  // src/core/traverse.js
  async function traverseNode(node, isRoot, maps = { colorMap: {}, typoMap: {} }, isInsideValidated = false) {
    if (!node || typeof node.visible === "undefined" || !node.visible) return null;
    const manualTag = node.getPluginData("elementor-tag");
    if (manualTag === "image-background" || manualTag === "ignore") {
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

  // src/index.js
  try {
    figma.showUI(__html__, { width: 400, height: 620 });
    figma.ui.onmessage = (msg) => {
      try {
        if (msg.type === "apply-tag") {
          const selection = figma.currentPage.selection;
          if (selection.length > 0) {
            selection.forEach((node) => {
              node.setPluginData("elementor-tag", "");
              node.setPluginData("elementor-tag", msg.tag);
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
        if (msg.type === "export-json") {
          const selection = figma.currentPage.selection;
          if (selection.length === 0) {
            figma.notify("Selecione o Frame Principal.");
            return;
          }
          if (selection.length > 1) {
            figma.notify("\u{1F6A8} Selecione apenas UM frame raiz. Use [PAGE-WRAPPER] com Auto Layout se necess\xE1rio.", { error: true });
            return;
          }
          figma.notify("\u23F3 Calculando \xE1rvore...");
          (async () => {
            try {
              let sanitizeOutput = function(nodes) {
                if (!nodes || !Array.isArray(nodes)) return;
                nodes.forEach((node) => {
                  if (node && node.settings) {
                    delete node.settings._position;
                    delete node.settings.position;
                    delete node.settings.margin;
                    delete node.settings._margin;
                    delete node.settings.custom_css;
                    delete node.settings._offset_x;
                    delete node.settings._offset_y;
                    delete node.settings._z_index;
                    delete node.settings.offset_x;
                    delete node.settings.offset_y;
                  }
                  if (node && node.elements) {
                    sanitizeOutput(node.elements);
                  }
                });
              };
              const { colorMap, typoMap } = msg;
              let structure = await traverseNode(selection[0], true, { colorMap, typoMap });
              let content = Array.isArray(structure) ? structure : [structure];
              sanitizeOutput(content);
              const elementorJSON = {
                version: "0.4",
                title: "Export V19 Soltos Fix - " + selection[0].name,
                type: "container",
                content
              };
              figma.ui.postMessage({ type: "json-generated", data: JSON.stringify(elementorJSON, null, 2) });
              figma.notify("\u2705 JSON Gerado com Sucesso!");
            } catch (err) {
              figma.notify("Erro na exporta\xE7\xE3o: " + err.message);
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
