# Relatório de Implementação — Feature 11: Flatten de `image-background`/`background-image` no tamanho do frame pai

- **Data:** 2026-09-06
- **Branch:** `feature/flatten-image-background`
- **Status:** Concluído sem commit ou push

---

## 1. Causa Raiz e Contexto

Grupos tagueados com `[IMAGE-BACKGROUND]` ou `[BACKGROUND-IMAGE]` no Figma vinham sendo tratados como containers comuns no Figmentor: a árvore de nós descia recursivamente nos filhos, transformando elementos decorativos internos (como ícones decorativos ou formas flutuando sobre fundos) em widgets de imagem avulsos e soltos no Elementor. Além disso, a imagem de fundo gerada para o grupo podia ter dimensões divergentes ou superiores às do frame da seção quando elementos visuais internos extrapolavam as margens visíveis.

### Comportamento implementado

1. **Supressão de nós na árvore:** `handleManualTag` em `src/core/handlers.js` retorna `null` para nós tagueados com `image-background` ou `background-image`. O grupo nunca mais gera container próprio nem insere widgets filhos soltos na árvore do Elementor.
2. **Descoberta e cálculo de recorte (crop):** `discoverAssets` em `extension/src/assets.js` passa `parentNode` durante a visita e calcula metadados de recorte (`crop: { width, height, offsetX, offsetY, backgroundColor }`) baseados no `absoluteBoundingBox` do frame pai (seção) em relação ao nó de background, interrompendo a descida recursiva em seus filhos.
3. **Fallback de cor de fundo:** Se o frame pai não possuir preenchimento sólido visível (`firstSolidFillColor`), é utilizado o fundo do `page-wrapper` (raiz) como fallback (`resolveBackgroundFallbackColor`), assegurando que transparências não fiquem sem fundo escuro/claro original.
4. **Vinculação nativa ao container pai:** Em `extension/src/elementor.js`, `findBackgroundChild` localiza o nó filho tagueado com background direto do container pai e atribui os metadados nativos de `background_image` diretamente ao container pai.
5. **Composição e recorte pré-WebP:** Em `extension/src/webp.js`, a função `compositeBackgroundImage` usa factories injetáveis de canvas e bitmap para preencher o canvas na dimensão do frame pai, aplicar a cor de fallback de fundo quando existente e desenhar a imagem posicionada nos offsets calculados antes da conversão para WebP em `extension/popup.js`.
6. **Atualização de testes legados:** Em alinhamento prévio via confirmação, 3 testes legados que verificavam o comportamento anterior foram atualizados para validar que imagens filhas de `image-background` são suprimidas e que backgrounds vinculam-se ao container pai. 6 novos testes foram adicionados cobrindo todos os novos requisitos.

---

## 2. Diffs das Alterações

### 2.1 `src/core/handlers.js`

```diff
--- a/src/core/handlers.js
+++ b/src/core/handlers.js
@@ -246,13 +246,10 @@ export function applyChildFillSizing(childNode, childResult) {
 }
 
 export async function handleManualTag(node, tag, isRoot, maps) {
-  if (
-    tag === "container" ||
-    tag === "container-full" ||
-    tag === "page-wrapper" ||
-    tag === "image-background" ||
-    tag === "background-image"
-  ) {
+  if (tag === "image-background" || tag === "background-image") {
+    return null;
+  }
+  if (tag === "container" || tag === "container-full" || tag === "page-wrapper") {
     let children = [];
     const childIsRoot = tag === "page-wrapper";
```

### 2.2 `extension/src/assets.js`

