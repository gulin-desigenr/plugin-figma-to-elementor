import { traverseNode } from "./traverse.js";
import {
  extractBorders,
  extractShadows,
  extractTextStyle,
  extractBackground
} from "../styles/index.js";
import { figmaColorToRGBA } from "../utils/colors.js";
import { sanitizeCssId } from "../utils/cssId.js";
import {
  getIterableNodes,
  getLayoutDirection,
  getTextAlign,
  hasImageFill,
  getNodeRole,
  isFigmaMixed
} from "../utils/nodes.js";
import { applyTypographySettings } from "../utils/typography.js";
import { applyAdvancedEffects, extractAdvancedEffects } from "../styles/effects.js";

function applyOpacitySetting(settings, node) {
  if (node.opacity !== undefined && node.opacity < 1) {
    settings._opacity = String(Math.round(node.opacity * 100));
  }
}

function applySourceMetadata(settings, node, tag = null) {
  if (!settings || !node?.id) return settings;
  if (!settings.css_id) {
    settings.css_id =
      sanitizeCssId(`figmentor-${tag || "element"}-${node.id}`) || "figmentor-element";
  }
  if (!node.__figmentorRest) return settings;
  settings.figmentor_source_node_id = node.id;
  const resolvedTag = tag || node.getPluginData?.("elementor-tag");
  if (resolvedTag) settings.figmentor_source_tag = resolvedTag;
  return settings;
}

function applyNodeEffects(settings, node, tag) {
  if (!settings || !node || !tag) return settings;
  const widgetType =
    tag === "accordeon"
      ? "nested-accordion"
      : tag === "container-carousel"
        ? "nested-carousel"
        : tag;
  return applyAdvancedEffects(settings, extractAdvancedEffects(node, widgetType, settings.css_id));
}

function getFontAwesomeName(node) {
  const value = String(node?.name || "")
    .replace(/^\[icon\]\s*/i, "")
    .trim();
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
      (textNode) => getNodeRole(textNode) === "title_text"
    );
    const explicitDescriptionNode = childTextNodes.find(
      (textNode) => getNodeRole(textNode) === "description_text"
    );

    const fallbackTitleNode = explicitTitleNode || childTextNodes[0];
    const fallbackContentNodes = explicitDescriptionNode
      ? [explicitDescriptionNode]
      : childTextNodes.filter((textNode) => textNode.id !== fallbackTitleNode.id);

    const tabTitle =
      (fallbackTitleNode && fallbackTitleNode.characters && fallbackTitleNode.characters.trim()) ||
      `Item ${items.length + 1}`;
    const tabContent =
      fallbackContentNodes
        .map((textNode) => textNode.characters.trim())
        .filter(Boolean)
        .join("<br>") || "Conteúdo do item";

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
      (textNode) => getNodeRole(textNode) === "title_text"
    );

    const fallbackTitleNode = explicitTitleNode || childTextNodes[0];
    const directChildren = "children" in child ? child.children.filter((item) => item.visible) : [];

    let explicitContentNode = null;
    if ("findAll" in child) {
      explicitContentNode =
        child.findAll(
          (nodeItem) =>
            nodeItem.visible &&
            nodeItem.id !== fallbackTitleNode.id &&
            getNodeRole(nodeItem) === "description_text"
        )[0] || null;
    }

    let titleBranchNode = null;
    if (directChildren.length > 0 && fallbackTitleNode) {
      titleBranchNode =
        directChildren.find(
          (nodeItem) =>
            nodeItem.id === fallbackTitleNode.id ||
            ("findOne" in nodeItem &&
              nodeItem.findOne((descendant) => descendant.id === fallbackTitleNode.id))
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

    const tabTitle =
      (fallbackTitleNode && fallbackTitleNode.characters && fallbackTitleNode.characters.trim()) ||
      `Accordion #${items.length + 1}`;

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

export function applyChildFillSizing(childNode, childResult) {
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

export async function handleManualTag(node, tag, isRoot, maps) {
  if (
    tag === "container" ||
    tag === "container-full" ||
    tag === "page-wrapper" ||
    tag === "image-background" ||
    tag === "background-image"
  ) {
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

    // Checkpoint 6: Pseudo-Wrapper logic
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
    const titleNode = textNodes.find((n) => getNodeRole(n) === "title_text");
    const descNode = textNodes.find((n) => getNodeRole(n) === "description_text");

    settings.title_text = titleNode ? titleNode.characters : texts[0] || "Título";
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
    const titleNode = textNodes.find((n) => getNodeRole(n) === "title_text");
    const descNode = textNodes.find((n) => getNodeRole(n) === "description_text");

    settings.title_text = titleNode ? titleNode.characters : texts[0] || "Título do Ícone";
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

    const specificIconVector = vectorNodes.find((n) => getNodeRole(n) === "icon");
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

      const specificIconVector = vectorNodes.find((n) => getNodeRole(n) === "icon");
      if (specificIconVector) vectorNodes = [specificIconVector];

      if (vectorNodes.length > 0) {
        const vector = vectorNodes[0];
        const detectedIconName = getFontAwesomeName(vector);
        if (detectedIconName) {
          settings.selected_icon = {
            value: detectedIconName,
            library: detectedIconName.startsWith("fab")
              ? "fa-brands"
              : detectedIconName.startsWith("far")
                ? "fa-regular"
                : "fa-solid"
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
      console.error("Erro crítico extraindo button, ignorando componente:", err);
      return null;
    }
  } else if (tag === "accordion") {
    const { items, titleStyle, contentStyle } = await buildAccordionItems(node, maps);

    settings.tabs =
      items.length > 0
        ? items
        : [
            {
              tab_title: "Accordion #1",
              tab_content: "Conteúdo do accordion"
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

    settings.items =
      items.length > 0
        ? items
        : [
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
      settings: settings,
      elements:
        elements.length > 0
          ? elements
          : [
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
      if (
        child.type === "IMAGE" ||
        hasImageFill(child) ||
        child.type === "RECTANGLE" ||
        child.type === "FRAME"
      ) {
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
      settings: settings,
      elements: elements
    };
  }

  applyOpacitySetting(settings, node);
  applySourceMetadata(settings, node, tag);
  applyNodeEffects(settings, node, tag);

  return { elType: "widget", widgetType: tag, settings: settings };
}

export async function mapContainer(node, children, isRoot, isForcedFull, maps, allowEmpty = false) {
  try {
    if (!children || (children.length === 0 && !allowEmpty)) return null;
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

    return { elType: "container", settings: settings, elements: children };
  } catch (err) {
    console.error("Erro crítico em mapContainer, ignorando:", err);
    return null;
  }
}

export async function mapText(node, maps) {
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
      settings.__globals__[widgetType === "heading" ? "title_color" : "text_color"] =
        `globals/colors?id=${style.globalColorId}`;
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
    return { elType: "widget", widgetType: widgetType, settings: settings };
  } catch (err) {
    console.error("Erro crítico em mapText, ignorando:", err);
    return null;
  }
}

export async function mapImage(node) {
  // Image widget alignment stays centered; actual positioning is controlled by the parent container.
  const settings = { image: { url: "", id: "" }, align: "center" };

  extractBorders(node, settings, true, "image");
  extractShadows(node, settings, true, "image");
  applyOpacitySetting(settings, node);

  applySourceMetadata(settings, node);
  applyNodeEffects(settings, node, "image");

  return { elType: "widget", widgetType: "image", settings: settings };
}
