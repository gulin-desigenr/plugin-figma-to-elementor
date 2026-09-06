# Correção 04 — validação de mídia bloqueia o passo de preparo, antes do upload existir

**Modelo recomendado:** o modelo mais capaz disponível no Antigravity (ex.: Gemini 3 Pro ou equivalente), esforço/thinking alto.
**Natureza:** correção de regressão urgente — a extensão Chrome ficou inutilizável para qualquer frame com imagem. Pedro reportou isso ao vivo: ao tentar exportar, o passo de "preparar JSON" (antes de qualquer upload) já falha com `content[...].settings.image deve conter id e url nativos.` em praticamente todo elemento com imagem/background do documento.

## Causa raiz confirmada

O fluxo em `extension/popup.js` valida o documento Elementor **duas vezes**:

1. **Linha ~165**, logo após `buildElementorDocument(root, mode, pluginId)`, antes de qualquer upload para o WordPress. Nesse ponto, `bindElementAssets` (`extension/src/elementor.js:98-113`) já preencheu `settings.image`/`settings.background_image` com o placeholder `nativeImage()` (`extension/src/elementor.js:47-49`, `{ id: "", url: "", size: "full" }`) — de propósito, porque o upload real só acontece depois, quando o usuário clica em "inserir no Elementor".
2. **Linha ~362**, dentro de `insertIntoElementor`, já depois de `patchElementorAssets` ter substituído os placeholders pelos `id`/`url` reais retornados pelo WordPress. Esse é o ponto correto para uma checagem estrita.

A correção anterior (`docs/prompts/01-correcao-validacao-media-nativa.md`, commit `f0502db`) tornou `validateNativeMedia` em `extension/src/contract.js` estrita — passou a exigir `id`/`url` truthy — para impedir que um upload que falhou fosse salvo silenciosamente como imagem nativa vazia. Isso estava certo para a chamada (2), mas ninguém percebeu que a mesma função também é usada pela chamada (1), que roda sobre um documento que **ainda não tem** mídia real por design. Resultado: todo export com imagem passou a falhar imediatamente no passo de preparo, antes mesmo de chegar perto do WordPress.

## Objetivo

Fazer `validateNativeMedia` aceitar um modo relaxado (sem exigir `id`/`url` truthy) para a validação de preparo, mantendo a validação estrita (id/url truthy obrigatórios) para a validação final antes de salvar no Elementor. Nenhuma outra regra de validação muda.

## Estado e preservação

- Repositório: `/Users/pedrogulin/Library/Mobile Documents/com~apple~CloudDocs/PEDRO_DEV/[01.2] PLUGIN FIGMA TO ELEMENTOR__feature_elementor_bridge`; branch `agent/figmentor-audit-baseline`.
- **Importante:** o working tree já está sujo com uma passada de ESLint/Prettier aplicada em quase todo o repositório (aguardando revisão e commit por outra pessoa — não é sua). Isso inclui `extension/src/contract.js`, `extension/popup.js`, `tests/extension.test.js` e outros arquivos que você vai tocar. **Trabalhe em cima do estado atual do working tree, não tente reverter ou "limpar" essa formatação.** Ao editar essas funções, siga o estilo de formatação que já está no arquivo (linha larga até 100 colunas conforme `.prettierrc.json`, que já existe na raiz).
- Também há uma pasta não rastreada `docs/prompts/` (arquivos de gestão do projeto) — ignore-a e não a apague.
- Não faça commit, push, reset, checkout, clean ou stash. A revisão e o commit são feitos por outra pessoa depois.

## Alterações permitidas

**1. `extension/src/contract.js`:**

- `validateNativeMedia(value, path, errors)` → adicionar um quarto parâmetro `options = {}` com uma opção `requireNativeMedia` (default `true` quando omitida). Quando `options.requireNativeMedia` for `false`, pule apenas a checagem de `id`/`url` truthy (linhas ~46-53) — mantenha as duas checagens estruturais que já existem (`isPlainObject(value)` e `containsAssetRef(value)`), porque essas continuam válidas mesmo antes do upload (o objeto ainda deve ter o formato certo e nunca deve conter `assetRef` do Figmentor vazando pro settings nativo).
- `validateElement(element, path, errors, warnings, seenIds, seenCssIds)` → adicionar um sexto parâmetro `options = {}` e repassá-lo para as duas chamadas de `validateNativeMedia` (settings.image e settings.background_image, linhas ~269-276) e para a chamada recursiva em `element.elements.forEach` (linha ~256). Não precisa repassar para `validateNativeIcon` — ícones já chegam com valor final (fallback FontAwesome) na etapa de preparo, não têm esse problema de placeholder.
- `validateElementorDocument(document, mode = ..., options = {})` → aceitar esse terceiro parâmetro e repassá-lo em todas as chamadas de `validateElement` (dentro do `document.content.forEach`, linha ~348-350). Manter o comportamento atual (estrito) quando `options` não for passado — ou seja, `requireNativeMedia` deve valer `true` por padrão em qualquer chamada existente que não passe options.