```diff
--- a/extension/src/assets.js
+++ b/extension/src/assets.js
@@ -1,4 +1,5 @@
 import { ASSET_TAGS, FIGMENTOR_TAGS, VECTOR_TYPES } from "./constants.js";
+import { figmaColorToRGBA } from "../../src/utils/colors.js";
 
 const TAG_PATTERN = /^\[([^\]]+)\]/;
 
@@ -78,6 +79,17 @@ export function walkNodes(node, visitor, path = "0") {
   }
 }
 
+function firstSolidFillColor(node) {
+  const paint = Array.isArray(node?.fills)
+    ? node.fills.find((fill) => fill?.type === "SOLID" && fill.visible !== false)
+    : null;
+  return paint ? figmaColorToRGBA(paint.color, paint.opacity ?? paint.color?.a) : null;
+}
+
+function resolveBackgroundFallbackColor(sectionNode, rootNode) {
+  return firstSolidFillColor(sectionNode) || firstSolidFillColor(rootNode) || null;
+}
+
 function getDimensions(node) {
   const bounds = node.absoluteBoundingBox || node.size || {};
   const width = toNumber(bounds.width, toNumber(node.width));
@@ -143,7 +155,7 @@ export function discoverAssets(root, pluginId) {
     assets.push(record);
   };
 
-  const visit = (node, path = "0", inheritedIconTag = null) => {
+  const visit = (node, path = "0", inheritedIconTag = null, parentNode = null) => {
     const tag = getNodeTag(node, pluginId);
     const role = getNodeRole(node, pluginId);
     const iconOwnerTag = iconTags.has(tag) ? tag : inheritedIconTag;
@@ -156,11 +168,25 @@ export function discoverAssets(root, pluginId) {
         add(createAssetRecord(child, `${path}.${index}`, pluginId, "carousel", "PNG", "WEBP"));
       });
     } else if (tag && ASSET_TAGS.has(tag) && !carouselChildIds.has(node.id)) {
-      const kind =
-        tag === "image-background" || tag === "background-image" ? "background" : "image";
-      const targetFormat =
-        kind === "image" || kind === "background" || kind === "carousel" ? "WEBP" : "WEBP";
-      add(createAssetRecord(node, path, pluginId, kind, "PNG", targetFormat));
+      const isFlattenedBackground = tag === "image-background" || tag === "background-image";
+      const kind = isFlattenedBackground ? "background" : "image";
+      const record = createAssetRecord(node, path, pluginId, kind, "PNG", "WEBP");
+      if (isFlattenedBackground && parentNode?.absoluteBoundingBox && node?.absoluteBoundingBox) {
+        const parentBounds = parentNode.absoluteBoundingBox;
+        const nodeBounds = node.absoluteBoundingBox;
+        record.width = parentBounds.width;
+        record.height = parentBounds.height;
+        record.aspectRatio =
+          parentBounds.height > 0 ? Number((parentBounds.width / parentBounds.height).toFixed(4)) : null;
+        record.crop = {
+          width: parentBounds.width,
+          height: parentBounds.height,
+          offsetX: nodeBounds.x - parentBounds.x,
+          offsetY: nodeBounds.y - parentBounds.y,
+          backgroundColor: resolveBackgroundFallbackColor(parentNode, root)
+        };
+      }
+      add(record);
     } else if (
       !carouselChildIds.has(node.id) &&
       Array.isArray(node.fills) &&
@@ -180,9 +206,12 @@ export function discoverAssets(root, pluginId) {
       add(record);
     }
 
-    (node.children || []).forEach((child, index) =>
-      visit(child, `${path}.${index}`, iconOwnerTag)
-    );
+    const isFlattenedBackground = tag === "image-background" || tag === "background-image";
+    if (!isFlattenedBackground) {
+      (node.children || []).forEach((child, index) =>
+        visit(child, `${path}.${index}`, iconOwnerTag, node)
+      );
+    }
   };
 
   visit(root);
```

### 2.3 `extension/src/elementor.js`

```diff
--- a/extension/src/elementor.js
+++ b/extension/src/elementor.js
@@ -85,6 +85,16 @@ function bindIconList(settings, source) {
   });
 }
 
+function findBackgroundChild(sourceNode, pluginId) {
+  if (!Array.isArray(sourceNode?.children)) return null;
+  return (
+    sourceNode.children.find((child) => {
+      const childTag = getNodeTag(child, pluginId);
+      return childTag === "image-background" || childTag === "background-image";
+    }) || null
+  );
+}
+
 function bindElementAssets(element, sourceMap, pluginId, sidecar) {
   const settings = element?.settings;
   const source = settings?.figmentor_source_node_id
@@ -100,17 +110,20 @@ function bindElementAssets(element, sourceMap, pluginId, sidecar) {
       settings.figmentor_assets.image = assetMetadata(source, "image", "image");
     }
 
-    if (element.elType === "container" && ["image-background", "background-image"].includes(tag)) {
-      settings.background_background = "classic";
-      settings.background_image = nativeImage();
-      settings.background_position = settings.background_position || "center center";
-      settings.background_repeat = settings.background_repeat || "no-repeat";
-      settings.background_size = settings.background_size || "cover";
-      settings.figmentor_assets.background_image = assetMetadata(
-        source,
-        "background",
-        "background_image"
-      );
+    if (element.elType === "container") {
+      const backgroundChild = findBackgroundChild(source, pluginId);
+      if (backgroundChild) {
+        settings.background_background = "classic";
+        settings.background_image = nativeImage();
+        settings.background_position = settings.background_position || "center center";
+        settings.background_repeat = settings.background_repeat || "no-repeat";
+        settings.background_size = settings.background_size || "cover";
+        settings.figmentor_assets.background_image = assetMetadata(
+          backgroundChild,
+          "background",
+          "background_image"
+        );
+      }
     }
 
     if (element.widgetType === "image-carousel" && Array.isArray(settings.carousel)) {
```

