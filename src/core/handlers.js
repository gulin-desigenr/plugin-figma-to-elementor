import { traverseNode } from './traverse.js';
import { extractBorders, extractShadows, extractTextStyle, extractBackground } from '../styles/index.js';
import { figmaColorToRGBA } from '../utils/colors.js';
import { getIterableNodes, getLayoutDirection, hasImageFill } from '../utils/nodes.js';

export function handleManualTag(node, tag, isRoot) {
  if (tag === 'container' || tag === 'container-full' || tag === 'page-wrapper') {
    let children = [];
    const childIsRoot = (tag === 'page-wrapper');
    
    if ("children" in node) {
      for (const child of node.children) {
        const res = traverseNode(child, childIsRoot);
        if (res) {
          if (Array.isArray(res)) children = children.concat(res);
          else children.push(res);
        }
      }
    }
    
    // Checkpoint 6: Pseudo-Wrapper logic
    if (tag === 'page-wrapper') {
      return children;
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
  else if (tag === "icon-box") {
    settings.title_text = texts[0] || "Título do Ícone";
    settings.title = settings.title_text;

    if (mainStyle.color) settings.title_color = mainStyle.color;
    settings.title_typography_typography = "custom";
    settings.title_typography_font_size = { size: mainStyle.size, unit: "px" };
    settings.title_typography_font_weight = mainStyle.weight;

    settings.description_text = texts.slice(1).join(" ");
    settings.description = settings.description_text;

    if (secStyle.color) settings.description_color = secStyle.color;
    settings.description_typography_typography = "custom";
    settings.description_typography_font_size = { size: secStyle.size, unit: "px" };
    settings.description_typography_font_weight = secStyle.weight;

    let iconColor = mainStyle.color;
    let iconName = "fas fa-star";

    let vectorNodes = [];
    if (node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION") vectorNodes.push(node);
    else if ("findAll" in node) vectorNodes = node.findAll(n => n.type === "VECTOR" || n.type === "BOOLEAN_OPERATION");

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
  else if (tag === "button") {
    try {
      settings.text = texts.join(" ") || "Clique Aqui";

      if (mainStyle.color) {
        settings.text_color = mainStyle.color;
      }

      settings.typography_typography = "custom";
      settings.typography_font_size = { size: mainStyle.size, unit: "px" };
      settings.typography_font_weight = mainStyle.weight;

      if (settings._background_color) {
        settings.background_color = settings._background_color;
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
        vectorNodes = node.findAll(n => n.type === "VECTOR" || n.type === "BOOLEAN_OPERATION");
      }
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
        const reaction = node.reactions.find(r => r.action && r.action.type === "URL");
        if (reaction) {
          settings.link = { url: reaction.action.url, is_external: true };
        }
      }
    } catch (err) {
      console.error("Erro crítico extraindo button, ignorando componente:", err);
      return null;
    }
  }
  else if (tag === "image") {
    settings.image = { url: "", id: "" };
    settings._width = { size: node.width, unit: "px" };
  }
  else if (tag === "image-carousel") {
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
  }
  else if (tag === "container-carousel") {
    const iterableNodes = getIterableNodes(node);
    let elements = [];
    
    for (const child of iterableNodes) {
      const res = traverseNode(child, false);
      if (res) {
        if (Array.isArray(res)) {
          elements.push({ elType: "container", settings: {}, elements: res });
        }
        else if (res.elType !== "container") {
          elements.push({ elType: "container", settings: {}, elements: [res] });
        }
        else {
          elements.push(res);
        }
      }
    }

    settings.slides_to_show = "3";
    settings.slides_to_scroll = "1";
    settings.navigation = "both";
    
    return { elType: "widget", widgetType: "nested-carousel", settings: settings, elements: elements };
  }

  return { elType: "widget", widgetType: tag, settings: settings };
}

export function mapContainer(node, children, isRoot, isForcedFull) {
  try {
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
  } catch (err) {
    console.error("Erro crítico em mapContainer, ignorando:", err);
    return null;
  }
}

export function mapText(node) {
  try {
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
  } catch (err) {
    console.error("Erro crítico em mapText, ignorando:", err);
    return null;
  }
}

export function mapImage(node) {
  let settings = { image: { url: "", id: "" }, align: "center" };

  extractBorders(node, settings, true, "image");
  extractShadows(node, settings, true, "image");

  return { elType: "widget", widgetType: "image", settings: settings };
}
