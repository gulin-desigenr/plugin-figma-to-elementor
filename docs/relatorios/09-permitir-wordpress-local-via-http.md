# Relatório de Implementação — Feature 09: Permitir WordPress Local via HTTP

- **Data:** 2026-09-06
- **Branch:** `feature/permitir-wordpress-local-http`
- **Status:** Concluído sem commit ou push

---

## 1. Resumo da Implementação

A extensão Figmentor Bridge exigia estritamente páginas HTTPS para detecção do WordPress/Elementor e requisição de permissões de origem via Chrome API. Esse comportamento bloqueava ambientes de desenvolvimento local como o Local (WP Engine), Lando ou DDEV, que operam frequentemente em HTTP simples ou com domínios `.local` / `.test`.

Foi implementada a validação centralizada `isAllowedWordPressTabUrl` que aceita:
- Qualquer URL `https://*`
- Ambientes locais em `http://`:
  - `localhost` (qualquer porta, ex.: `http://localhost:10004`)
  - `127.0.0.1`
  - Qualquer host terminado em `.local` (ex.: `figmentor-teste.local`)
  - Qualquer host terminado em `.test` (ex.: `meusite.test`)

URLs HTTP arbitrárias (ex.: `http://meusite.com`) e ataques de sufixo (ex.: `http://evil.local.attacker.com`) continuam bloqueados com segurança.

Foram atualizadas as duas camadas necessárias:
1. `isAllowedWordPressTabUrl` em `extension/src/wordpress.js` e consumida em `extension/popup.js` (`detectWordPress`).
2. Declaração dos padrões correspondentes em `optional_host_permissions` de `extension/manifest.json`.

---

## 2. Diffs das Alterações

### 2.1 `extension/src/wordpress.js`

```diff
--- a/extension/src/wordpress.js
+++ b/extension/src/wordpress.js
@@ -1,5 +1,24 @@
 import { validateElementorDocument } from "./contract.js";
 
+const LOCAL_DEV_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);
+const LOCAL_DEV_HOST_SUFFIXES = [".local", ".test"];
+
+export function isAllowedWordPressTabUrl(url) {
+  if (typeof url !== "string" || !url) return false;
+  if (/^https:\/\//.test(url)) return true;
+  let parsed;
+  try {
+    parsed = new URL(url);
+  } catch {
+    return false;
+  }
+  if (parsed.protocol !== "http:") return false;
+  return (
+    LOCAL_DEV_HOSTNAMES.has(parsed.hostname) ||
+    LOCAL_DEV_HOST_SUFFIXES.some((suffix) => parsed.hostname.endsWith(suffix))
+  );
+}
+
 function normalizeRestRoot(value, origin) {
   const fallback = `${origin.replace(/\/$/, "")}/wp-json/`;
   if (!value || typeof value !== "string") return fallback;
```

### 2.2 `extension/popup.js`

```diff
--- a/extension/popup.js
+++ b/extension/popup.js
@@ -13,6 +13,7 @@ import { convertPngBlobToWebp } from "./src/webp.js";
 import {
   extractWordPressContext,
   insertElementorDocument,
+  isAllowedWordPressTabUrl,
   probeWordPressTab,
   reloadAndVerifyElementorDocument,
   uploadMediaToWordPress,
@@ -223,8 +224,12 @@ async function detectWordPress() {
   setStatus("Verificando a aba ativa como WordPress/Elementor...", false, "elementor");
   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
 
-  if (!tab?.id || !tab.url || !/^https:\/\//.test(tab.url)) {
-    setStatus("A aba ativa não é uma página HTTPS disponível para o WordPress.", true, "elementor");
+  if (!tab?.id || !isAllowedWordPressTabUrl(tab.url)) {
+    setStatus(
+      "A aba ativa não é HTTPS nem um ambiente local reconhecido (localhost, 127.0.0.1, *.local, *.test).",
+      true,
+      "elementor"
+    );
     return;
   }
```

### 2.3 `extension/manifest.json`

```diff
--- a/extension/manifest.json
+++ b/extension/manifest.json
@@ -24,7 +24,11 @@
     "https://api.figma.com/*"
   ],
   "optional_host_permissions": [
-    "https://*/*"
+    "https://*/*",
+    "http://localhost/*",
+    "http://127.0.0.1/*",
+    "http://*.local/*",
+    "http://*.test/*"
   ]
 }
```

### 2.4 `tests/extension.test.js`

