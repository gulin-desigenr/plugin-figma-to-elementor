import test from "node:test";
import assert from "node:assert/strict";
import { adaptRestNode, buildRestStyleMaps } from "../extension/src/figma-rest-adapter.js";
import { traverseNode } from "../src/core/traverse.js";
import { handleManualTag } from "../src/core/handlers.js";

const pluginId = "figma-to-elementor-test";

test("traverseNode descarta node órfão sem tag", async () => {
  const orphanNode = adaptRestNode(
    {
      id: "1:1",
      name: "Orphan Frame",
      type: "FRAME"
    },
    pluginId
  );
  const maps = buildRestStyleMaps(orphanNode);

  const result = await traverseNode(orphanNode, false, maps, false);

  assert.equal(result, null);
});

test("traverseNode descarta qualquer node com tag ignore em diferentes posições", async () => {
  const rootIgnoreNode = adaptRestNode(
    {
      id: "2:1",
      name: "Ignored Root",
      type: "FRAME",
      pluginData: { [pluginId]: { "elementor-tag": "ignore" } }
    },
    pluginId
  );
  const rootMaps = buildRestStyleMaps(rootIgnoreNode);
  const rootResult = await traverseNode(rootIgnoreNode, true, rootMaps, false);
  assert.equal(rootResult, null);

  const childIgnoreNode = adaptRestNode(
    {
      id: "2:2",
      name: "Ignored Child",
      type: "FRAME",
      pluginData: { [pluginId]: { "elementor-tag": "ignore" } }
    },
    pluginId
  );
  const childMaps = buildRestStyleMaps(childIgnoreNode);

  const childResultValidated = await traverseNode(childIgnoreNode, false, childMaps, true);
  assert.equal(childResultValidated, null);

  const childResultUnvalidated = await traverseNode(childIgnoreNode, false, childMaps, false);
  assert.equal(childResultUnvalidated, null);
});

test("handleManualTag processa tag button com texto e alinhamento padrão", async () => {
  const buttonNode = adaptRestNode(
    {
      id: "3:1",
      name: "[BUTTON] CTA",
      type: "FRAME",
      pluginData: { [pluginId]: { "elementor-tag": "button" } },
      children: [
        {
          id: "3:2",
          name: "Label",
          type: "TEXT",
          characters: "Comprar agora"
        }
      ]
    },
    pluginId
  );
  const maps = buildRestStyleMaps(buttonNode);

  const result = await handleManualTag(buttonNode, "button", false, maps);

  assert.ok(result);
  assert.equal(result.elType, "widget");
  assert.equal(result.widgetType, "button");
  assert.equal(result.settings.text, "Comprar agora");
  assert.equal(result.settings.align, "left");
});

test("handleManualTag processa tag container-carousel retornando nested-carousel com elements mapeados", async () => {
  const carouselNode = adaptRestNode(
    {
      id: "4:1",
      name: "Container Carousel",
      type: "FRAME",
      pluginData: { [pluginId]: { "elementor-tag": "container-carousel" } },
      children: [
        {
          id: "4:2",
          name: "Slide 1",
          type: "FRAME",
          pluginData: { [pluginId]: { "elementor-tag": "container" } },
          children: []
        },
        {
          id: "4:3",
          name: "Slide 2",
          type: "FRAME",
          pluginData: { [pluginId]: { "elementor-tag": "container" } },
          children: []
        }
      ]
    },
    pluginId
  );
  const maps = buildRestStyleMaps(carouselNode);

  const result = await handleManualTag(carouselNode, "container-carousel", false, maps);

  assert.ok(result);
  assert.equal(result.elType, "widget");
  assert.equal(result.widgetType, "nested-carousel");
  assert.ok(Array.isArray(result.elements));
  assert.equal(result.elements.length, 2);
  assert.equal(result.elements[0].elType, "container");
  assert.equal(result.elements[1].elType, "container");
});

test("handleManualTag processa tag accordeon sem itens reconhecíveis caindo no fallback padrão", async () => {
  const accordeonNode = adaptRestNode(
    {
      id: "5:1",
      name: "Accordeon",
      type: "FRAME",
      pluginData: { [pluginId]: { "elementor-tag": "accordeon" } },
      children: []
    },
    pluginId
  );
  const maps = buildRestStyleMaps(accordeonNode);

  const result = await handleManualTag(accordeonNode, "accordeon", false, maps);

  assert.ok(result);
  assert.equal(result.elType, "widget");
  assert.equal(result.widgetType, "nested-accordion");
  assert.ok(Array.isArray(result.settings?.items));
  assert.equal(result.settings.items.length, 2);
  assert.equal(result.settings.items[0].item_title, "Item #1");
  assert.equal(result.settings.items[1].item_title, "Item #2");
  assert.ok(Array.isArray(result.elements));
  assert.equal(result.elements.length, 2);
  assert.equal(result.elements[0].elType, "container");
  assert.equal(result.elements[1].elType, "container");
});

test("handleManualTag chamado diretamente com image-background e background-image retorna null", async () => {
  const node = adaptRestNode(
    {
      id: "6:1",
      name: "[IMAGE-BACKGROUND] Hero background",
      type: "FRAME",
      pluginData: { [pluginId]: { "elementor-tag": "image-background" } },
      children: [
        {
          id: "6:2",
          name: "Child",
          type: "RECTANGLE"
        }
      ]
    },
    pluginId
  );
  const maps = buildRestStyleMaps(node);

  const resImageBg = await handleManualTag(node, "image-background", false, maps);
  assert.equal(resImageBg, null);

  const resBgImage = await handleManualTag(node, "background-image", false, maps);
  assert.equal(resBgImage, null);
});
