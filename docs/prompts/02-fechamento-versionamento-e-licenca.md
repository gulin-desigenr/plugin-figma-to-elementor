# Correção 02 — fechamento de versionamento e licença

**Modelo recomendado:** o modelo mais capaz disponível no Antigravity (ex.: Gemini 3 Pro ou equivalente), esforço/thinking alto.
**Natureza:** correção estreita e isolada, achados médios #8 (versionamento) e a contradição de licença da auditoria de 2026-09-02.

## Objetivo

Fechar duas inconsistências puramente administrativas, sem tocar em nenhum comportamento de código:

1. O projeto é **privado** (o README já afirma isso em "## Licença"), mas `package.json` declara `"license": "ISC"` (uma licença de código aberto) e não existe arquivo `LICENSE`. Isso precisa ficar coerente com "privado".
2. A versão está fragmentada sem fonte única: `package.json` está em `1.2.0` (da fase anterior, antes da extensão Chrome existir), `extension/manifest.json` está em `0.2.1`, e o `CHANGELOG.md` mantém toda a Fase 02 (extensão Chrome + motor de efeitos + correções de segurança já commitadas) sob `## [Unreleased]`, mesmo descrita como aprovada em todo o resto da documentação. É hora de fechar essa fase com números de versão reais.

## Estado e preservação

- Repositório: `/Users/pedrogulin/Library/Mobile Documents/com~apple~CloudDocs/PEDRO_DEV/[01.2] PLUGIN FIGMA TO ELEMENTOR__feature_elementor_bridge`; branch `agent/figmentor-audit-baseline`; base `f0502db7a17a3773b306bc8d6beba659a5ecd654`.
- O working tree deve estar limpo nesse commit, exceto por uma pasta não rastreada `docs/prompts/` (arquivos de gestão do projeto, não é código, ignore-a e não a apague).
- Não faça commit, push, reset, checkout, clean ou stash. A revisão e o commit são feitos por outra pessoa depois.

## Alterações permitidas

**1. `package.json`:**
- `"version"`: `"1.2.0"` → `"2.0.0"` (marca a virada de arquitetura para o modelo de dois clientes — plugin Figma + extensão Chrome — como major release).
- `"license"`: `"ISC"` → `"UNLICENSED"` (convenção padrão do npm para pacote proprietário, não publicável).
- `"author"`: `""` → `"Pedro Gulin"`.
- Adicionar `"private": true` (impede publicação acidental no registro npm).

**2. `extension/manifest.json`:**
- `"version"`: `"0.2.1"` → `"1.0.0"` (marca a primeira versão estável aceita da extensão, agora que a Fase 02 está aprovada, commitada e com a validação crítica de mídia corrigida).

**3. Criar `LICENSE` na raiz do repositório**, em português, com este conteúdo exato:

```
Copyright (c) 2026 Pedro Gulin. Todos os direitos reservados.

Este software e a documentação associada são propriedade privada e
confidencial. É proibida a cópia, distribuição, modificação, sublicenciamento
ou uso deste software, por qualquer meio, sem autorização prévia e por
escrito do titular dos direitos.
```

**4. `CHANGELOG.md`:**
- Renomear o cabeçalho `## [Unreleased] — Fase 02 aprovada em 2026-08-03` para `## [2.0.0] - 2026-09-03`, mantendo integralmente todo o conteúdo que já está sob esse cabeçalho (todas as seções `### Fixed`, `### Added`, `### Changed`, `### Validation`, incluindo as duas entradas mais recentes sobre `icon-list` e validação de mídia nativa) — não remova nem reescreva nada do conteúdo, só o cabeçalho.
- Adicionar um novo cabeçalho `## [Unreleased]` vazio, acima desse, seguindo o padrão Keep a Changelog (sem entradas por enquanto — é onde futuras mudanças vão entrar).

**5. `README.md`:**
- Atualizar os três badges no topo (linhas ~7-9) para refletir as novas versões: o badge `plugin-1.2.0-purple` vira `plugin-2.0.0-purple`, e o badge `bridge-0.2.1-blue` vira `bridge-1.0.0-blue`. O badge de fase (`Fase%2002-aprovada-success`) não muda.

Nenhum outro arquivo deve ser tocado. Nenhuma lógica de código (`src/`, `extension/src/`, `extension/popup.js`, etc.) deve mudar.

## Fora de escopo absoluto

- Qualquer mudança de comportamento, refatoração, ou correção de bug — isso é só fechamento administrativo de versão e licença.
- Rebuild de `dist/code.js` ou `extension/dist/popup.js` (essas mudanças não afetam bundle nenhum).
- Mexer em `CONTRIBUTING.md`, `ELEMENTOR_WIDGET_MAPPING.md`, `USER GUIDE - Figmentor.md`, `AUDITORIA_TECNICA_EXPORTACAO.md` ou qualquer arquivo em `docs/`.
- Publicar o pacote no npm ou em qualquer registro.

## Validação obrigatória

Rode, a partir da raiz do repositório:

```bash
npm run check
git status --short
git diff --check
```

`npm run check` deve continuar mostrando 48 testes passando (nenhum teste deveria ser afetado por essa mudança, já que é puramente administrativa).

## Entrega

Ao final, responda com: os arquivos alterados, o conteúdo final de `package.json`, `extension/manifest.json` e `LICENSE`, o trecho renomeado do `CHANGELOG.md`, e o resultado exato de `npm run check`. Pare após isso — não commite.
