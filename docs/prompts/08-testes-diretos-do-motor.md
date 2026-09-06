# Feature 08 — testes diretos do motor (traverse.js/handlers.js), começando pelas 3 branches sem cobertura nenhuma

**Modelo recomendado:** o modelo mais capaz disponível no Antigravity (ex.: Gemini 3 Pro ou equivalente), esforço/thinking alto.
**Natureza:** item "High" da auditoria de 2026-09-02 ("core traversal has no direct behavioral test coverage"). É a rede de segurança antes de quebrar `handleManualTag` (achado High #4 da mesma auditoria) em funções menores — sem isso, uma refatoração ali não tem como provar que não mudou comportamento.

## Contexto

Hoje, `src/core/traverse.js` (`traverseNode`) e `src/core/handlers.js` (`handleManualTag`, ~860 linhas, 12+ branches por tag: container, page-wrapper, image-box, icon-box, icon-list, heading, text-editor, button, accordion, accordeon, image, image-carousel, container-carousel) só são exercitados **indiretamente**, através de `extension/src/elementor.js` → `buildElementorDocument()`, que chama `adaptRestNode()` seguido de `traverseNode()` e depois ainda passa o resultado por normalização (`normalizeElementorDocument`) e vinculação de assets (`bindElementAssets`). Isso significa que um teste que falha ali pode estar acusando um bug em qualquer uma dessas 3 camadas, não necessariamente no motor.

Levantei quais tags de `handleManualTag` têm **zero** menção em qualquer teste hoje (`tests/extension.test.js`, `tests/effects.test.js`, `tests/smoke.test.js`):
- `"button"` (linhas 461-540 de `src/core/handlers.js`)
- `"container-carousel"` (linhas 681-712)
- `"accordeon"` (linhas 584-654) — o alias legado de `nested-accordion` (diferente de `"accordion"`, que tem alguma cobertura)

E duas checagens de `traverseNode` (`src/core/traverse.js`, linhas 16-29) que também nunca são exercitadas diretamente:
- um node sem tag manual, que não é root e cujo ancestral não foi "validado" (não está dentro de um container/tag reconhecido), deve ser descartado (`return null`) — a "Interrupção Segura".
- um node com `elementor-tag: "ignore"` deve ser descartado (`return null`), em qualquer posição.

## Objetivo

Criar `tests/traverse.test.js` com testes que chamam **diretamente** `traverseNode` (de `src/core/traverse.js`) e `handleManualTag` (de `src/core/handlers.js`) — não via `buildElementorDocument`. Para construir os nodes no formato que essas funções esperam (com `getPluginData(key)`, etc.), reuse o mesmo adaptador que a extensão já usa em produção:

```js
import { adaptRestNode, buildRestStyleMaps } from "../extension/src/figma-rest-adapter.js";
import { traverseNode } from "../src/core/traverse.js";
import { handleManualTag } from "../src/core/handlers.js";
```

O padrão de uso real é este (veja `extension/src/elementor.js`, função `buildElementorDocument`, por volta da linha 182-183):
```js
const adaptedRoot = adaptRestNode(root, pluginId);
const maps = buildRestStyleMaps(root);
const result = await traverseNode(adaptedRoot, true, maps);
```
Para chamar `handleManualTag` diretamente (pulando `traverseNode`), adapte o node manualmente e passe a tag como segundo argumento: `handleManualTag(adaptedNode, "button", false, maps)`.

Os nodes de entrada (antes do `adaptRestNode`) são objetos JSON simples, no mesmo formato REST já usado em `tests/extension.test.js` — por exemplo:
```js
{
  id: "1:1",
  name: "[BUTTON] CTA",
  type: "FRAME",
  pluginData: { [pluginId]: { "elementor-tag": "button" } },
  children: [
    { id: "1:2", name: "Label", type: "TEXT", characters: "Comprar agora" }
  ]
}
```
Use `pluginId` do jeito que já é feito no topo de `tests/extension.test.js` (`const pluginId = ...`) — copie essa constante ou importe-a de lá, o que for mais simples.

## Testes a adicionar (mínimo — pode adicionar mais se for trivial, mas não é obrigatório)

1. **`traverseNode` descarta node órfão sem tag** — um node sem `elementor-tag`, passado com `isRoot: false` e `isInsideValidated: false`, deve retornar `null`.
2. **`traverseNode` descarta qualquer node com tag `"ignore"`** — mesmo em posições diferentes (raiz e não-raiz).
3. **`handleManualTag` com tag `"button"`** — um node com um filho de texto "Comprar agora" deve retornar `{ elType: "widget", widgetType: "button", settings: { text: "Comprar agora", ... } }`. Assert pelo menos `widgetType`, `settings.text`, e `settings.align` (sem `layoutSizingHorizontal`/`primaryAxisAlignItems` no node, o default é `"left"` — confira lendo a branch antes de assertar, não assuma).
4. **`handleManualTag` com tag `"container-carousel"`** — um node com 2 filhos (cada um um container simples, ex. `elementor-tag: "container"` com algum conteúdo, ou até vazio) deve retornar `{ elType: "widget", widgetType: "nested-carousel", elements: [...] }` com `elements.length === 2`.
5. **`handleManualTag` com tag `"accordeon"` sem itens reconhecíveis** — um node sem filhos que batam com o que `buildAccordeonItems` espera deve cair no fallback: `widgetType === "nested-accordion"`, `settings.items.length === 2` (títulos default "Item #1"/"Item #2"), `elements.length === 2`.

Para cada teste, **leia a branch correspondente em `src/core/handlers.js` antes de escrever o assert** — não adivinhe nomes de campo. Se o comportamento real de alguma branch parecer errado ou inesperado ao escrever o teste (não só "diferente do que eu pensava"), **não "corrija" silenciosamente nem no teste nem no código** — pare e reporte, é decisão de outra pessoa.

## Estado e preservação

- Repositório: `/Users/pedrogulin/Developer/[01.2] PLUGIN FIGMA TO ELEMENTOR__feature_elementor_bridge`; branch `feature/testes-diretos-motor-handlers` (criada a partir de `main` em 2026-09-06). **Confirme que está nessa branch** (`git branch --show-current`) antes de editar.
- O working tree deve estar limpo, exceto pela pasta não rastreada `docs/prompts/`. Se `git status --short` mostrar outra coisa, pare e reporte.
- Não faça commit, push, reset, checkout, clean ou stash. A revisão e o commit são feitos por outra pessoa depois.

## Alterações permitidas

- Criar `tests/traverse.test.js` (novo arquivo).
- Nenhuma mudança em `src/core/traverse.js`, `src/core/handlers.js`, ou qualquer outro arquivo de produção — isso é só teste. Se ao escrever os testes você achar que algo em `handlers.js`/`traverse.js` precisa mudar pra ser testável (ex.: algo não exportado que devia ser), **pare e reporte em vez de exportar/alterar por conta própria**.

## Fora de escopo absoluto

- Cobrir as outras 9 branches de `handleManualTag` (image-box, icon-box, icon-list, heading, text-editor, accordion, image, image-carousel, container/page-wrapper) — ficam pra uma rodada futura, essas já têm alguma cobertura indireta hoje.
- Quebrar `handleManualTag` em funções menores — é a tarefa seguinte do roadmap, depende desta aqui estar pronta primeiro.
- Mexer em `extension/`, `CHANGELOG.md`, ou qualquer outro arquivo fora de `tests/traverse.test.js`.
- Rodar ou testar contra um WordPress/Figma real.
- Fazer commit, push, reset, checkout, clean ou stash.

## Validação obrigatória

Rode, a partir da raiz do repositório:

```bash
npm run check
git diff --check
```

`npm run check` builda plugin + extensão e roda a suíte inteira. Hoje são 52 testes; deve continuar tudo passando mais os novos testes deste arquivo (pelo menos 57 no total, 5 novos).

## Entrega

Ao final, responda com: o conteúdo completo de `tests/traverse.test.js`, e o resultado exato de `npm run check` (contagem de testes passando). Se algum dos 5 comportamentos esperados não bateu com o código real e você precisou ajustar o assert pra refletir o comportamento real, destaque isso claramente na resposta (não é motivo pra parar, mas eu preciso saber). Pare após isso — não commite.