### 2.4 `extension/src/webp.js`

```diff
--- a/extension/src/webp.js
+++ b/extension/src/webp.js
@@ -29,6 +29,18 @@ function encodeCanvas(canvas, quality) {
   });
 }
 
+function encodeCanvasToPng(canvas) {
+  if (typeof canvas.convertToBlob === "function") {
+    return canvas.convertToBlob({ type: "image/png" });
+  }
+  return new Promise((resolve, reject) => {
+    canvas.toBlob(
+      (blob) => (blob ? resolve(blob) : reject(new Error("O navegador não conseguiu gerar o PNG."))),
+      "image/png"
+    );
+  });
+}
+
 function buildScales(minScale = 0.08, decay = 0.82) {
   const scales = [];
   let scale = 1;
@@ -117,3 +129,30 @@ export async function convertPngBlobToWebp(pngBlob, options = {}) {
     reason: `A melhor versão gerada ficou com ${best.bytes} bytes, acima do limite de ${maxBytes} bytes.`
   };
 }
+
+/**
+ * Recorta o PNG renderizado pelo Figma no tamanho do frame pai (`width`/`height`),
+ * posicionando-o em (`offsetX`, `offsetY`) — necessário porque um grupo tagueado
+ * image-background pode ter bounding box maior que o frame que o contém. Se
+ * `backgroundColor` for informado, preenche o canvas com essa cor antes de
+ * desenhar a imagem por cima, pra não perder cor atrás de partes transparentes.
+ */
+export async function compositeBackgroundImage(pngBlob, options = {}) {
+  const { width, height, offsetX = 0, offsetY = 0, backgroundColor = null } = options;
+  if (!width || !height) throw new Error("compositeBackgroundImage precisa de width e height.");
+  const bitmap = await (options.bitmapFactory || defaultBitmapFactory)(pngBlob);
+  try {
+    const canvas = (options.canvasFactory || defaultCanvasFactory)(width, height);
+    const context = canvas.getContext("2d");
+    if (!context) throw new Error("O navegador não criou o contexto 2D para compor o background.");
+    context.clearRect?.(0, 0, width, height);
+    if (backgroundColor) {
+      context.fillStyle = backgroundColor;
+      context.fillRect(0, 0, width, height);
+    }
+    context.drawImage(bitmap, offsetX, offsetY);
+    return await encodeCanvasToPng(canvas);
+  } finally {
+    bitmap.close?.();
+  }
+}
```

### 2.5 `extension/popup.js`

```diff
--- a/extension/popup.js
+++ b/extension/popup.js
@@ -9,7 +9,7 @@ import {
 import { buildAssetManifest, createAssetReport, selectAssetsForProcessing } from "./src/assets.js";
 import { buildElementorDocument, patchElementorAssets } from "./src/elementor.js";
 import { validateElementorDocument } from "./src/contract.js";
-import { convertPngBlobToWebp } from "./src/webp.js";
+import { compositeBackgroundImage, convertPngBlobToWebp } from "./src/webp.js";
 import {
   extractWordPressContext,
   insertElementorDocument,
@@ -293,7 +293,10 @@ async function processAssets(manifest, token, onlyFailed = false) {
       const mimeType = isSvg ? "image/svg+xml" : "image/webp";
 
       if (!isSvg) {
-        const converted = await convertPngBlobToWebp(rendered.blob);
+        const sourceBlob = asset.crop
+          ? await compositeBackgroundImage(rendered.blob, asset.crop)
+          : rendered.blob;
+        const converted = await convertPngBlobToWebp(sourceBlob);
         asset.sourceBytes = rendered.blob.size;
         asset.targetBytes = converted.bytes;
         asset.width = converted.width;
```

### 2.6 `CHANGELOG.md`

