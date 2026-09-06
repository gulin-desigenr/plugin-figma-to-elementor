# Correção 05 — descoberta de assets ignora imagens aninhadas dentro de uma seção com background

**Modelo recomendado:** o modelo mais capaz disponível no Antigravity (ex.: Gemini 3 Pro ou equivalente), esforço/thinking alto.
**Natureza:** correção de regressão de produção, confirmada com dados reais de um export do Pedro — não é hipótese, é causa raiz verificada arquivo por arquivo.

## Causa raiz confirmada

Depois da correção 04, Pedro tentou um export real. O upload de todos os 21 assets detectados funcionou (confirmado pelo `figmentor-assets-manifest.json` baixado, todos com `"status": "uploaded"` e `mediaId`/`mediaUrl` reais). Mesmo assim, a validação final rejeitou o documento porque vários widgets do tipo `image` continuavam com `settings.image = { id: "", url: "", size: "full" }`.

Comparando o `elementor-template.json` baixado (que tem o sidecar `document.figmentor.elements`) com o manifesto de assets, ficou claro: esses widgets de imagem nunca foram adicionados ao manifesto pra começar — não é falha de upload, é falha de **descoberta**. Os widgets afetados têm `sourceTag: null` (a imagem em si não tem um nome `[IMAGE]` no Figma, foi detectada só pelo preenchimento raster/fill do node), e todos estão aninhados, em profundidades variadas, dentro de um container cujo próprio nó Figma está marcado `image-background` (ex.: um widget de imagem no node `100:183`, filho profundo do node `120:2`, que é exatamente o `[IMAGE-BACKGROUND] Group 8` que aparece como sucesso no manifesto).

A causa está em `extension/src/assets.js`, função `discoverAssets`, dentro de `visit()`:

```js
const childInsideRaster = insideRasterTag || Boolean(tag && ASSET_TAGS.has(tag));
(node.children || []).forEach((child, index) =>
  visit(child, `${path}.${index}`, iconOwnerTag, childInsideRaster)
);
```

`insideRasterTag` é usado por uma checagem (`!insideRasterTag && ...`, mais abaixo na mesma função) que existe pra não tratar como asset separado uma camada de preenchimento sem tag que só compõe visualmente um node já tagueado como `image`/`image-background` (evitar contar a mesma imagem duas vezes). O problema é que, por causa do `insideRasterTag ||` no início da expressão, essa flag **nunca volta a ser `false`** uma vez ativada — ela se propaga por toda a subárvore de descendentes, não só pelo filho direto do node tagueado. Resultado: qualquer imagem sem tag própria, não importa quantos níveis abaixo, dentro de uma seção que tenha QUALQUER node tagueado como asset (ex.: um `[IMAGE-BACKGROUND]` de seção inteira), fica invisível pra descoberta de assets — nunca entra no manifesto, nunca é enviada ao WordPress, e por isso o widget final fica com o placeholder vazio e trava na validação final.

Isso não tem nada a ver com upload, com WordPress, ou com a correção 04 — é um bug de escopo pré-existente na função de descoberta, só ficou visível agora que a validação final passou a barrar (corretamente) documentos com imagem vazia.

## Objetivo

Fazer `insideRasterTag` valer só para os filhos diretos de um node tagueado como asset (a proteção original contra contar a mesma imagem duas vezes), sem se propagar para netos e descendentes mais profundos.

## Estado e preservação

- Repositório: `/Users/pedrogulin/Library/Mobile Documents/com~apple~CloudDocs/PEDRO_DEV/[01.2] PLUGIN FIGMA TO ELEMENTOR__feature_elementor_bridge`; branch `agent/figmentor-audit-baseline`.
- O working tree deve estar limpo neste momento (as correções 03 e 04 já foram commitadas e enviadas). Se `git status --short` mostrar algo além da pasta não rastreada `docs/prompts/`, pare e reporte — não é seu.
- Não faça commit, push, reset, checkout, clean ou stash. A revisão e o commit são feitos por outra pessoa depois.

## Alterações permitidas

**1. `extension/src/assets.js`**, dentro de `discoverAssets` → `visit()`:

Trocar:
```js
const childInsideRaster = insideRasterTag || Boolean(tag && ASSET_TAGS.has(tag));
```
por:
```js
const childInsideRaster = Boolean(tag && ASSET_TAGS.has(tag));
```

Ou seja, `childInsideRaster` passa a refletir só se **este** node (o pai imediato dos filhos que estão prestes a ser visitados) tem uma tag de asset — não se algum ancestral mais distante tinha. Não altere mais nada nessa função (a lógica de `carouselChildIds`, `iconOwnerTag`, e as três branches de detecção de asset continuam exatamente como estão).

**2. `tests/extension.test.js`**: adicionar um teste de regressão ao lado de `'extension discovers tagged image, background and SVG icon assets'` (linha ~221), reproduzindo a estrutura real que causou o bug: um node raiz contendo (a) um node tagueado `image-background`, e dentro dele, aninhado em pelo menos 3 níveis de containers sem tag, um node SEM tag que só tem `fills: [{ type: "IMAGE", visible: true }]` (o mesmo mecanismo de detecção usado na branch de fallback). Assert que `discoverAssets` retorna **2** assets: um `kind: "background"` (o node tagueado) e um `kind: "image"` (o node aninhado sem tag) — hoje ele retorna só 1, porque o segundo é descartado pelo bug.

**3. `CHANGELOG.md`**: adicionar uma linha em `### Fixed` sob `[Unreleased]` descrevendo a correção (descoberta de assets ignorava imagens sem tag aninhadas em qualquer profundidade dentro de uma seção com background/imagem tagueada, não só no filho direto).

Nenhum outro arquivo deve ser tocado.

## Fora de escopo absoluto

- Qualquer mudança na lógica de `carouselChildIds`, `iconOwnerTag`, ou nas três branches de detecção de asset em `visit()` além da linha indicada.
- Mexer em `extension/src/elementor.js`, `contract.js`, `wordpress.js`, ou qualquer arquivo de `src/`.
- Rodar ou testar contra um WordPress/Figma real.
- Fazer commit, push, reset, checkout, clean ou stash.

## Validação obrigatória

Rode, a partir da raiz do repositório:

```bash
npm run check
git diff --check
```

`npm run check` builda plugin + extensão e roda a suíte inteira. Hoje são 49 testes; deve continuar tudo passando mais o novo teste de regressão (50 no total).

## Entrega

Ao final, responda com: o diff exato da linha alterada em `assets.js`, o novo teste adicionado, e o resultado exato de `npm run check` (contagem de testes passando). Pare após isso — não commite.