```diff
--- a/tests/extension.test.js
+++ b/tests/extension.test.js
@@ -22,6 +22,7 @@ import {
   ensureWordPressDraft,
   extractWordPressContext,
   insertElementorDocument,
+  isAllowedWordPressTabUrl,
   validateWordPressContext,
   verifyElementorPersistence
 } from "../extension/src/wordpress.js";
@@ -949,6 +950,41 @@ test("WebP conversion returns the best candidate instead of throwing when the ce
   assert.match(result.reason, /acima do limite/);
 });
 
+test("isAllowedWordPressTabUrl accepts any HTTPS URL", () => {
+  assert.equal(isAllowedWordPressTabUrl("https://qualquer-dominio.com"), true);
+});
+
+test("isAllowedWordPressTabUrl accepts http://localhost with custom ports", () => {
+  assert.equal(isAllowedWordPressTabUrl("http://localhost:10004"), true);
+});
+
+test("isAllowedWordPressTabUrl accepts http://127.0.0.1", () => {
+  assert.equal(isAllowedWordPressTabUrl("http://127.0.0.1"), true);
+});
+
+test("isAllowedWordPressTabUrl accepts http://*.local domains", () => {
+  assert.equal(isAllowedWordPressTabUrl("http://figmentor-teste.local"), true);
+});
+
+test("isAllowedWordPressTabUrl accepts http://*.test domains", () => {
+  assert.equal(isAllowedWordPressTabUrl("http://meusite.test"), true);
+});
+
+test("isAllowedWordPressTabUrl rejects non-local HTTP domains", () => {
+  assert.equal(isAllowedWordPressTabUrl("http://meusite.com"), false);
+});
+
+test("isAllowedWordPressTabUrl rejects domains with .local inside the hostname rather than suffix", () => {
+  assert.equal(isAllowedWordPressTabUrl("http://evil.local.attacker.com"), false);
+});
+
+test("isAllowedWordPressTabUrl handles malformed and invalid URLs safely", () => {
+  assert.equal(isAllowedWordPressTabUrl("not-a-url"), false);
+  assert.equal(isAllowedWordPressTabUrl(""), false);
+  assert.equal(isAllowedWordPressTabUrl(null), false);
+  assert.equal(isAllowedWordPressTabUrl(undefined), false);
+});
+
 test("extension normalizes and validates the WordPress session context", () => {
   const context = extractWordPressContext({
     tabId: 17,
```

### 2.5 `CHANGELOG.md`

```diff
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -2,6 +2,10 @@
 
 ## [Unreleased]
 
+### Added
+
+- A extensão agora aceita WordPress local (`localhost`, `127.0.0.1`, `*.local`, `*.test`) sem exigir HTTPS, mantendo a exigência de HTTPS para qualquer outro domínio.
+
 ### Fixed
 
 - A validação estrita de mídia nativa introduzida em `f0502db` bloqueava indevidamente o passo de preparo do JSON, antes do upload existir; agora esse passo usa uma checagem relaxada e a validação final continua estrita.
```

---

## 3. Testes Novos

Foram adicionados 8 testes unitários cobrindo todos os cenários especificados:
1. `isAllowedWordPressTabUrl accepts any HTTPS URL` (`https://qualquer-dominio.com` -> `true`)
2. `isAllowedWordPressTabUrl accepts http://localhost with custom ports` (`http://localhost:10004` -> `true`)
3. `isAllowedWordPressTabUrl accepts http://127.0.0.1` (`http://127.0.0.1` -> `true`)
4. `isAllowedWordPressTabUrl accepts http://*.local domains` (`http://figmentor-teste.local` -> `true`)
5. `isAllowedWordPressTabUrl accepts http://*.test domains` (`http://meusite.test` -> `true`)
6. `isAllowedWordPressTabUrl rejects non-local HTTP domains` (`http://meusite.com` -> `false`)
7. `isAllowedWordPressTabUrl rejects domains with .local inside the hostname rather than suffix` (`http://evil.local.attacker.com` -> `false`)
8. `isAllowedWordPressTabUrl handles malformed and invalid URLs safely` (`not-a-url`, `""`, `null`, `undefined` -> `false`)

---

## 4. Resultado Exato de `npm run check`

