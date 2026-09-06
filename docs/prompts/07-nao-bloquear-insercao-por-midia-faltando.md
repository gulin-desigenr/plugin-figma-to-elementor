# Correção 07 — imagem nativa faltando vira aviso, não bloqueio, no salvamento final

**Modelo recomendado:** o modelo mais capaz disponível no Antigravity (ex.: Gemini 3 Pro ou equivalente), esforço/thinking alto.
**Natureza:** mudança de política de produto, decidida com o Pedro em 2026-09-06, depois do incidente das correções 04-06.

## Contexto e objetivo

Depois do incidente desta semana (uma imagem que não é descoberta/enviada bloqueava o salvamento do documento inteiro no Elementor), Pedro pediu uma regra permanente: **nenhuma feature futura deve travar o processo por completo**. Discutimos e chegamos numa política específica:

- Se uma ou mais imagens **nativas** (settings `image`/`background_image`) ficarem sem `id`/`url` reais no momento de salvar no Elementor (porque não foram descobertas, ou porque o upload falhou mesmo depois do retry), isso **não deve mais impedir o salvamento do resto do documento**. A extensão deve salvar o rascunho normalmente, com esses widgets específicos ficando com o placeholder vazio do próprio Elementor (que o usuário edita manualmente depois), e **avisar claramente** quais elementos ficaram assim.
- Erros que indicam o **documento inteiro malformado** (JSON com estrutura inválida, `widgetType` não suportado, elemento sem `id`/`settings`, IDs ou `css_id` duplicados, `assetRef` vazando pro campo nativo, `custom_css` inválido, etc.) **continuam bloqueando** — esses são sinais de bug real no motor, não "uma peça faltando", e travar aqui continua sendo a proteção correta.

Ou seja: a validação continua existindo e continua rodando sobre tudo, só muda **onde** a mensagem de "imagem nativa faltando" vai parar — de `errors` (bloqueia) para `warnings` (avisa e segue).

## Estado e preservação

- Repositório: `/Users/pedrogulin/Developer/[01.2] PLUGIN FIGMA TO ELEMENTOR__feature_elementor_bridge`; branch `feature/nao-bloquear-por-midia-faltando` (criada a partir de `main` em 2026-09-06 — primeira feature no novo fluxo por branches; `main` é a branch principal, `agent/figmentor-audit-baseline` não é mais usada). **Confirme que você está nessa branch antes de editar** (`git branch --show-current`); se não estiver, faça `git checkout feature/nao-bloquear-por-midia-faltando` antes de começar.
- O working tree deve estar limpo neste momento, exceto pela pasta não rastreada `docs/prompts/`. Se `git status --short` mostrar qualquer outra coisa além disso, pare e reporte — não é seu.
- Não faça commit, push, reset, checkout, clean ou stash. A revisão e o commit são feitos por outra pessoa depois.

## Alterações permitidas

### 1. `extension/src/contract.js`

**`validateNativeMedia`** — adicionar um parâmetro `warnings` e usar a opção `treatMissingMediaAsWarning` pra decidir em qual array a mensagem de "id e url nativos" cai:

```js
function validateNativeMedia(value, path, errors, warnings, options = {}) {
  if (!isPlainObject(value)) {
    errors.push(`${path} deve ser um objeto de mídia nativo do Elementor.`);
    return;
  }
  if (containsAssetRef(value)) errors.push(`${path} não pode conter assetRef do Figmentor.`);
  const { requireNativeMedia = true, treatMissingMediaAsWarning = false } = options;
  const missingNativeMedia = !(
    value.url &&
    value.id &&
    typeof value.url === "string" &&
    (typeof value.id === "string" || typeof value.id === "number")
  );
  if (requireNativeMedia && missingNativeMedia) {
    const message = `${path} deve conter id e url nativos.`;
    if (treatMissingMediaAsWarning) warnings.push(message);
    else errors.push(message);
  }
}
```

Note que o `containsAssetRef` continua indo pra `errors` sempre — isso é um erro estrutural (metadado do Figmentor vazando pro campo nativo), não "imagem faltando", e deve continuar bloqueando independente da opção.

**`validateElement`** — nas duas chamadas de `validateNativeMedia` (settings.image e settings.background_image), passar o `warnings` que a função já recebe como parâmetro:

```js
if (element.settings.image !== undefined)
  validateNativeMedia(element.settings.image, `${path}.settings.image`, errors, warnings, options);
if (element.settings.background_image !== undefined)
  validateNativeMedia(
    element.settings.background_image,
    `${path}.settings.background_image`,
    errors,
    warnings,
    options
  );
```

`validateElementorDocument` já repassa `options` e `warnings` corretamente pra `validateElement` — não precisa mudar a assinatura dela.

### 2. `extension/src/wordpress.js`

Duas funções aqui também chamam `validateElementorDocument` sem repassar `options` — precisam de um parâmetro novo pra não neutralizar a mudança acima:

**`buildElementorSavePayload`** — adicionar um quinto parâmetro `options = {}`:
```js
export function buildElementorSavePayload(
  document,
  existingElements = [],
  mode = "page",
  existingSettings = {},
  options = {}
) {
  const schemaMode = document?.type === "page" ? "page" : "section";
  const validation = validateElementorDocument(document, schemaMode, options);
  ...
```

