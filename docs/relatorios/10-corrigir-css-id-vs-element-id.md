# Relatório de Implementação — Feature 10: Corrigir `css_id` vs `_element_id`

- **Data:** 2026-09-06
- **Branch:** `feature/corrigir-css-id-element-id`
- **Status:** Concluído sem commit ou push

---

## 1. Causa Raiz e Contexto

No Elementor, o controle responsável por definir o atributo `id` HTML do elemento renderizado na página publicada é registrado com a chave `_element_id` (com underscore inicial), conforme verificado em `includes/widgets/common-base.php` e `includes/base/element-base.php`:

```php
if ( ! empty( $settings['_element_id'] ) ) {
    $this->add_render_attribute( '_wrapper', 'id', trim( $settings['_element_id'] ) );
}
```

O Figmentor historicamente emitia apenas `settings.css_id`. Como consequência, o Elementor nunca criava o atributo `id` no DOM da página publicada para os elementos exportados, tornando o `custom_css` (`#{css_id} { ... }`) inoperante no navegador por falta de um elemento alvo correspondente ao seletor gerado.

### Solução implementada

Mantendo `settings.css_id` inalterado como identificador canônico interno do Figmentor (usado em `elementor-selectors.js`, geração de regras de efeito e relatórios), o valor final computado e deduplicado de `css_id` passa a ser espelhado também em `settings._element_id` em todo elemento normalizado/anotado:
- No plugin Figma (`src/core/contract.js` na função `annotateElements`)
- Na extensão Chrome Bridge (`extension/src/contract.js` na função `normalizeElements`)

Não foram introduzidas restrições de validação que rejeitem documentos sem `_element_id`, preservando compatibilidade com documentos instanciados diretamente em testes unitários.

---

## 2. Diffs das Alterações

### 2.1 `src/core/contract.js`

```diff
--- a/src/core/contract.js
+++ b/src/core/contract.js
@@ -83,12 +83,14 @@ function annotateElements(elements, depth, parentPath, seenCssIds) {
     };
 
     if (annotated.settings) {
+      const finalCssId = uniqueCssId(
+        safeCssId(annotated.settings.css_id, `figmentor-${annotated.id}`),
+        seenCssIds
+      );
       annotated.settings = {
         ...annotated.settings,
-        css_id: uniqueCssId(
-          safeCssId(annotated.settings.css_id, `figmentor-${annotated.id}`),
-          seenCssIds
-        )
+        css_id: finalCssId,
+        _element_id: finalCssId
       };
     }
```

### 2.2 `extension/src/contract.js`

```diff
--- a/extension/src/contract.js
+++ b/extension/src/contract.js
@@ -190,6 +190,7 @@ function normalizeElements(value, depth, parentPath, seenCssIds, seenIds) {
       sanitizeStableCssId(requestedCssId, fallbackCssId),
       seenCssIds
     );
+    normalized.settings._element_id = normalized.settings.css_id;
 
     if (normalized.elType === "container" || Array.isArray(item.elements)) {
       normalized.elements = normalizeElements(item.elements, depth + 1, path, seenCssIds, seenIds);
```

### 2.3 `tests/smoke.test.js`

```diff
--- a/tests/smoke.test.js
+++ b/tests/smoke.test.js
@@ -138,6 +138,8 @@ test("export contract annotates stable metadata and validates page output", () =
   assert.equal(content[0].isInner, false);
   assert.equal(content[0].elements[0].isInner, true);
   assert.equal(content[0].elements[0].settings.css_id, "section-2");
+  assert.equal(content[0].settings._element_id, content[0].settings.css_id);
+  assert.equal(content[0].elements[0].settings._element_id, content[0].elements[0].settings.css_id);
 });
 
 test("export contract avoids collisions with existing suffixed css ids", () => {
```

### 2.4 `tests/extension.test.js`

