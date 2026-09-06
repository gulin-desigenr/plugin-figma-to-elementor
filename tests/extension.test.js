import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFigmaFileUrl } from "../extension/src/figma-api.js";
import { DEFAULT_FIGMENTOR_NAMESPACE } from "../extension/src/constants.js";
import {
  buildAssetManifest,
  createAssetReport,
  discoverAssets,
  getNodeRole,
  getNodeTag,
  selectAssetsForProcessing
} from "../extension/src/assets.js";
import { buildElementorDocument, patchElementorAssets } from "../extension/src/elementor.js";
import { normalizeElementorDocument, validateElementorDocument } from "../extension/src/contract.js";
import { compositeBackgroundImage, convertPngBlobToWebp } from "../extension/src/webp.js";
import {
  buildElementorAjaxBody,
  buildElementorSavePayload,
  ensureWordPressDraft,
  extractWordPressContext,
  insertElementorDocument,
  isAllowedWordPressTabUrl,
  validateWordPressContext,
  verifyElementorPersistence
} from "../extension/src/wordpress.js";

const pluginId = "figma-to-elementor-test";

test("extension UI exposes the phased workflow and Elementor action", () => {
  const extensionRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "extension"
  );
  const html = fs.readFileSync(path.join(extensionRoot, "popup.html"), "utf8");

  assert.match(html, /id="screen-token"/);
  assert.match(html, /id="screen-figma"/);
  assert.match(html, /id="screen-elementor"/);
  assert.match(html, /id="continue-token"/);
  assert.match(html, /id="insert-elementor"/);
});

test("extension parses Figma file and optional node URLs", () => {
  assert.deepEqual(
    parseFigmaFileUrl("https://www.figma.com/design/abc123/Landing?node-id=12%3A34"),
    {
      fileKey: "abc123",
      nodeId: "12:34",
      url: "https://www.figma.com/design/abc123/Landing?node-id=12%3A34"
    }
  );
});

test("extension can use a Figma selection link as the frame source", () => {
  const parsed = parseFigmaFileUrl(
    "https://www.figma.com/design/abc123/Landing?node-id=44%3A55&m=dev"
  );

  assert.equal(parsed.fileKey, "abc123");
  assert.equal(parsed.nodeId, "44:55");
});

test("extension normalizes Figma URL node IDs from hyphens to colons", () => {
  const parsed = parseFigmaFileUrl(
    "https://www.figma.com/design/abc123/Landing?node-id=59-4&t=token"
  );

  assert.equal(parsed.nodeId, "59:4");
});

test("shared Figma data uses the stable Figmentor namespace", () => {
  assert.equal(DEFAULT_FIGMENTOR_NAMESPACE, "figmentor");
});