```diff
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -4,6 +4,7 @@
 
 ### Added
 
+- Grupos tagueados como `image-background`/`background-image` agora passam por flattening no tamanho do frame pai (com recorte de canvas e fallback de cor de fundo), sendo aplicados como `background_image` nativo do container pai em vez de gerar containers ou widgets de imagem soltos.
 - A extensão agora aceita WordPress local (`localhost`, `127.0.0.1`, `*.local`, `*.test`) sem exigir HTTPS, mantendo a exigência de HTTPS para qualquer outro domínio.
 
 ### Fixed
```

---

## 3. Testes Adicionados e Atualizados

### Testes Adicionados
1. `tests/extension.test.js`:
   - `discoverAssets flattens image-background, crops to parent bounds and suppresses child images` (Caso 1)
   - `discoverAssets uses parent solid fill color as background fallback for flattened background` (Caso 2)
   - `discoverAssets falls back to root solid fill color when parent has no fill` (Caso 3)
   - `buildElementorDocument flattens image-background to container background and excludes loose image widgets` (Caso 5 — estrutura tipo Frame 12)
   - `compositeBackgroundImage creates cropped canvas and applies background color when provided` (Caso 6 — factories injetáveis)
2. `tests/traverse.test.js`:
   - `handleManualTag chamado diretamente com image-background e background-image retorna null` (Caso 4)

### Testes Atualizados (alinhamento de contrato)
- `extension ignores untagged raster images nested inside image-background section`: atualizado para verificar que apenas 1 asset é emitido e que imagens aninhadas não viram assets soltos.
- `extension ignores untagged raster images that are direct children of an image-background section`: atualizado para verificar a supressão de imagens filhas diretas.
- `extension flattens page wrapper output and maps backgrounds to native containers`: atualizado para posicionar o nó de background como filho do container correspondente.

---

## 4. Resultado dos Comandos de Validação

### `npm run check`