```text
> figma-to-elementor@2.0.0 check
> npm run build && npm test


> figma-to-elementor@2.0.0 build
> npm run build:figma && npm run build:extension


> figma-to-elementor@2.0.0 build:figma
> esbuild src/index.js --bundle --outfile=dist/code.js


  dist/code.js  78.7kb

⚡ Done in 10ms

> figma-to-elementor@2.0.0 build:extension
> esbuild extension/popup.js --bundle --format=esm --outfile=extension/dist/popup.js


  extension/dist/popup.js  139.3kb

⚡ Done in 6ms

> figma-to-elementor@2.0.0 test
> node --test

✔ selector registry covers every Figmentor widget and exposes explicit slots (0.50025ms)
✔ advanced gradients, blur, blend and compound shadows become scoped CSS (0.469084ms)
✔ advanced effects keep representable native layers in the generated CSS (0.088125ms)
✔ text gradients target the explicit Elementor text slot and preserve solid layers (0.093042ms)
✔ unsupported effects and item targets are explicit in the report (0.391709ms)
✔ invalid CSS IDs never escape the selector scope (0.067459ms)
✔ a single solid fill and one drop shadow remain native (0.0815ms)
✔ normalization guarantees a stable CSS ID for every exported element (0.314583ms)
✔ effect summaries remain compact and count CSS and flags without duplicating UI reports (0.124792ms)
✔ the native plugin contract validates scoped custom CSS too (0.224209ms)
✔ extension UI exposes the phased workflow and Elementor action (0.877083ms)
✔ extension parses Figma file and optional node URLs (0.435541ms)
✔ extension can use a Figma selection link as the frame source (0.10375ms)
✔ extension normalizes Figma URL node IDs from hyphens to colons (0.051542ms)
✔ shared Figma data uses the stable Figmentor namespace (0.055084ms)
✔ REST selection lookup selects the node from the active file (0.28125ms)
✔ REST selection lookup reports the missing scope clearly (0.280584ms)
✔ registered-frame lookup requests a valid positive Figma depth (0.240875ms)
✔ extension reads plugin tags and roles from REST-shaped pluginData (0.128208ms)
✔ role prefixes are not promoted to Elementor widget tags (1.890917ms)
✔ extension discovers tagged image, background and SVG icon assets (0.509708ms)
✔ extension discovers untagged raster images nested inside image-background section (0.11325ms)
✔ extension discovers untagged raster images that are direct children of an image-background section (0.08275ms)
✔ extension creates an Elementor document and patches uploaded media IDs (1.268ms)
✔ extension flattens page wrapper output and maps backgrounds to native containers (0.451833ms)
✔ REST traversal preserves nested layout, spacing, typography, color, border and shadow (0.529125ms)
✔ Font Awesome remains native and custom vectors remain real SVG assets (0.500416ms)
✔ failed custom icon-list SVGs use a valid explicit Font Awesome placeholder (0.315167ms)
✔ semantic validation rejects empty SVG icons before Elementor save (0.049625ms)
✔ semantic validation rejects empty native media before Elementor save (0.056625ms)
✔ semantic validation allows placeholder native media during document preparation (0.074166ms)
✔ treatMissingMediaAsWarning downgrades missing native media to a warning without blocking other errors (0.057666ms)
✔ asset failures produce a detailed report and retry selects only failed assets (0.083917ms)
✔ WebP conversion searches quality and scale and reports the byte ceiling (0.335ms)
✔ WebP conversion returns the best candidate instead of throwing when the ceiling is impossible (0.101875ms)
✔ isAllowedWordPressTabUrl accepts any HTTPS URL (0.048125ms)
✔ isAllowedWordPressTabUrl accepts http://localhost with custom ports (0.050083ms)
✔ isAllowedWordPressTabUrl accepts http://127.0.0.1 (0.027416ms)
✔ isAllowedWordPressTabUrl accepts http://*.local domains (0.032ms)
✔ isAllowedWordPressTabUrl accepts http://*.test domains (0.024666ms)
✔ isAllowedWordPressTabUrl rejects non-local HTTP domains (0.02425ms)
✔ isAllowedWordPressTabUrl rejects domains with .local inside the hostname rather than suffix (0.0245ms)
✔ isAllowedWordPressTabUrl handles malformed and invalid URLs safely (0.048917ms)
✔ extension normalizes and validates the WordPress session context (0.179542ms)
✔ Elementor AJAX body uses the real elementor_ajax envelope and keeps draft status (0.126625ms)
✔ WordPress status is explicitly changed to draft before Elementor save (0.17075ms)
✔ Elementor page mode handles an empty page and persistence verifies elements and media (0.93075ms)
✔ semantic validation rejects assetRef mixed into Elementor native media fields (0.154541ms)
✔ Elementor save payload preserves existing elements in section mode (0.1275ms)
✔ Elementor insertion rejects a false save response instead of reporting success (0.393709ms)
✔ manifest points to an existing Figma runtime (1.529958ms)
✔ source and bundle expose the Figma plugin entrypoint (0.279167ms)
✔ UI tags have corresponding backend handling (0.844ms)
✔ UI exposes the approved section and page modes (0.179167ms)
✔ selection connector defines a stable frame registration record (0.732708ms)
✔ Figma runtime listens for selection changes (0.164041ms)
✔ export contract annotates stable metadata and validates page output (0.330208ms)
✔ export contract avoids collisions with existing suffixed css ids (0.075667ms)
✔ export contract rejects invalid mode envelopes and malformed elements (0.069167ms)
✔ audit baseline is part of the repository (0.331542ms)
✔ traverseNode descarta node órfão sem tag (0.593416ms)
✔ traverseNode descarta qualquer node com tag ignore em diferentes posições (0.107875ms)
✔ handleManualTag processa tag button com texto e alinhamento padrão (0.999708ms)
✔ handleManualTag processa tag container-carousel retornando nested-carousel com elements mapeados (0.35275ms)
✔ handleManualTag processa tag accordeon sem itens reconhecíveis caindo no fallback padrão (0.20075ms)
ℹ tests 65
ℹ suites 0
ℹ pass 65
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 69.98775
```

---

## 5. Validações Complementares

- `git diff --check`: 0 erros de formatação / whitespace.
- `npm run lint`: 0 erros de linting (`eslint .` aprovado).
- Sem commits ou pushes realizados.