**2. `extension/popup.js`:**

- Na função que prepara o JSON (linha ~165, a chamada `validateElementorDocument(document, mode)` logo após `buildElementorDocument`), passar `{ requireNativeMedia: false }` como terceiro argumento. É a única chamada que muda.
- A chamada em `insertIntoElementor` (linha ~362, a validação final depois de `patchElementorAssets`) **não muda** — continua sem esse terceiro argumento, ou seja, continua estrita.

**3. `extension/src/wordpress.js`:** as duas chamadas a `validateElementorDocument` aqui (`buildElementorSavePayload` e `insertElementorDocument`) rodam sempre sobre o documento já com mídia real (pós-patch) — **não mudar**, devem continuar estritas por padrão.

**4. `tests/extension.test.js`:**

- O teste existente `'semantic validation rejects empty native media before Elementor save'` (linha ~627) **não deve mudar** — ele chama `validateElementorDocument(invalidImage, "page")` sem terceiro argumento e deve continuar rejeitando (comportamento padrão continua estrito).
- Adicionar um novo teste ao lado desse, provando o caso relaxado: um documento com `settings.image = { id: "", url: "", size: "full" }` (o placeholder real que `nativeImage()` produz) deve passar (`valid === true`, sem a mensagem "deve conter id e url nativos") quando chamado como `validateElementorDocument(document, "page", { requireNativeMedia: false })`. Cubra tanto `settings.image` quanto `settings.background_image`, no mesmo padrão dos dois casos already existentes no teste ao lado.
- Se algum outro teste no arquivo montar um documento com placeholder de imagem vazio e chamar `validateElementorDocument` esperando sucesso (verifique especialmente os testes que giram em torno do fluxo de `buildElementorDocument`/preparo, antes de qualquer upload), atualize a chamada para passar `{ requireNativeMedia: false }` — mas só se o teste realmente representar a etapa de preparo (antes do upload). Não relaxe nenhum teste que representa a etapa final (pós-`patchElementorAssets`).

**5. `CHANGELOG.md`:** adicionar uma linha em `### Fixed` sob `[Unreleased]` descrevendo a correção (a validação estrita de mídia nativa introduzida em `f0502db` bloqueava indevidamente o passo de preparo do JSON, antes do upload existir; agora esse passo usa uma checagem relaxada e a validação final continua estrita).

Nenhum outro arquivo deve ser tocado. Nenhuma outra regra de validação deve mudar.

## Fora de escopo absoluto

- Reverter ou alterar o comportamento estrito da validação final (pós-upload) — essa continua sendo a proteção contra salvar imagem vazia no Elementor, é o que a correção 01 resolveu e deve continuar valendo.
- Mexer em `handleManualTag`, `traverse.js`, `handlers.js`, ou qualquer arquivo de `src/` além de ler para entender o fluxo, se precisar.
- Tocar na formatação/lint já aplicada em arquivos que você não está editando por este prompt.
- Rodar ou testar contra um WordPress/Figma real.
- Fazer commit, push, reset, checkout, clean ou stash.

## Validação obrigatória

Rode, a partir da raiz do repositório:

```bash
npm run check
git diff --check
```

`npm run check` builda plugin + extensão e roda a suíte inteira. Hoje são 48 testes; deve continuar tudo passando mais o(s) novo(s) teste(s) que você adicionar.

## Entrega

Ao final, responda com: os arquivos alterados, o diff das três funções em `contract.js` (`validateNativeMedia`, `validateElement`, `validateElementorDocument`), o diff da linha alterada em `popup.js`, os novos testes adicionados, e o resultado exato de `npm run check` (contagem de testes passando). Pare após isso — não commite.
