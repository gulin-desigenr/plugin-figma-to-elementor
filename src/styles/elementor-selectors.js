/**
 * Versioned selector contract for the Elementor widgets Figmentor exports.
 *
 * Selectors are intentionally relative to the element wrapper. The wrapper is
 * made deterministic by the export contract (`settings.css_id`), so generated
 * CSS never needs to infer a widget from its position in the DOM.
 */
export const ELEMENTOR_SELECTOR_PROFILE = "elementor-core-3.x";
const CSS_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

const ROOT = { selector: "", label: "element root" };

export const ELEMENTOR_SELECTOR_REGISTRY = Object.freeze({
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
    reason: "O widget nested-carousel não está presente no core Elementor verificado; exige perfil alvo validado.",
    root: ROOT,
    slots: {}
  }
});

export function getSelectorDefinition(widgetType) {
  return ELEMENTOR_SELECTOR_REGISTRY[widgetType] || null;
}

export function selectorFor(widgetType, slot = "root") {
  const definition = getSelectorDefinition(widgetType);
  if (!definition) return null;
  return definition.slots?.[slot]?.selector ?? definition.root.selector;
}

export function scopeSelector(cssId, relativeSelector = "") {
  if (!cssId || typeof cssId !== "string" || !CSS_ID_PATTERN.test(cssId)) return null;
  const root = `#${cssId}`;
  if (!relativeSelector) return root;
  if (relativeSelector.startsWith("::") || relativeSelector.startsWith(":") || relativeSelector.startsWith("[")) {
    return `${root}${relativeSelector}`;
  }
  return `${root} ${relativeSelector}`;
}

export function resolveSelector(widgetType, cssId, slot = "root") {
  const relative = selectorFor(widgetType, slot);
  return relative === null ? null : scopeSelector(cssId, relative);
}

export function resolveItemSelector(widgetType, cssId, index) {
  const definition = getSelectorDefinition(widgetType);
  if (!definition?.itemTarget || !Number.isInteger(index) || index < 1) return null;
  return scopeSelector(cssId, definition.itemTarget.replace("{index}", String(index)));
}