**`insertElementorDocument`** — adicionar um quinto parâmetro `options = {}`, repassar pra sua própria validação E pra chamada de `buildElementorSavePayload`:
```js
export async function insertElementorDocument(tabId, context, document, mode = "page", options = {}) {
  validateWordPressContext(context);
  const schemaMode = document?.type === "page" ? "page" : "section";
  const validation = validateElementorDocument(document, schemaMode, options);
  if (!validation.valid) {
    throw new Error(
      `O JSON final não pode ser enviado ao Elementor:\n${validation.errors.join("\n")}`
    );
  }

  const draftResult = await ensureWordPressDraft(tabId, context);
  context = { ...context, postStatus: draftResult.status };
  const before = await readElementorDocument(tabId, context);
  const payload = buildElementorSavePayload(document, before.elements, mode, before.settings, options);
  ...
```

Sem essa mudança nas duas funções, a opção `treatMissingMediaAsWarning` passada em `popup.js` seria anulada por essas duas validações internas, que continuariam bloqueando com o comportamento estrito padrão.

### 3. `extension/popup.js`

Na função `insertIntoElementor`, dois pontos:

**A validação logo após o patch** (hoje ~linha 362-370) passa a usar a opção:
```js
const validation = validateElementorDocument(
  patchedDocument,
  patchedDocument.type === "page" ? "page" : "section",
  { treatMissingMediaAsWarning: true }
);
if (!validation.valid) {
  throw new Error(
    `O JSON final não passou na validação do Elementor:\n${validation.errors.join("\n")}`
  );
}
```
(Continua bloqueando se `validation.valid` for `false` — isso só acontece agora por erro estrutural real, já que mídia faltando virou warning.)

**A chamada de `insertElementorDocument`** (hoje ~linha 371-376) precisa repassar a mesma opção como quinto argumento:
```js
const result = await insertElementorDocument(
  workflow.wordpress.tabId,
  workflow.wordpress,
  patchedDocument,
  mode,
  { treatMissingMediaAsWarning: true }
);
```

**O relatório final** (hoje ~linha 398-404, o array que vira `$("upload-report").textContent`) precisa mostrar os avisos quando existirem. Adicionar uma linha antes de "Elementor salvo como rascunho", só quando `validation.warnings.length > 0`:
```js
$("upload-report").textContent = [
  `Assets enviados: ${manifest.assets.filter((asset) => asset.status === "uploaded").length}/${manifest.assets.length}`,
  `Efeitos: ${report.effects.summary.total || 0} mapeado(s), ${report.effects.summary.customCss || 0} em CSS, ${report.effects.summary.flags || 0} flag(s).`,
  ...formatAssetReport(report.assets),
  ...(validation.warnings.length
    ? [`⚠️ ${validation.warnings.length} elemento(s) salvos sem imagem nativa (edite manualmente no Elementor):`, ...validation.warnings]
    : []),
  `Elementor salvo como rascunho (${result.elementCount} elemento(s)).`,
  `Persistência confirmada após recarregar (${reloadResult.verification.elementCount} IDs verificados).`
].join("\n");
```

A validação da etapa de **preparo** (hoje ~linha 165, `{ requireNativeMedia: false }`) não muda — continua igual, esse ponto já não bloqueia por mídia de jeito nenhum.

## Alterações em testes

**`tests/extension.test.js`**:

1. Adicionar um teste provando que a opção funciona como esperado:
```js
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
```

2. Confirmar que o teste existente `'semantic validation rejects empty native media before Elementor save'` continua passando sem alteração (chama `validateElementorDocument` sem essa opção — deve continuar bloqueando por padrão).

3. Os testes que já chamam `buildElementorSavePayload(...)` e `insertElementorDocument(...)` sem o quinto argumento (`tests/extension.test.js` linhas ~1028, ~1071, ~1168) devem continuar passando sem alteração — o novo parâmetro é opcional com default `{}`, que preserva o comportamento estrito atual.

**`CHANGELOG.md`**: adicionar uma linha em `### Fixed` (ou `### Changed`, o que fizer mais sentido) sob `[Unreleased]` descrevendo a mudança de política: imagem nativa faltando não bloqueia mais o salvamento no Elementor, vira aviso reportado ao usuário; erros estruturais continuam bloqueando.

Nenhum outro arquivo deve ser tocado.

## Fora de escopo absoluto

- Mudar qualquer outra regra de validação (widgetType, css_id, custom_css, assetRef, icon, etc.) — essas continuam sempre bloqueando, sem opção de desligar.
- Mexer em `src/` (motor do plugin Figma) — essa mudança é só do lado da extensão Chrome.
- Mudar a etapa de preparo (linha ~165 de `popup.js`) — já não bloqueia por mídia, não precisa de ajuste.
- Rodar ou testar contra um WordPress/Figma real.
- Fazer commit, push, reset, checkout, clean ou stash.

## Validação obrigatória

Rode, a partir da raiz do repositório:

```bash
npm run check
git diff --check
```

`npm run check` builda plugin + extensão e roda a suíte inteira. Hoje são 51 testes; deve continuar tudo passando mais o novo teste (52 no total).

## Entrega

Ao final, responda com: os arquivos alterados, o diff das mudanças em `contract.js`, `wordpress.js` e `popup.js`, o novo teste adicionado, e o resultado exato de `npm run check` (contagem de testes passando). Pare após isso — não commite.
