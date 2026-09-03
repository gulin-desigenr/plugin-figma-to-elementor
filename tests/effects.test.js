import test from "node:test";
import assert from "node:assert/strict";
import {
  ELEMENTOR_SELECTOR_REGISTRY,
  resolveItemSelector,
  resolveSelector
} from "../src/styles/elementor-selectors.js";
import {
  applyAdvancedEffects,
  extractAdvancedEffects,
  summarizeEffects
} from "../src/styles/effects.js";
import { normalizeElementorDocument } from "../extension/src/contract.js";
import { validateExportDocument } from "../src/core/contract.js";

test("selector registry covers every Figmentor widget and exposes explicit slots", () => {
  const supported = [
    "heading", "text-editor", "image", "image-box", "icon-box", "icon-list",
    "button", "accordion", "nested-accordion", "image-carousel", "nested-carousel"
  ];

  for (const widgetType of supported) {
    assert.ok(ELEMENTOR_SELECTOR_REGISTRY[widgetType], widgetType);
    assert.equal(typeof resolveSelector(widgetType, "hero", "root"), "string");
  }

  assert.equal(resolveSelector("button", "hero", "text"), "#hero .elementor-button-text");
  assert.equal(resolveSelector("icon-box", "hero", "icon"), "#hero .elementor-icon-box-icon");
  assert.equal(resolveItemSelector("accordion", "faq", 2), '#faq .elementor-tab-title[data-tab="2"]');
  assert.equal(ELEMENTOR_SELECTOR_REGISTRY["nested-carousel"].experimental, true);
});

test("advanced gradients, blur, blend and compound shadows become scoped CSS", () => {
  const report = extractAdvancedEffects({
    fills: [{
      type: "GRADIENT_LINEAR",
      opacity: 0.9,
      gradientHandlePositions: [{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }],
      gradientStops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
      ]
    }],
    effects: [
      { type: "DROP_SHADOW", offset: { x: 0, y: 8 }, radius: 24, spread: 0, color: { r: 0, g: 0, b: 0, a: 0.2 } },
      { type: "INNER_SHADOW", offset: { x: 0, y: 1 }, radius: 4, spread: 0, color: { r: 0, g: 0, b: 0, a: 0.3 } },
      { type: "BACKGROUND_BLUR", radius: 12 }
    ],
    blendMode: "MULTIPLY",
    opacity: 0.8
  }, "button", "hero");

  assert.equal(report.strategy, "custom_css");
  assert.equal(report.selector, "#hero");
  assert.match(report.css, /linear-gradient/);
  assert.match(report.css, /box-shadow/);
  assert.match(report.css, /backdrop-filter: blur\(12px\)/);
  assert.match(report.css, /mix-blend-mode: multiply/);
  assert.ok(report.flags.includes("inner-shadow-css"));
});

test("advanced effects keep representable native layers in the generated CSS", () => {
  const report = extractAdvancedEffects({
    fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1 }],
    effects: [{ type: "LAYER_BLUR", radius: 12 }]
  }, "container", "hero");

  assert.equal(report.strategy, "custom_css");
  assert.match(report.css, /background: rgba\(255,0,0,1\)/);
  assert.match(report.css, /filter: blur\(12px\)/);
});

test("text gradients target the explicit Elementor text slot and preserve solid layers", () => {
  const report = extractAdvancedEffects({
    fills: [
      { type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1 },
      {
        type: "GRADIENT_LINEAR",
        gradientHandlePositions: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }],
        gradientStops: [
          { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
          { position: 1, color: { r: 0, g: 1, b: 0, a: 1 } }
        ]
      }
    ]
  }, "heading", "headline");

  assert.match(report.css, /#headline \.elementor-heading-title/);
  assert.match(report.css, /rgba\(255,255,255,1\), linear-gradient/);
  assert.match(report.css, /background-clip: text/);
});

test("unsupported effects and item targets are explicit in the report", () => {
  const report = extractAdvancedEffects({
    fills: [{
      type: "GRADIENT_DIAMOND",
      gradientStops: [
        { position: 0, color: { r: 1, g: 1, b: 1, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 0, a: 1 } }
      ]
    }],
    effects: [{ type: "UNKNOWN_EFFECT", radius: 4 }],
    blendMode: "UNKNOWN_BLEND",
    children: [{ id: "a" }, { id: "b" }]
  }, "accordion", "faq");

  assert.equal(report.strategy, "custom_css");
  assert.ok(report.flags.includes("approximation:gradient-diamond-to-radial"));
  assert.ok(report.flags.includes("effect:UNKNOWN_EFFECT"));
  assert.ok(report.flags.includes("blend-mode:UNKNOWN_BLEND"));
  assert.deepEqual(report.itemSelectors, [
    '#faq .elementor-tab-title[data-tab="1"]',
    '#faq .elementor-tab-title[data-tab="2"]'
  ]);
});

test("invalid CSS IDs never escape the selector scope", () => {
  const report = extractAdvancedEffects({
    fills: [{
      type: "GRADIENT_LINEAR",
      gradientStops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
      ]
    }]
  }, "button", "hero, body");

  assert.equal(report.css, "");
  assert.equal(report.selector, null);
  assert.ok(report.flags.includes("invalid-css-id"));
  assert.equal(report.strategy, "flag");
});

test("a single solid fill and one drop shadow remain native", () => {
  const settings = {};
  const report = extractAdvancedEffects({
    fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1 }],
    effects: [{ type: "DROP_SHADOW", offset: { x: 0, y: 4 }, radius: 8, color: { r: 0, g: 0, b: 0, a: 0.2 } }]
  }, "heading", "title");

  applyAdvancedEffects(settings, report);
  assert.equal(report.strategy, "native");
  assert.equal(settings.custom_css, undefined);
  assert.equal(settings.figmentor_effects.strategy, "native");
});

test("normalization guarantees a stable CSS ID for every exported element", () => {
  const document = normalizeElementorDocument({
    version: "0.4",
    type: "page",
    page_settings: {},
    content: [{
      elType: "container",
      settings: {},
      elements: [{ elType: "widget", widgetType: "heading", settings: { title: "Título" } }]
    }]
  }, "page");

  assert.match(document.content[0].settings.css_id, /^figmentor-c/);
  assert.match(document.content[0].elements[0].settings.css_id, /^figmentor-w/);

  const unsafe = normalizeElementorDocument({
    version: "0.4",
    type: "page",
    page_settings: {},
    content: [{ elType: "widget", widgetType: "heading", settings: { css_id: "123; color:red" } }]
  }, "page");
  assert.match(unsafe.content[0].settings.css_id, /^figmentor-w/);
});

test("effect summaries remain compact and count CSS and flags without duplicating UI reports", () => {
  const summary = summarizeEffects([{
    settings: { figmentor_effects: { strategy: "custom_css", flags: ["inner-shadow-css"] } },
    elements: [{ settings: { figmentor_effects: { strategy: "native", flags: [] } }, elements: [] }]
  }]);

  assert.deepEqual(summary, { total: 2, native: 1, customCss: 1, flags: 1, unsupported: 0 });
});

test("the native plugin contract validates scoped custom CSS too", () => {
  const invalid = validateExportDocument({
    version: "0.4",
    type: "page",
    page_settings: {},
    content: [{
      id: "w123456",
      elType: "widget",
      widgetType: "heading",
      isInner: false,
      settings: { css_id: "hero", custom_css: "body { color: red; }" },
      elements: []
    }]
  }, "page");

  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join("\n"), /custom_css/);
});