```
> figma-to-elementor@2.0.0 check
> npm run build && npm test


> figma-to-elementor@2.0.0 build
> npm run build:figma && npm run build:extension


> figma-to-elementor@2.0.0 build:figma
> esbuild src/index.js --bundle --outfile=dist/code.js


  dist/code.js  78.8kb

⚡ Done in 12ms

> figma-to-elementor@2.0.0 build:extension
> esbuild extension/popup.js --bundle --format=esm --outfile=extension/dist/popup.js


  extension/dist/popup.js  142.3kb

⚡ Done in 3ms

> figma-to-elementor@2.0.0 test
> node --test

✔ selector registry covers every Figmentor widget and exposes explicit slots (0.514583ms)
✔ advanced gradients, blur, blend and compound shadows become scoped CSS (0.416083ms)
✔ advanced effects keep representable native layers in the generated CSS (0.07525ms)
✔ text gradients target the explicit Elementor text slot and preserve solid layers (0.084625ms)
✔ unsupported effects and item targets are explicit in the report (0.36ms)
✔ invalid CSS IDs never escape the selector scope (0.110166ms)
✔ a single solid fill and one drop shadow remain native (0.104708ms)
✔ normalization guarantees a stable CSS ID for every exported element (0.344417ms)
✔ effect summaries remain compact and count CSS and flags without duplicating UI reports (0.136042ms)
✔ the native plugin contract validates scoped custom CSS too (0.232333ms)
✔ extension UI exposes the phased workflow and Elementor action (1.181125ms)
✔ extension parses Figma file and optional node URLs (0.441792ms)
✔ extension can use a Figma selection link as the frame source (0.113542ms)
✔ extension normalizes Figma URL node IDs from hyphens to colons (0.183916ms)
✔ shared Figma data uses the stable Figmentor namespace (0.122125ms)
✔ REST selection lookup selects the node from the active file (0.368625ms)
✔ REST selection lookup reports the missing scope clearly (0.285916ms)
✔ registered-frame lookup requests a valid positive Figma depth (0.194875ms)
✔ extension reads plugin tags and roles from REST-shaped pluginData (0.102667ms)
✔ role prefixes are not promoted to Elementor widget tags (1.970542ms)
✔ extension discovers tagged image, background and SVG icon assets (0.663209ms)
✔ extension ignores untagged raster images nested inside image-background section (0.098917ms)
✔ extension ignores untagged raster images that are direct children of an image-background section (0.051042ms)
✔ extension creates an Elementor document and patches uploaded media IDs (3.5195ms)
✔ extension flattens page wrapper output and maps backgrounds to native containers (0.60375ms)
✔ REST traversal preserves nested layout, spacing, typography, color, border and shadow (0.617875ms)
✔ Font Awesome remains native and custom vectors remain real SVG assets (0.528625ms)
✔ failed custom icon-list SVGs use a valid explicit Font Awesome placeholder (0.3ms)
✔ semantic validation rejects empty SVG icons before Elementor save (0.050583ms)
✔ semantic validation rejects empty native media before Elementor save (0.058584ms)
✔ semantic validation allows placeholder native media during document preparation (0.056167ms)
✔ treatMissingMediaAsWarning downgrades missing native media to a warning without blocking other errors (0.073166ms)
✔ asset failures produce a detailed report and retry selects only failed assets (0.092291ms)
✔ WebP conversion searches quality and scale and reports the byte ceiling (0.3295ms)
✔ WebP conversion returns the best candidate instead of throwing when the ceiling is impossible (0.093375ms)
✔ isAllowedWordPressTabUrl accepts any HTTPS URL (0.0445ms)
✔ isAllowedWordPressTabUrl accepts http://localhost with custom ports (0.049209ms)
✔ isAllowedWordPressTabUrl accepts http://127.0.0.1 (0.02625ms)
✔ isAllowedWordPressTabUrl accepts http://*.local domains (0.027375ms)
✔ isAllowedWordPressTabUrl accepts http://*.test domains (0.022625ms)
✔ isAllowedWordPressTabUrl rejects non-local HTTP domains (0.025958ms)
✔ isAllowedWordPressTabUrl rejects domains with .local inside the hostname rather than suffix (0.030416ms)
✔ isAllowedWordPressTabUrl handles malformed and invalid URLs safely (0.039ms)
✔ extension normalizes and validates the WordPress session context (0.167792ms)
✔ Elementor AJAX body uses the real elementor_ajax envelope and keeps draft status (0.119208ms)
✔ WordPress status is explicitly changed to draft before Elementor save (0.1445ms)
✔ Elementor page mode handles an empty page and persistence verifies elements and media (0.234667ms)
✔ semantic validation rejects assetRef mixed into Elementor native media fields (0.083208ms)
✔ Elementor save payload preserves existing elements in section mode (0.098625ms)
✔ Elementor insertion rejects a false save response instead of reporting success (0.332042ms)
✔ normalizeElementorDocument mirrors css_id to _element_id for every element (0.040875ms)
✔ discoverAssets flattens image-background, crops to parent bounds and suppresses child images (0.08425ms)
✔ discoverAssets uses parent solid fill color as background fallback for flattened background (0.061708ms)
✔ discoverAssets falls back to root solid fill color when parent has no fill (0.056792ms)
✔ buildElementorDocument flattens image-background to container background and excludes loose image widgets (0.215791ms)
✔ compositeBackgroundImage creates cropped canvas and applies background color when provided (0.205333ms)
✔ manifest points to an existing Figma runtime (1.40575ms)
✔ source and bundle expose the Figma plugin entrypoint (0.268958ms)
✔ UI tags have corresponding backend handling (0.839ms)
✔ UI exposes the approved section and page modes (0.186208ms)
✔ selection connector defines a stable frame registration record (0.852583ms)
✔ Figma runtime listens for selection changes (0.168875ms)
✔ export contract annotates stable metadata and validates page output (0.820292ms)
✔ export contract avoids collisions with existing suffixed css ids (0.077917ms)
✔ export contract rejects invalid mode envelopes and malformed elements (0.074958ms)
✔ audit baseline is part of the repository (0.306ms)
✔ traverseNode descarta node órfão sem tag (0.547541ms)
✔ traverseNode descarta qualquer node com tag ignore em diferentes posições (0.102334ms)
✔ handleManualTag processa tag button com texto e alinhamento padrão (0.909208ms)
✔ handleManualTag processa tag container-carousel retornando nested-carousel com elements mapeados (0.307375ms)
✔ handleManualTag processa tag accordeon sem itens reconhecíveis caindo no fallback padrão (0.179458ms)
✔ handleManualTag chamado diretamente com image-background e background-image retorna null (0.085167ms)
ℹ tests 72
ℹ suites 0
ℹ pass 72
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 73.002375
```

### `git diff --check`

```
(zero avisos ou erros de whitespace)
```

### `npm run lint`

```
> figma-to-elementor@2.0.0 lint
> eslint .

(zero avisos ou erros)
```
