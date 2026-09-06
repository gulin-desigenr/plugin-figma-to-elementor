# Feature 10 — corrigir `css_id` vs `_element_id`, o custom_css nunca funcionou de verdade

**Modelo recomendado:** o modelo mais capaz disponível no Antigravity (ex.: Gemini 3 Pro ou equivalente), esforço/thinking alto.
**Natureza:** correção estrutural de alta prioridade, achado #2 de `docs/auditoria-exportador/02-auditoria-visual-2026-09-06.md` — confirmado com certeza (lendo o próprio código-fonte PHP do Elementor instalado, não é suposição).

## Causa raiz confirmada

O Figmentor sempre escreveu `settings.css_id` em todo elemento exportado, esperando que isso virasse o atributo `id` do elemento no HTML renderizado pelo Elementor — e que o `custom_css` gerado (`#{css_id} { ... }`) funcionasse em cima disso.

Isso nunca funcionou. O controle real do Elementor pra isso se chama `_element_id` (com underscore), não `css_id`. Confirmado lendo o código-fonte do Elementor instalado localmente:

- `includes/widgets/common-base.php`, o controle "CSS ID" é registrado com a chave `_element_id`.
- `includes/base/element-base.php`: `if ( ! empty( $settings['_element_id'] ) ) { $this->add_render_attribute( '_wrapper', 'id', trim( $settings['_element_id'] ) ); }` — é essa e só essa chave que gera o atributo `id` no HTML final.

`_element_id` não existe em lugar nenhum do nosso código. Resultado: nenhum elemento exportado pelo Figmentor jamais recebeu um `id` real na página publicada, e por isso todo `custom_css` (gradientes, efeitos avançados) é código morto — o seletor `#{css_id}` que ele usa nunca corresponde a nada de verdade no HTML. Isso passa 100% na nossa validação interna (que só confere se `custom_css` e `css_id` batem entre si, nunca testou contra o Elementor real), mas nunca funcionou no navegador. Não é uma regressão recente — é estrutural, existe desde a criação do contrato de saída.

## Objetivo

Fazer o Figmentor emitir **também** `settings._element_id`, com o mesmo valor final de `settings.css_id`, em todo elemento exportado — nas duas implementações do contrato que existem hoje (uma pro plugin Figma, outra pra extensão Chrome). `css_id` continua existindo exatamente como está, sem nenhuma mudança de comportamento — ele é usado internamente pelo Figmentor pra deduplicação e pra montar os seletores do `custom_css`, e isso já funciona. A correção é só espelhar o valor final num campo novo que o Elementor de fato lê.

**Importante:** não troque `css_id` por `_element_id` em lugar nenhum — mantenha os dois. `css_id` é o identificador interno canônico do Figmentor (usado por `src/styles/elementor-selectors.js`, pela extração de efeitos avançados em `handlers.js`, pelos relatórios); `_element_id` é só o espelho que o Elementor precisa pra realmente aplicar o `id` no HTML.

## Alterações permitidas

### 1. `src/core/contract.js` (contrato do plugin Figma)

Na função `annotateElements`, o bloco que hoje é:
```js
if (annotated.settings) {
  annotated.settings = {
    ...annotated.settings,
    css_id: uniqueCssId(
      safeCssId(annotated.settings.css_id, `figmentor-${annotated.id}`),
      seenCssIds
    )
  };
}
```
Vira:
```js
if (annotated.settings) {
  const finalCssId = uniqueCssId(
    safeCssId(annotated.settings.css_id, `figmentor-${annotated.id}`),
    seenCssIds
  );
  annotated.settings = {
    ...annotated.settings,
    css_id: finalCssId,
    _element_id: finalCssId
  };
}
```

### 2. `extension/src/contract.js` (contrato da extensão Chrome)

