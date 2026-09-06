# Correção 01 — validação de mídia nativa aceita upload falho

**Modelo recomendado:** o modelo mais capaz disponível no Antigravity (ex.: Gemini 3 Pro ou equivalente), esforço/thinking alto.
**Natureza:** correção estreita e isolada, achado crítico #2 da auditoria de 2026-09-02 (`docs/auditoria-exportador/` e artefato "Raio-X do Figmentor").

## Objetivo

Corrigir exclusivamente uma falha de validação em `extension/src/contract.js`: a função `validateNativeMedia` aceita `id`/`url` vazios (`""`), enquanto a função irmã `validateNativeIcon` já rejeita corretamente o mesmo cenário para ícones. Isso permite que um asset de imagem que falhou no upload para o WordPress (que hoje chega como `{ id: "", url: "" }`, produzido por `extension/src/elementor.js`) passe pela validação estrutural e semântica e seja salvo no Elementor como se fosse uma imagem nativa válida — vazia, sem aviso.

Faça a validação de `settings.image` e `settings.background_image` exigir `id` e `url` **truthy** (não vazios), da mesma forma que `validateNativeIcon` já exige `value.value.id`/`value.value.url` truthy para SVG.

Não altere o comportamento de `validateNativeIcon`, nem qualquer outra validação em `contract.js` (custom_css, assetRef, icon_list, css_id, colisão de ids, contrato de mode/envelope). Não altere `extension/src/elementor.js` nem a lógica de upload/relatório de assets — a correção é só na validação.

## Estado e preservação

- Repositório: `/Users/pedrogulin/Library/Mobile Documents/com~apple~CloudDocs/PEDRO_DEV/[01.2] PLUGIN FIGMA TO ELEMENTOR__feature_elementor_bridge`; branch `agent/figmentor-audit-baseline`; base `5ad16a33b4cf0fe9c1ac0a6ff5b713f93c42ae9b`.
- O working tree está limpo nesse commit (`git status --short` não deve mostrar nada antes de você começar). Se mostrar algo, pare e reporte — não é seu.
- Não faça commit, push, reset, checkout, clean ou stash. A revisão e o commit são feitos por outra pessoa depois.

## Alterações permitidas

- `extension/src/contract.js`: em `validateNativeMedia` (linhas ~40-49), trocar a checagem de tipo por uma que também exija `value.id` e `value.url` truthy — mensagem de erro pode seguir o padrão já usado (`"${path} deve conter id e url nativos."`).
- `tests/extension.test.js`: adicionar um teste de regressão que prove que um `settings.image` ou `settings.background_image` com `{ id: "", url: "" }` é rejeitado por `validateElementorDocument`. Use como referência o teste já existente `'semantic validation rejects empty SVG icons before Elementor save'` (mesmo arquivo) para o padrão de asserção — a mensagem de erro esperada deve mencionar `id e url nativos`.
- `CHANGELOG.md`: adicionar uma linha em `### Fixed` sob `[Unreleased]` descrevendo a correção, no mesmo estilo das entradas já existentes sobre o `icon-list`.

Nenhum outro arquivo deve ser tocado.

## Fora de escopo absoluto

- Qualquer refatoração de `handleManualTag`, `elementor.js`, `wordpress.js`, `figma-api.js` ou qualquer outro achado da auditoria — cada um terá seu próprio prompt.
- Alterar `package.json`, `manifest.json`, versionamento ou licença.
- Criar workspaces, mover arquivos de pasta, ou tocar em `src/` (motor do plugin Figma).
- Rodar ou testar contra um WordPress/Figma real.

## Validação obrigatória

Rode, a partir da raiz do repositório:

```bash
npm run check
git status --short
git diff --check
```

`npm run check` builda plugin + extensão e roda a suíte inteira (`node --test`) — hoje são 47 testes, todos devem continuar passando, mais o novo teste de regressão (48 no total).

## Entrega

Ao final, responda com: os arquivos alterados, o diff da função `validateNativeMedia`, o resultado exato de `npm run check` (contagem de testes passando), e confirmação de que nenhum outro arquivo foi tocado. Pare após isso — não commite.