test("REST selection lookup selects the node from the active file", async () => {
  const { readCurrentSelection } = await import("../extension/src/figma-api.js");
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";

  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      async json() {
        return {
          selections: [
            { file_key: "other-file", node_id: "9:9" },
            { file_key: "file-key", node_id: "1:2", name: "[PAGE] Landing", type: "FRAME" }
          ]
        };
      }
    };
  };

  try {
    const selection = await readCurrentSelection("token", "file-key");
    assert.equal(selection.fileKey, "file-key");
    assert.equal(selection.nodeId, "1:2");
    assert.equal(selection.source, "REST_SELECTION");
    assert.equal(requestedUrl, "https://api.figma.com/v1/selections");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("REST selection lookup reports the missing scope clearly", async () => {
  const { readCurrentSelection } = await import("../extension/src/figma-api.js");
  const previousFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    async json() {
      return { err: "Invalid scope: selections:read" };
    }
  });

  try {
    await assert.rejects(
      () => readCurrentSelection("token", "file-key"),
      /file_content:read e selections:read/
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("registered-frame lookup requests a valid positive Figma depth", async () => {
  const { readRegisteredSelection } = await import("../extension/src/figma-api.js");
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";

  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      async json() {
        return {
          document: {
            sharedPluginData: {
              figmentor: {
                "figmentor-selected-root": JSON.stringify({
                  version: 1,
                  nodeId: "1:2",
                  name: "[CONTAINER] Hero",
                  type: "FRAME"
                })
              }
            }
          }
        };
      }
    };
  };

  try {
    const selection = await readRegisteredSelection("token", "file-key");
    assert.equal(selection.nodeId, "1:2");
    assert.match(requestedUrl, /depth=1/);
    assert.doesNotMatch(requestedUrl, /depth=0/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("extension reads plugin tags and roles from REST-shaped pluginData", () => {
  const node = {
    name: "[IMAGE] Hero visual",
    pluginData: {
      [pluginId]: {
        "elementor-tag": "image",
        elementor_role: "image"
      }
    }
  };

  assert.equal(getNodeTag(node, pluginId), "image");
  assert.equal(getNodeRole(node, pluginId), "image");
});

test("role prefixes are not promoted to Elementor widget tags", async () => {
  const roleOnlyNode = {
    id: "1:99",
    name: "[TITLE] Card title",
    type: "TEXT",
    characters: "Card title",
    pluginData: { [pluginId]: { elementor_role: "title_text" } }
  };

  assert.equal(getNodeTag(roleOnlyNode, pluginId), null);

  const root = {
    id: "1:90",
    name: "[CONTAINER] Card",
    type: "FRAME",
    pluginData: { [pluginId]: { "elementor-tag": "container" } },
    children: [roleOnlyNode]
  };
  const document = await buildElementorDocument(root, "section", pluginId);
  const validation = validateElementorDocument(document, "section");

  assert.equal(validation.valid, true);
  assert.notEqual(document.content[0].elements[0].widgetType, "title");
  assert.notEqual(document.content[0].elements[0].widgetType, "description");

  assert.equal(
    getNodeTag(
      {
        name: "[IMAGE] Inner image role",
        pluginData: { [pluginId]: { elementor_role: "image" } }
      },
      pluginId
    ),
    null
  );
});

test("extension discovers tagged image, background and SVG icon assets", () => {
  const root = {
    id: "1:1",
    name: "[CONTAINER] Hero",
    type: "FRAME",
    children: [
      {
        id: "1:2",
        name: "[IMAGE] Product card",
        type: "FRAME",
        width: 900,
        height: 600,
        pluginData: { [pluginId]: { "elementor-tag": "image" } }
      },
      {
        id: "1:3",
        name: "[BACKGROUND] Hero background",
        type: "FRAME",
        width: 1920,
        height: 800,
        pluginData: { [pluginId]: { "elementor-tag": "image-background" } }
      },
      {
        id: "1:4",
        name: "[ICON] Arrow",
        type: "VECTOR",
        width: 24,
        height: 24,
        pluginData: { [pluginId]: { elementor_role: "icon" } }
      }
    ]
  };

  const assets = discoverAssets(root, pluginId);
  assert.equal(assets.length, 3);
  assert.deepEqual(
    assets.map((asset) => asset.kind),
    ["image", "background", "icon"]
  );
  assert.equal(assets[0].targetFormat, "WEBP");
  assert.equal(assets[0].width, 900);
  assert.equal(assets[1].aspectRatio, 2.4);
  assert.equal(assets[2].targetFormat, "SVG");
});

test("extension ignores untagged raster images nested inside image-background section", () => {
  const root = {
    id: "1:1",
    name: "[CONTAINER] Section",
    type: "FRAME",
    children: [
      {
        id: "10:1",
        name: "[BACKGROUND] Hero background",
        type: "FRAME",
        width: 1920,
        height: 800,
        pluginData: { [pluginId]: { "elementor-tag": "image-background" } },
        children: [
          {
            id: "10:2",
            name: "Level 1 Container",
            type: "FRAME",
            children: [
              {
                id: "10:3",
                name: "Level 2 Container",
                type: "FRAME",
                children: [
                  {
                    id: "10:4",
                    name: "Level 3 Container",
                    type: "FRAME",
                    children: [
                      {
                        id: "10:5",
                        name: "Nested Photo",
                        type: "RECTANGLE",
                        width: 400,
                        height: 300,
                        fills: [{ type: "IMAGE", visible: true }]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  const assets = discoverAssets(root, pluginId);
  assert.equal(assets.length, 1);
  assert.equal(assets[0].figmaNodeId, "10:1");
  assert.equal(assets[0].kind, "background");
});

test("extension ignores untagged raster images that are direct children of an image-background section", () => {
  const root = {
    id: "1:1",
    name: "[CONTAINER] Section",
    type: "FRAME",
    children: [
      {
        id: "20:1",
        name: "[BACKGROUND] Hero background",
        type: "FRAME",
        width: 1920,
        height: 800,
        pluginData: { [pluginId]: { "elementor-tag": "image-background" } },
        children: [
          {
            id: "20:2",
            name: "Direct Child Photo",
            type: "RECTANGLE",
            width: 400,
            height: 300,
            fills: [{ type: "IMAGE", visible: true }]
          }
        ]
      }
    ]
  };

  const assets = discoverAssets(root, pluginId);
  assert.equal(assets.length, 1);
  assert.equal(assets[0].figmaNodeId, "20:1");
  assert.equal(assets[0].kind, "background");
});

test("extension creates an Elementor document and patches uploaded media IDs", async () => {
  const root = {
    id: "2:1",
    name: "[CONTAINER] Landing",
    type: "FRAME",
    pluginData: { [pluginId]: { "elementor-tag": "container" } },
    children: [
      {
        id: "2:2",
        name: "[IMAGE] Hero",
        type: "FRAME",
        pluginData: { [pluginId]: { "elementor-tag": "image" } },
        children: []
      }
    ]
  };

  const document = await buildElementorDocument(root, "section", pluginId);
  const manifest = buildAssetManifest(root, pluginId, {
    fileKey: "file-key",
    nodeId: "2:1",
    name: root.name
  });
  const asset = manifest.assets[0];
  const patched = patchElementorAssets(document, {
    assets: [{ ...asset, mediaId: 42, mediaUrl: "https://site.test/hero.webp", status: "uploaded" }]
  });

  assert.equal(patched.type, "container");
  assert.equal(patched.content[0].elType, "container");
  assert.equal(patched.content[0].elements[0].settings.image.id, 42);
  assert.equal(patched.content[0].elements[0].settings.image.url, "https://site.test/hero.webp");
  assert.equal(
    patched.figmentor.elements[patched.content[0].elements[0].id].assets.image.status,
    "uploaded"
  );
});

test("extension flattens page wrapper output and maps backgrounds to native containers", async () => {
  const root = {
    id: "3:1",
    name: "[PAGE] Landing",
    type: "FRAME",
    pluginData: { [pluginId]: { "elementor-tag": "page-wrapper" } },
    children: [
      {
        id: "3:2",
        name: "[CONTAINER] Hero",
        type: "FRAME",
        pluginData: { [pluginId]: { "elementor-tag": "container" } },
        children: [
          {
            id: "3:2:bg",
            name: "[BACKGROUND] Hero background",
            type: "FRAME",
            pluginData: { [pluginId]: { "elementor-tag": "image-background" } }
          },
          {
            id: "3:3",
            name: "[HEADING] Title",
            type: "TEXT",
            characters: "Título",
            pluginData: { [pluginId]: { "elementor-tag": "heading" } }
          }
        ]
      },
      {
        id: "3:4",
        name: "[CONTAINER] Content",
        type: "FRAME",
        pluginData: { [pluginId]: { "elementor-tag": "container" } },
        children: []
      }
    ]
  };

  const document = await buildElementorDocument(root, "page", pluginId);
  const patched = patchElementorAssets(document, {
    assets: [
      {
        assetRef: "figmentor-3-2-bg-background",
        status: "uploaded",
        mediaId: 10,
        mediaUrl: "https://site.test/hero.webp"
      }
    ]
  });
  const validation = validateElementorDocument(patched, "page");

  assert.equal(validation.valid, true);
  assert.equal(
    document.content.every((item) => !Array.isArray(item)),
    true
  );
  assert.equal(document.content[0].elType, "container");
  assert.equal(document.content[0].settings.background_background, "classic");
  assert.equal(document.content[0].settings.background_image.assetRef, undefined);
  assert.equal(
    document.figmentor.elements[document.content[0].id].assets.background_image.assetRef,
    "figmentor-3-2-bg-background"
  );
  assert.equal(document.content[0].elements[0].widgetType, "heading");
});

test("REST traversal preserves nested layout, spacing, typography, color, border and shadow", async () => {
  const root = {
    id: "10:1",
    name: "[CONTAINER] Hero",
    type: "FRAME",
    layoutMode: "VERTICAL",
    itemSpacing: 24,
    paddingTop: 48,
    paddingRight: 32,
    paddingBottom: 48,
    paddingLeft: 32,
    width: 1140,
    height: 640,
    layoutSizingVertical: "FIXED",
    primaryAxisAlignItems: "CENTER",
    counterAxisAlignItems: "CENTER",
    fills: [{ type: "SOLID", color: { r: 0.1, g: 0.2, b: 0.3 }, opacity: 1 }],
    strokes: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 0.5 }],
    strokeWeight: 2,
    cornerRadius: 16,
    effects: [
      {
        type: "DROP_SHADOW",
        visible: true,
        offset: { x: 0, y: 8 },
        radius: 20,
        spread: 2,
        color: { r: 0, g: 0, b: 0, a: 0.4 }
      }
    ],
    pluginData: { [pluginId]: { "elementor-tag": "container" } },
    children: [
      {
        id: "10:2",
        name: "Content row",
        type: "FRAME",
        layoutMode: "HORIZONTAL",
        itemSpacing: 12,
        children: [
          {
            id: "10:3",
            name: "[HEADING] Headline",
            type: "TEXT",
            characters: "Headline fiel",
            style: {
              fontFamily: "Inter",
              fontSize: 52,
              fontWeight: 700,
              textAlignHorizontal: "CENTER",
              lineHeightPx: 60,
              letterSpacing: -1
            },
            fills: [{ type: "SOLID", color: { r: 1, g: 0.5, b: 0 }, opacity: 1 }],
            pluginData: { [pluginId]: { "elementor-tag": "heading" } }
          }
        ]
      }
    ]
  };

  const document = await buildElementorDocument(root, "section", pluginId);
  const container = document.content[0];
  const nested = container.elements[0];
  const heading = nested.elements[0];

  assert.equal(container.settings.flex_direction, "column");
  assert.equal(container.settings.gap.column, 24);
  assert.equal(container.settings.padding.top, 48);
  assert.equal(container.settings.min_height.size, 640);
  assert.equal(container.settings.background_color, "rgba(26,51,77,1)");
  assert.equal(container.settings.border_border, "solid");
  assert.equal(container.settings._box_shadow_box_shadow_type, "yes");
  assert.equal(nested.elType, "container");
  assert.equal(nested.settings.flex_direction, "row");
  assert.equal(heading.settings.typography_font_family, "Inter");
  assert.equal(heading.settings.typography_font_size.size, 52);
  assert.equal(heading.settings.typography_font_weight, "700");
  assert.equal(heading.settings.title_color, "rgba(255,128,0,1)");
});

test("Font Awesome remains native and custom vectors remain real SVG assets", async () => {
  const fontAwesomeRoot = {
    id: "11:1",
    name: "[ICON-BOX] Native icon",
    type: "FRAME",
    pluginData: { [pluginId]: { "elementor-tag": "icon-box" } },
    children: [
      {
        id: "11:2",
        name: "[ICON] fas fa-check",
        type: "VECTOR",
        pluginData: { [pluginId]: { elementor_role: "icon" } },
        fills: []
      },
      {
        id: "11:3",
        name: "[TITLE] Item",
        type: "TEXT",
        characters: "Item",
        pluginData: { [pluginId]: { elementor_role: "title_text" } }
      }
    ]
  };
  const customRoot = {
    ...fontAwesomeRoot,
    id: "12:1",
    name: "[ICON-BOX] Custom icon",
    children: [
      {
        id: "12:2",
        name: "[ICON] Arrow custom",
        type: "VECTOR",
        pluginData: { [pluginId]: { elementor_role: "icon" } },
        fills: []
      },
      {
        id: "12:3",
        name: "[TITLE] Item",
        type: "TEXT",
        characters: "Item",
        pluginData: { [pluginId]: { elementor_role: "title_text" } }
      }
    ]
  };

  const nativeDocument = await buildElementorDocument(fontAwesomeRoot, "section", pluginId);
  assert.equal(nativeDocument.content[0].settings.selected_icon.value, "fas fa-check");
  assert.equal(discoverAssets(fontAwesomeRoot, pluginId).length, 0);

  const customDocument = await buildElementorDocument(customRoot, "section", pluginId);
  const customAssets = discoverAssets(customRoot, pluginId);
  assert.equal(customAssets[0].targetFormat, "SVG");
  assert.deepEqual(customDocument.content[0].settings.selected_icon, {
    value: "fas fa-check",
    library: "fa-solid"
  });
  assert.equal(
    customDocument.figmentor.elements[customDocument.content[0].id].assets.selected_icon.assetRef,
    "figmentor-12-2-icon"
  );

  const patched = patchElementorAssets(customDocument, {
    assets: [
      {
        ...customAssets[0],
        status: "uploaded",
        mediaId: 77,
        mediaUrl: "https://site.test/arrow.svg"
      }
    ]
  });
  assert.deepEqual(patched.content[0].settings.selected_icon, {
    value: { id: 77, url: "https://site.test/arrow.svg" },
    library: "svg"
  });
});

test("failed custom icon-list SVGs use a valid explicit Font Awesome placeholder", async () => {
  const root = {
    id: "13:1",
    name: "[ICON-LIST] Lista de benefícios",
    type: "FRAME",
    pluginData: { [pluginId]: { "elementor-tag": "icon-list" } },
    children: [
      {
        id: "13:2",
        name: "[ICON] Custom arrow",
        type: "VECTOR",
        pluginData: { [pluginId]: { elementor_role: "icon" } },
        fills: []
      },
      {
        id: "13:3",
        name: "[TITLE] Primeiro item",
        type: "TEXT",
        characters: "Primeiro item",
        pluginData: { [pluginId]: { elementor_role: "title_text" } }
      },
      {
        id: "13:4",
        name: "[ICON] Custom star",
        type: "VECTOR",
        pluginData: { [pluginId]: { elementor_role: "icon" } },
        fills: []
      },
      {
        id: "13:5",
        name: "[TITLE] Segundo item",
        type: "TEXT",
        characters: "Segundo item",
        pluginData: { [pluginId]: { elementor_role: "title_text" } }
      }
    ]
  };

  const document = await buildElementorDocument(root, "page", pluginId);
  const manifest = buildAssetManifest(root, pluginId, {
    fileKey: "file",
    nodeId: "13:1",
    name: root.name
  });
  const prepared = document.content[0].settings.icon_list;

  assert.deepEqual(
    prepared.map((item) => item.selected_icon),
    [
      { value: "fas fa-check", library: "fa-solid" },
      { value: "fas fa-check", library: "fa-solid" }
    ]
  );

  const patched = patchElementorAssets(document, {
    assets: manifest.assets.map((asset) => ({
      ...asset,
      status: "failed",
      error: "SVG recusado pelo WordPress"
    }))
  });

  assert.deepEqual(
    patched.content[0].settings.icon_list.map((item) => item.selected_icon),
    [
      { value: "fas fa-check", library: "fa-solid" },
      { value: "fas fa-check", library: "fa-solid" }
    ]
  );
  assert.equal(validateElementorDocument(patched, "page").valid, true);
  assert.equal(
    patched.figmentor.elements[patched.content[0].id].assets.icon_list[0].status,
    "failed"
  );
});

test("semantic validation rejects empty SVG icons before Elementor save", () => {
  const invalid = {
    version: "0.4",
    title: "Invalid icon list",
    type: "page",
    page_settings: {},
    content: [
      {
        id: "w123456",
        elType: "widget",
        widgetType: "icon-list",
        isInner: false,
        settings: {
          icon_list: [
            {
              text: "Item",
              selected_icon: { value: { id: "", url: "" }, library: "svg" }
            }
          ]
        },
        elements: []
      }
    ]
  };

  const result = validateElementorDocument(invalid, "page");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /SVG sem id e url/);
});

test("semantic validation rejects empty native media before Elementor save", () => {
  const invalidImage = {
    version: "0.4",
    title: "Invalid image",
    type: "page",
    page_settings: {},
    content: [
      {
        id: "w123456",
        elType: "widget",
        widgetType: "image",
        isInner: false,
        settings: {
          image: { id: "", url: "" }
        },
        elements: []
      }
    ]
  };

  const invalidBackground = {
    version: "0.4",
    title: "Invalid background",
    type: "page",
    page_settings: {},
    content: [
      {
        id: "c123456",
        elType: "container",
        isInner: false,
        settings: {
          background_image: { id: "", url: "" }
        },
        elements: []
      }
    ]
  };

  const imageResult = validateElementorDocument(invalidImage, "page");
  assert.equal(imageResult.valid, false);
  assert.match(imageResult.errors.join("\n"), /deve conter id e url nativos/);

  const backgroundResult = validateElementorDocument(invalidBackground, "page");
  assert.equal(backgroundResult.valid, false);
  assert.match(backgroundResult.errors.join("\n"), /deve conter id e url nativos/);
});

test("semantic validation allows placeholder native media during document preparation", () => {
  const placeholderImage = {
    version: "0.4",
    title: "Placeholder image",
    type: "page",
    page_settings: {},
    content: [
      {
        id: "w123456",
        elType: "widget",
        widgetType: "image",
        isInner: false,
        settings: {
          image: { id: "", url: "", size: "full" }
        },
        elements: []
      }
    ]
  };

  const placeholderBackground = {
    version: "0.4",
    title: "Placeholder background",
    type: "page",
    page_settings: {},
    content: [
      {
        id: "c123456",
        elType: "container",
        isInner: false,
        settings: {
          background_image: { id: "", url: "", size: "full" }
        },
        elements: []
      }
    ]
  };

  const imageResult = validateElementorDocument(placeholderImage, "page", {
    requireNativeMedia: false
  });
  assert.equal(imageResult.valid, true);
  assert.doesNotMatch(imageResult.errors.join("\n"), /deve conter id e url nativos/);

  const backgroundResult = validateElementorDocument(placeholderBackground, "page", {
    requireNativeMedia: false
  });
  assert.equal(backgroundResult.valid, true);
  assert.doesNotMatch(backgroundResult.errors.join("\n"), /deve conter id e url nativos/);
});

test("treatMissingMediaAsWarning downgrades missing native media to a warning without blocking other errors", () => {
  const missingMediaOnly = {
    version: "0.4",
    title: "Missing media only",
    type: "page",
    page_settings: {},
    content: [
      {
        id: "w123456",
        elType: "widget",
        widgetType: "image",
        isInner: false,
        settings: { image: { id: "", url: "", size: "full" } },
        elements: []
      }
    ]
  };
  const result = validateElementorDocument(missingMediaOnly, "page", {
    treatMissingMediaAsWarning: true
  });
  assert.equal(result.valid, true);
  assert.match(result.warnings.join("\n"), /deve conter id e url nativos/);
  assert.doesNotMatch(result.errors.join("\n"), /deve conter id e url nativos/);

  const structurallyInvalid = {
    version: "0.4",
    title: "Bad widget type",
    type: "page",
    page_settings: {},
    content: [
      {
        id: "w654321",
        elType: "widget",
        widgetType: "not-a-real-widget",
        isInner: false,
        settings: {},
        elements: []
      }
    ]
  };
  const stillBlocked = validateElementorDocument(structurallyInvalid, "page", {
    treatMissingMediaAsWarning: true
  });
  assert.equal(stillBlocked.valid, false);
  assert.match(stillBlocked.errors.join("\n"), /não é um widget Elementor suportado/);
});

test("asset failures produce a detailed report and retry selects only failed assets", () => {
  const manifest = {
    assets: [
      {
        assetRef: "ok",
        elementName: "Logo",
        figmaNodeId: "1:1",
        kind: "image",
        status: "uploaded",
        mediaId: 1,
        mediaUrl: "https://site.test/logo.webp"
      },
      {
        assetRef: "fail",
        elementName: "Background",
        figmaNodeId: "1:2",
        kind: "background",
        targetFormat: "WEBP",
        status: "failed",
        error: "Acima de 150 KB"
      }
    ]
  };
  const retry = selectAssetsForProcessing(manifest, true);
  const report = createAssetReport(manifest);

  assert.deepEqual(
    retry.map((asset) => asset.assetRef),
    ["fail"]
  );
  assert.equal(report[1].nodeId, "1:2");
  assert.equal(report[1].elementorElement, "background");
  assert.match(report[1].reason, /150 KB/);
  assert.match(report[1].action, /Repetir falhos/);
});

test("WebP conversion searches quality and scale and reports the byte ceiling", async () => {
  const bitmap = { width: 100, height: 100, close() {} };
  const result = await convertPngBlobToWebp(new Blob(["png"]), {
    bitmapFactory: async () => bitmap,
    scales: [1, 0.5],
    qualities: [0.9, 0.5],
    maxBytes: 150,
    canvasFactory: (width, height) => ({
      getContext() {
        return {
          clearRect() {},
          drawImage() {}
        };
      },
      async convertToBlob({ quality }) {
        return new Blob([new Uint8Array(Math.round((width * height * quality) / 20))], {
          type: "image/webp"
        });
      }
    })
  });

  assert.equal(result.ok, true);
  assert.equal(result.width, 50);
  assert.equal(result.height, 50);
  assert.equal(result.bytes <= 150, true);
  assert.equal(result.resized, true);
});

test("WebP conversion returns the best candidate instead of throwing when the ceiling is impossible", async () => {
  const result = await convertPngBlobToWebp(new Blob(["png"]), {
    bitmapFactory: async () => ({ width: 10, height: 10, close() {} }),
    scales: [1],
    qualities: [0.9],
    maxBytes: 1,
    canvasFactory: () => ({
      getContext: () => ({ drawImage() {} }),
      async convertToBlob() {
        return new Blob([new Uint8Array(10)], { type: "image/webp" });
      }
    })
  });

  assert.equal(result.ok, false);
  assert.equal(result.bytes, 10);
  assert.match(result.reason, /acima do limite/);
});

test("isAllowedWordPressTabUrl accepts any HTTPS URL", () => {
  assert.equal(isAllowedWordPressTabUrl("https://qualquer-dominio.com"), true);
});

test("isAllowedWordPressTabUrl accepts http://localhost with custom ports", () => {
  assert.equal(isAllowedWordPressTabUrl("http://localhost:10004"), true);
});

test("isAllowedWordPressTabUrl accepts http://127.0.0.1", () => {
  assert.equal(isAllowedWordPressTabUrl("http://127.0.0.1"), true);
});

test("isAllowedWordPressTabUrl accepts http://*.local domains", () => {
  assert.equal(isAllowedWordPressTabUrl("http://figmentor-teste.local"), true);
});

test("isAllowedWordPressTabUrl accepts http://*.test domains", () => {
  assert.equal(isAllowedWordPressTabUrl("http://meusite.test"), true);
});

test("isAllowedWordPressTabUrl rejects non-local HTTP domains", () => {
  assert.equal(isAllowedWordPressTabUrl("http://meusite.com"), false);
});

test("isAllowedWordPressTabUrl rejects domains with .local inside the hostname rather than suffix", () => {
  assert.equal(isAllowedWordPressTabUrl("http://evil.local.attacker.com"), false);
});

test("isAllowedWordPressTabUrl handles malformed and invalid URLs safely", () => {
  assert.equal(isAllowedWordPressTabUrl("not-a-url"), false);
  assert.equal(isAllowedWordPressTabUrl(""), false);
  assert.equal(isAllowedWordPressTabUrl(null), false);
  assert.equal(isAllowedWordPressTabUrl(undefined), false);
});

test("extension normalizes and validates the WordPress session context", () => {
  const context = extractWordPressContext({
    tabId: 17,
    href: "https://client.test/wp-admin/post.php?post=42&action=elementor",
    title: "Edit with Elementor",
    isWordPress: true,
    isElementor: true,
    nonce: "nonce-123",
    restRoot: "https://client.test/wp-json",
    postId: 42,
    elementorNonce: "elementor-nonce",
    elementorAjaxUrl: "https://client.test/wp-admin/admin-ajax.php"
  });

  assert.equal(context.tabId, 17);
  assert.equal(context.restRoot, "https://client.test/wp-json/");
  assert.equal(context.isElementor, true);
  assert.equal(context.postRestBase, "pages");
  assert.doesNotThrow(() => validateWordPressContext(context));
  assert.throws(
    () => validateWordPressContext({ ...context, nonce: null }),
    /nonce REST do WordPress/
  );
});

test("Elementor AJAX body uses the real elementor_ajax envelope and keeps draft status", () => {
  const context = extractWordPressContext({
    href: "https://client.test/wp-admin/post.php?post=42&action=elementor",
    isWordPress: true,
    isElementor: true,
    postId: 42,
    nonce: "wp-rest-nonce",
    elementorNonce: "elementor-ajax-nonce",
    elementorAjaxUrl: "https://client.test/wp-admin/admin-ajax.php"
  });
  const body = new URLSearchParams(
    buildElementorAjaxBody(context, "figmentor_save_builder", "save_builder", {
      status: "draft",
      elements: [],
      settings: {}
    })
  );
  const actions = JSON.parse(body.get("actions"));

  assert.equal(body.get("action"), "elementor_ajax");
  assert.equal(body.get("editor_post_id"), "42");
  assert.equal(body.get("_nonce"), "elementor-ajax-nonce");
  assert.equal(actions.figmentor_save_builder.action, "save_builder");
  assert.equal(actions.figmentor_save_builder.data.status, "draft");
});

test("WordPress status is explicitly changed to draft before Elementor save", async () => {
  const previousChrome = globalThis.chrome;
  const context = extractWordPressContext({
    href: "https://client.test/wp-admin/post.php?post=42&action=elementor",
    isWordPress: true,
    isElementor: true,
    postId: 42,
    nonce: "wp-rest-nonce",
    elementorNonce: "elementor-ajax-nonce",
    elementorAjaxUrl: "https://client.test/wp-admin/admin-ajax.php",
    postType: "page",
    postRestBase: "pages"
  });
  let request = null;
  globalThis.chrome = {
    scripting: {
      executeScript: async ({ func, args }) => {
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async (url, options) => {
          request = { url, options };
          return {
            ok: true,
            status: 200,
            async json() {
              return { id: 42, status: "draft" };
            }
          };
        };
        try {
          return [{ result: await func(args[0]) }];
        } finally {
          globalThis.fetch = previousFetch;
        }
      }
    }
  };

  try {
    const result = await ensureWordPressDraft(12, context);
    assert.equal(result.status, "draft");
    assert.equal(request.url, "https://client.test/wp-json/wp/v2/pages/42");
    assert.equal(JSON.parse(request.options.body).status, "draft");
  } finally {
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
  }
});

test("Elementor page mode handles an empty page and persistence verifies elements and media", async () => {
  const document = await buildElementorDocument(
    {
      id: "13:1",
      name: "[IMAGE] Hero",
      type: "FRAME",
      width: 600,
      height: 400,
      pluginData: { [pluginId]: { "elementor-tag": "image" } },
      children: []
    },
    "page",
    pluginId
  );
  const patched = patchElementorAssets(document, {
    assets: [
      {
        assetRef: "figmentor-13-1-image",
        status: "uploaded",
        mediaId: 99,
        mediaUrl: "https://site.test/hero.webp"
      }
    ]
  });
  const payload = buildElementorSavePayload(patched, [], "page");
  const verification = verifyElementorPersistence({ elements: payload.elements }, payload.elements);

  assert.equal(payload.status, "draft");
  assert.equal(payload.elements.length, 1);
  assert.equal(payload.elements[0].settings.image.id, 99);
  assert.equal(verification.persistent, true);
  assert.deepEqual(verification.missingElementIds, []);
  assert.deepEqual(verification.missingMediaIds, []);
});

test("semantic validation rejects assetRef mixed into Elementor native media fields", async () => {
  const document = await buildElementorDocument(
    {
      id: "14:1",
      name: "[IMAGE] Invalid",
      type: "FRAME",
      pluginData: { [pluginId]: { "elementor-tag": "image" } },
      children: []
    },
    "section",
    pluginId
  );
  document.content[0].settings.image.assetRef = "legacy-mixed-reference";
  const validation = validateElementorDocument(document, "section");

  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(" "), /não pode conter assetRef/);
});

test("Elementor save payload preserves existing elements in section mode", async () => {
  const validDocument = await buildElementorDocument(
    {
      id: "4:1",
      name: "[CONTAINER] New",
      type: "FRAME",
      pluginData: { [pluginId]: { "elementor-tag": "container" } },
      children: []
    },
    "section",
    pluginId
  );

  const payload = buildElementorSavePayload(
    {
      ...validDocument,
      type: "page",
      page_settings: { hide_title: "yes" }
    },
    [{ id: "existing-section" }],
    "section"
  );

  assert.equal(payload.status, "draft");
  assert.deepEqual(
    payload.elements.map((element) => element.id),
    ["existing-section", validDocument.content[0].id]
  );
  assert.deepEqual(payload.settings, { hide_title: "yes" });
});

test("Elementor insertion rejects a false save response instead of reporting success", async () => {
  const previousChrome = globalThis.chrome;
  const previousWindow = globalThis.window;
  const document = await buildElementorDocument(
    {
      id: "5:1",
      name: "[CONTAINER] Test",
      type: "FRAME",
      pluginData: { [pluginId]: { "elementor-tag": "container" } },
      children: []
    },
    "section",
    pluginId
  );
  const context = {
    isWordPress: true,
    isElementor: true,
    postId: "42",
    nonce: "nonce",
    restRoot: "https://site.test/wp-json/",
    elementorNonce: "elementor-nonce",
    elementorAjaxUrl: "https://site.test/wp-admin/admin-ajax.php"
  };

  let requestCount = 0;
  globalThis.chrome = {
    scripting: {
      executeScript: async ({ func, args }) => {
        requestCount += 1;
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async () => {
          const responseBody =
            requestCount === 1
              ? { id: 42, status: "draft" }
              : requestCount === 2
                ? {
                    success: true,
                    data: {
                      responses: {
                        figmentor_get_document: {
                          success: true,
                          data: { elements: [], settings: {}, status: "draft" }
                        }
                      }
                    }
                  }
                : {
                    success: true,
                    data: {
                      responses: {
                        figmentor_save_builder: {
                          success: false,
                          data: "Falha simulada no Elementor."
                        }
                      }
                    }
                  };
          return {
            ok: true,
            status: 200,
            async json() {
              return responseBody;
            },
            async text() {
              return JSON.stringify(responseBody);
            }
          };
        };
        try {
          return [{ result: await func(args[0]) }];
        } finally {
          globalThis.fetch = previousFetch;
        }
      }
    }
  };

  try {
    await assert.rejects(
      () => insertElementorDocument(12, context, document, "section"),
      /Falha simulada no Elementor/
    );
  } finally {
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("normalizeElementorDocument mirrors css_id to _element_id for every element", () => {
  const document = normalizeElementorDocument(
    {
      version: "0.4",
      type: "page",
      page_settings: {},
      content: [
        {
          elType: "container",
          settings: { css_id: "section" },
          elements: [
            {
              elType: "widget",
              widgetType: "heading",
              settings: { title: "Título", css_id: "section" }
            }
          ]
        }
      ]
    },
    "page"
  );

  assert.equal(document.content[0].settings._element_id, document.content[0].settings.css_id);
  assert.equal(
    document.content[0].elements[0].settings._element_id,
    document.content[0].elements[0].settings.css_id
  );
  assert.equal(document.content[0].elements[0].settings.css_id, "section-2");
  assert.equal(document.content[0].elements[0].settings._element_id, "section-2");
});

test("discoverAssets flattens image-background, crops to parent bounds and suppresses child images", () => {
  const root = {
    id: "parent:1",
    name: "[CONTAINER] Section",
    type: "FRAME",
    pluginData: { [pluginId]: { "elementor-tag": "container" } },
    absoluteBoundingBox: { x: 100, y: 200, width: 1200, height: 600 },
    children: [
      {
        id: "bg:1",
        name: "[IMAGE-BACKGROUND] Leaking background",
        type: "GROUP",
        pluginData: { [pluginId]: { "elementor-tag": "image-background" } },
        absoluteBoundingBox: { x: 80, y: 150, width: 1400, height: 800 },
        children: [
          {
            id: "bg:child1",
            name: "Decorative icon 1",
            type: "RECTANGLE",
            fills: [{ type: "IMAGE", visible: true }]
          },
          {
            id: "bg:child2",
            name: "Decorative icon 2",
            type: "RECTANGLE",
            fills: [{ type: "IMAGE", visible: true }]
          },
          {
            id: "bg:child3",
            name: "Decorative icon 3",
            type: "RECTANGLE",
            fills: [{ type: "IMAGE", visible: true }]
          }
        ]
      }
    ]
  };

  const assets = discoverAssets(root, pluginId);
  assert.equal(assets.length, 1);
  const asset = assets[0];
  assert.equal(asset.figmaNodeId, "bg:1");
  assert.equal(asset.kind, "background");
  assert.equal(asset.width, 1200);
  assert.equal(asset.height, 600);
  assert.equal(asset.aspectRatio, 2);
  assert.deepEqual(asset.crop, {
    width: 1200,
    height: 600,
    offsetX: -20,
    offsetY: -50,
    backgroundColor: null
  });
});

test("discoverAssets uses parent solid fill color as background fallback for flattened background", () => {
  const root = {
    id: "parent:1",
    name: "[CONTAINER] Section",
    type: "FRAME",
    pluginData: { [pluginId]: { "elementor-tag": "container" } },
    absoluteBoundingBox: { x: 100, y: 200, width: 1200, height: 600 },
    fills: [
      {
        type: "SOLID",
        visible: true,
        color: { r: 0.2, g: 0.4, b: 0.6 },
        opacity: 0.9
      }
    ],
    children: [
      {
        id: "bg:1",
        name: "[IMAGE-BACKGROUND] Leaking background",
        type: "GROUP",
        pluginData: { [pluginId]: { "elementor-tag": "image-background" } },
        absoluteBoundingBox: { x: 80, y: 150, width: 1400, height: 800 },
        children: [
          {
            id: "bg:child1",
            name: "Decorative icon 1",
            type: "RECTANGLE",
            fills: [{ type: "IMAGE", visible: true }]
          }
        ]
      }
    ]
  };

  const assets = discoverAssets(root, pluginId);
  assert.equal(assets.length, 1);
  assert.equal(assets[0].crop.backgroundColor, "rgba(51,102,153,0.9)");
});

test("discoverAssets falls back to root solid fill color when parent has no fill", () => {
  const root = {
    id: "page:1",
    name: "[PAGE] Page wrapper",
    type: "FRAME",
    pluginData: { [pluginId]: { "elementor-tag": "page-wrapper" } },
    fills: [
      {
        type: "SOLID",
        visible: true,
        color: { r: 1, g: 0.5, b: 0 },
        opacity: 1
      }
    ],
    children: [
      {
        id: "section:1",
        name: "[CONTAINER] Section",
        type: "FRAME",
        pluginData: { [pluginId]: { "elementor-tag": "container" } },
        absoluteBoundingBox: { x: 0, y: 100, width: 1000, height: 500 },
        fills: [],
        children: [
          {
            id: "bg:1",
            name: "[BACKGROUND-IMAGE] Background group",
            type: "GROUP",
            pluginData: { [pluginId]: { "elementor-tag": "background-image" } },
            absoluteBoundingBox: { x: -50, y: 80, width: 1100, height: 600 },
            children: [
              {
                id: "bg:child1",
                name: "Decorative image",
                type: "RECTANGLE",
                fills: [{ type: "IMAGE", visible: true }]
              }
            ]
          }
        ]
      }
    ]
  };

  const assets = discoverAssets(root, pluginId);
  assert.equal(assets.length, 1);
  assert.equal(assets[0].crop.backgroundColor, "rgba(255,128,0,1)");
});

test("buildElementorDocument flattens image-background to container background and excludes loose image widgets", async () => {
  const root = {
    id: "12:0",
    name: "[CONTAINER] Frame 12",
    type: "FRAME",
    pluginData: { [pluginId]: { "elementor-tag": "container" } },
    children: [
      {
        id: "12:8",
        name: "[IMAGE-BACKGROUND] Group 8",
        type: "GROUP",
        pluginData: { [pluginId]: { "elementor-tag": "image-background" } },
        children: [
          {
            id: "12:8:1",
            name: "Floating Icon 1",
            type: "RECTANGLE",
            fills: [{ type: "IMAGE", visible: true }]
          },
          {
            id: "12:8:2",
            name: "Floating Icon 2",
            type: "RECTANGLE",
            fills: [{ type: "IMAGE", visible: true }]
          },
          {
            id: "12:8:3",
            name: "Floating Icon 3",
            type: "RECTANGLE",
            fills: [{ type: "IMAGE", visible: true }]
          }
        ]
      },
      {
        id: "12:7",
        name: "Group 7",
        type: "GROUP",
        layoutMode: "NONE",
        children: [
          {
            id: "12:7:1",
            name: "[HEADING] Main Title",
            type: "TEXT",
            characters: "Hello World",
            pluginData: { [pluginId]: { "elementor-tag": "heading" } }
          },
          {
            id: "12:7:2",
            name: "[BUTTON] Call to Action",
            type: "FRAME",
            pluginData: { [pluginId]: { "elementor-tag": "button" } },
            children: [
              {
                id: "12:7:2:1",
                name: "Button text",
                type: "TEXT",
                characters: "Click here"
              }
            ]
          }
        ]
      }
    ]
  };

  const document = await buildElementorDocument(root, "section", pluginId);
  assert.equal(document.content.length, 1);
  const container = document.content[0];
  assert.equal(container.elType, "container");
  assert.equal(container.settings.background_background, "classic");
  assert.deepEqual(container.settings.background_image, { id: "", url: "", size: "full" });
  assert.equal(container.settings.background_position, "center center");
  assert.equal(container.settings.background_repeat, "no-repeat");
  assert.equal(container.settings.background_size, "cover");

  const sidecarAssets = document.figmentor.elements[container.id].assets;
  assert.equal(sidecarAssets.background_image.kind, "background");
  assert.equal(sidecarAssets.background_image.figmaNodeId, "12:8");
  assert.equal(sidecarAssets.background_image.assetRef, "figmentor-12-8-background");

  const widgetTypes = container.elements.map((el) => el.widgetType);
  assert.equal(widgetTypes.includes("image"), false);
  assert.deepEqual(widgetTypes, ["heading", "button"]);
});

test("compositeBackgroundImage creates cropped canvas and applies background color when provided", async () => {
  let fillRectCalls = [];
  let drawImageCalls = [];
  let canvasDimensions = null;
  const mockBitmap = {
    width: 1400,
    height: 800,
    closeCalled: false,
    close() {
      this.closeCalled = true;
    }
  };

  const mockCanvasFactory = (width, height) => {
    canvasDimensions = { width, height };
    return {
      width,
      height,
      getContext(type) {
        if (type !== "2d") return null;
        return {
          clearRect() {},
          fillStyle: null,
          fillRect(x, y, w, h) {
            fillRectCalls.push({ fillStyle: this.fillStyle, x, y, w, h });
          },
          drawImage(img, x, y) {
            drawImageCalls.push({ img, x, y });
          }
        };
      },
      async convertToBlob() {
        return new Blob(["mock-png"], { type: "image/png" });
      }
    };
  };

  const blob1 = await compositeBackgroundImage(new Blob(["source-png"]), {
    width: 1200,
    height: 600,
    offsetX: -20,
    offsetY: -50,
    backgroundColor: "rgba(51,102,153,0.9)",
    bitmapFactory: async () => mockBitmap,
    canvasFactory: mockCanvasFactory
  });

  assert.equal(blob1 instanceof Blob, true);
  assert.deepEqual(canvasDimensions, { width: 1200, height: 600 });
  assert.equal(fillRectCalls.length, 1);
  assert.deepEqual(fillRectCalls[0], {
    fillStyle: "rgba(51,102,153,0.9)",
    x: 0,
    y: 0,
    w: 1200,
    h: 600
  });
  assert.equal(drawImageCalls.length, 1);
  assert.deepEqual(drawImageCalls[0], { img: mockBitmap, x: -20, y: -50 });
  assert.equal(mockBitmap.closeCalled, true);

  fillRectCalls = [];
  drawImageCalls = [];
  const mockBitmap2 = { width: 1400, height: 800, close() {} };
  const blob2 = await compositeBackgroundImage(new Blob(["source-png"]), {
    width: 800,
    height: 400,
    offsetX: 10,
    offsetY: 20,
    backgroundColor: null,
    bitmapFactory: async () => mockBitmap2,
    canvasFactory: mockCanvasFactory
  });

  assert.equal(blob2 instanceof Blob, true);
  assert.deepEqual(canvasDimensions, { width: 800, height: 400 });
  assert.equal(fillRectCalls.length, 0);
  assert.equal(drawImageCalls.length, 1);
  assert.deepEqual(drawImageCalls[0], { img: mockBitmap2, x: 10, y: 20 });
});