```diff
--- a/tests/extension.test.js
+++ b/tests/extension.test.js
@@ -14,7 +14,7 @@ import {
   selectAssetsForProcessing
 } from "../extension/src/assets.js";
 import { buildElementorDocument, patchElementorAssets } from "../extension/src/elementor.js";
-import { validateElementorDocument } from "../extension/src/contract.js";
+import { normalizeElementorDocument, validateElementorDocument } from "../extension/src/contract.js";
 import { convertPngBlobToWebp } from "../extension/src/webp.js";
 import {
   buildElementorAjaxBody,
@@ -1258,3 +1258,35 @@ test("Elementor insertion rejects a false save response instead of reporting suc
     else globalThis.window = previousWindow;
   }
 });
+
+test("normalizeElementorDocument mirrors css_id to _element_id for every element", () => {
+  const document = normalizeElementorDocument(
+    {
+      version: "0.4",
+      type: "page",
+      page_settings: {},
+      content: [
+        {
+          elType: "container",
+          settings: { css_id: "section" },
+          elements: [
+            {
+              elType: "widget",
+              widgetType: "heading",
+              settings: { title: "Título", css_id: "section" }
+            }
+          ]
+        }
+      ]
+    },
+    "page"
+  );
+
+  assert.equal(document.content[0].settings._element_id, document.content[0].settings.css_id);
+  assert.equal(
+    document.content[0].elements[0].settings._element_id,
+    document.content[0].elements[0].settings.css_id
+  );
+  assert.equal(document.content[0].elements[0].settings.css_id, "section-2");
+  assert.equal(document.content[0].elements[0].settings._element_id, "section-2");
+});
```

### 2.5 `CHANGELOG.md`

```diff
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -8,6 +8,7 @@
 
 ### Fixed
 
+- O `custom_css` nunca era aplicado pelo Elementor porque o Figmentor escrevia apenas `css_id` enquanto o controle real do Elementor lê `_element_id`; agora ambos são emitidos com o mesmo valor tanto no contrato do plugin quanto na extensão.
 - A validação estrita de mídia nativa introduzida em `f0502db` bloqueava indevidamente o passo de preparo do JSON, antes do upload existir; agora esse passo usa uma checagem relaxada e a validação final continua estrita.
```

---

## 3. Cobertura de Testes e Validação

- `tests/smoke.test.js`: validação no teste `'export contract annotates stable metadata and validates page output'` de que `settings._element_id === settings.css_id` tanto para container raiz quanto para widget aninhado.
- `tests/extension.test.js`: novo teste `'normalizeElementorDocument mirrors css_id to _element_id for every element'` verificando o espelhamento de `_element_id` em elementos após normalização e deduplicação de IDs.

### Execução de `npm run check`

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


  extension/dist/popup.js  139.4kb

⚡ Done in 5ms

> figma-to-elementor@2.0.0 test
> node --test