Na função `normalizeElements`, logo depois de:
```js
normalized.settings.css_id = uniqueCssId(
  sanitizeStableCssId(requestedCssId, fallbackCssId),
  seenCssIds
);
```
adicionar uma linha:
```js
normalized.settings.css_id = uniqueCssId(
  sanitizeStableCssId(requestedCssId, fallbackCssId),
  seenCssIds
);
normalized.settings._element_id = normalized.settings.css_id;
```

Não mude nenhuma outra lógica dessas duas funções (dedução de ID de elemento, `isInner`, tratamento de container legado, etc.).

## Alterações em testes

**`tests/smoke.test.js`**: no teste existente `'export contract annotates stable metadata and validates page output'`, adicionar uma asserção nova confirmando o espelhamento:
```js
assert.equal(content[0].settings._element_id, content[0].settings.css_id);
assert.equal(content[0].elements[0].settings._element_id, content[0].elements[0].settings.css_id);
```
(logo depois da asserção já existente `assert.equal(content[0].elements[0].settings.css_id, "section-2");`)

**`tests/extension.test.js`**: procure o teste que exercita `normalizeElementorDocument` diretamente sobre um documento com múltiplos elementos (ex.: o teste de deduplicação de css_id, `'export contract avoids collisions with existing suffixed css ids'` tem uma versão equivalente pro lado da extensão — procure pelo nome análogo ou por `uniqueCssId`/`normalizeElementorDocument` nos testes já existentes) e adicione a mesma asserção de espelhamento (`settings._element_id === settings.css_id`) pra pelo menos dois elementos do resultado. Se não achar um teste equivalente já existente pro lado da extensão, adicione um teste novo, pequeno, só pra essa checagem — não precisa ser exaustivo, só provar que `normalizeElementorDocument` sempre espelha os dois campos.

**`CHANGELOG.md`**: adicionar uma linha em `### Fixed` sob `[Unreleased]` descrevendo a correção (custom_css nunca funcionava porque o Figmentor escrevia `css_id` mas o Elementor só lê `_element_id`; agora os dois são emitidos com o mesmo valor).

Nenhum outro arquivo deve ser tocado. Não adicione nenhuma regra de validação nova que rejeite documentos sem `_element_id` — os testes existentes que constroem documentos manualmente (sem passar pela normalização) não devem quebrar; a garantia é só na emissão, não em validação adicional.

## Estado e preservação

- Repositório: `/Users/pedrogulin/Developer/[01.2] PLUGIN FIGMA TO ELEMENTOR__feature_elementor_bridge`; branch `feature/corrigir-css-id-element-id` (criada a partir de `main` em 2026-09-06). **Confirme que está nessa branch** (`git branch --show-current`) antes de editar.
- O working tree deve estar limpo, exceto pela pasta não rastreada `docs/prompts/`. Se `git status --short` mostrar outra coisa, pare e reporte.
- Não faça commit, push, reset, checkout, clean ou stash.

## Fora de escopo absoluto

- Trocar `css_id` por `_element_id` — os dois devem coexistir.
- Mexer em `src/styles/elementor-selectors.js`, na extração de efeitos avançados, ou em qualquer lógica que já consome `css_id` internamente — elas continuam usando `css_id`, sem mudança.
- Adicionar validação obrigatória de `_element_id` em `validateElement`/`validateElementorDocument`.
- Investigar os achados #3 e #4 da auditoria (texto branco sem fundo, container de 7565px) — são tarefas separadas.
- Fazer commit, push, reset, checkout, clean ou stash.

## Validação obrigatória

```bash
npm run check
git diff --check
```

Hoje são 65 testes; deve continuar tudo passando mais as novas asserções/testes.

## Entrega

Escreva um relatório completo em `docs/relatorios/10-corrigir-css-id-vs-element-id.md` (diffs, testes novos, resultado exato de `npm run check`). Depois responda no chat **só** com este formato:

```
Feature 10 concluída sem commit ou push.

- <o que foi implementado, 1 linha>
- Testes: X arquivos, Y testes aprovados; typecheck/build/format [status]
- Lint: [status]

Relatório: <caminho completo do arquivo>
```

Pare após isso — não commite.