✔ selector registry covers every Figmentor widget and exposes explicit slots (0.774417ms)
✔ advanced gradients, blur, blend and compound shadows become scoped CSS (0.455042ms)
✔ advanced effects keep representable native layers in the generated CSS (0.085084ms)
✔ text gradients target the explicit Elementor text slot and preserve solid layers (0.096667ms)
✔ unsupported effects and item targets are explicit in the report (0.384125ms)
✔ invalid CSS IDs never escape the selector scope (0.066292ms)
✔ a single solid fill and one drop shadow remain native (0.081833ms)
✔ normalization guarantees a stable CSS ID for every exported element (0.423125ms)
✔ effect summaries remain compact and count CSS and flags without duplicating UI reports (0.14875ms)
✔ the native plugin contract validates scoped custom CSS too (0.248041ms)
✔ extension UI exposes the phased workflow and Elementor action (0.94125ms)
✔ extension parses Figma file and optional node URLs (0.437333ms)
✔ extension can use a Figma selection link as the frame source (0.097292ms)
✔ extension normalizes Figma URL node IDs from hyphens to colons (0.05325ms)
✔ shared Figma data uses the stable Figmentor namespace (0.049875ms)
✔ REST selection lookup selects the node from the active file (0.251083ms)
✔ REST selection lookup reports the missing scope clearly (0.287916ms)
✔ registered-frame lookup requests a valid positive Figma depth (0.166292ms)
✔ extension reads plugin tags and roles from REST-shaped pluginData (0.097959ms)
✔ role prefixes are not promoted to Elementor widget tags (1.938959ms)
✔ extension discovers tagged image, background and SVG icon assets (0.574709ms)
✔ extension discovers untagged raster images nested inside image-background section (0.224458ms)
✔ extension discovers untagged raster images that are direct children of an image-background section (0.333667ms)
✔ extension creates an Elementor document and patches uploaded media IDs (3.31775ms)
✔ extension flattens page wrapper output and maps backgrounds to native containers (0.514208ms)
✔ REST traversal preserves nested layout, spacing, typography, color, border and shadow (0.591291ms)
✔ Font Awesome remains native and custom vectors remain real SVG assets (0.550667ms)
✔ failed custom icon-list SVGs use a valid explicit Font Awesome placeholder (0.343666ms)
✔ semantic validation rejects empty SVG icons before Elementor save (0.066208ms)
✔ semantic validation rejects empty native media before Elementor save (0.066125ms)
✔ semantic validation allows placeholder native media during document preparation (0.066416ms)
✔ treatMissingMediaAsWarning downgrades missing native media to a warning without blocking other errors (0.053333ms)
✔ asset failures produce a detailed report and retry selects only failed assets (0.083292ms)
✔ WebP conversion searches quality and scale and reports the byte ceiling (0.349041ms)
✔ WebP conversion returns the best candidate instead of throwing when the ceiling is impossible (0.102833ms)
✔ isAllowedWordPressTabUrl accepts any HTTPS URL (0.05ms)
✔ isAllowedWordPressTabUrl accepts http://localhost with custom ports (0.046292ms)
✔ isAllowedWordPressTabUrl accepts http://127.0.0.1 (0.020125ms)
✔ isAllowedWordPressTabUrl accepts http://*.local domains (0.026042ms)
✔ isAllowedWordPressTabUrl accepts http://*.test domains (0.020625ms)
✔ isAllowedWordPressTabUrl rejects non-local HTTP domains (0.019667ms)
✔ isAllowedWordPressTabUrl rejects domains with .local inside the hostname rather than suffix (0.019083ms)
✔ isAllowedWordPressTabUrl handles malformed and invalid URLs safely (0.044709ms)
✔ extension normalizes and validates the WordPress session context (0.191667ms)
✔ Elementor AJAX body uses the real elementor_ajax envelope and keeps draft status (0.12975ms)
✔ WordPress status is explicitly changed to draft before Elementor save (0.1465ms)
✔ Elementor page mode handles an empty page and persistence verifies elements and media (0.28225ms)
✔ semantic validation rejects assetRef mixed into Elementor native media fields (0.469458ms)
✔ Elementor save payload preserves existing elements in section mode (0.111167ms)
✔ Elementor insertion rejects a false save response instead of reporting success (0.361417ms)
✔ normalizeElementorDocument mirrors css_id to _element_id for every element (0.046042ms)
✔ manifest points to an existing Figma runtime (2.456667ms)
✔ source and bundle expose the Figma plugin entrypoint (0.457708ms)
✔ UI tags have corresponding backend handling (0.942708ms)
✔ UI exposes the approved section and page modes (0.4195ms)
✔ selection connector defines a stable frame registration record (0.924792ms)
✔ Figma runtime listens for selection changes (0.182042ms)
✔ export contract annotates stable metadata and validates page output (1.194625ms)
✔ export contract avoids collisions with existing suffixed css ids (0.097875ms)
✔ export contract rejects invalid mode envelopes and malformed elements (0.081125ms)
✔ audit baseline is part of the repository (0.340541ms)
✔ traverseNode descarta node órfão sem tag (0.545334ms)
✔ traverseNode descarta qualquer node com tag ignore em diferentes posições (0.1095ms)
✔ handleManualTag processa tag button com texto e alinhamento padrão (0.9465ms)
✔ handleManualTag processa tag container-carousel retornando nested-carousel com elements mapeados (0.316875ms)
✔ handleManualTag processa tag accordeon sem itens reconhecíveis caindo no fallback padrão (0.185667ms)
ℹ tests 66
ℹ suites 0
ℹ pass 66
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 78.81125
```

### Execução de `npm run lint` e `git diff --check`

```
> figma-to-elementor@2.0.0 lint
> eslint .

(passou limpo sem avisos ou erros)
```

`git diff --check`: nenhum aviso de whitespace ou quebra.
