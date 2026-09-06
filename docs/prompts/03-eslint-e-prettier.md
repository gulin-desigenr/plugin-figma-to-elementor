# Tarefa 03 — ESLint e Prettier

**Modelo recomendado:** o modelo mais capaz disponível no Antigravity (ex.: Gemini 3 Pro ou equivalente), esforço/thinking alto.
**Natureza:** ferramental novo + normalização de estilo, achado médio #9 da auditoria de 2026-09-02 ("zero ferramenta automatizada de qualidade de código").

## Objetivo

Este projeto tem ~4.300 linhas de JavaScript em dois runtimes (`src/` = plugin Figma, `extension/` = extensão Chrome) sem nenhum lint ou formatador automático. Isso já causou uma inconsistência real e medida: o código de aplicação (`src/`, `extension/src/`) usa aspas duplas em 854 ocorrências contra 83 de aspas simples; os testes (`tests/`) fazem o oposto, 417 aspas simples contra 89 duplas.

Adicionar ESLint (regras mínimas de correção) e Prettier (formatação, com aspas duplas como padrão do projeto — é o estilo majoritário) e aplicar em todo o código JavaScript existente.

## Estado e preservação

- Repositório: `/Users/pedrogulin/Library/Mobile Documents/com~apple~CloudDocs/PEDRO_DEV/[01.2] PLUGIN FIGMA TO ELEMENTOR__feature_elementor_bridge`; branch `agent/figmentor-audit-baseline`; base `65098d2c78dbf3771c112c0d214244c677be055d`.
- O working tree deve estar limpo nesse commit, exceto por uma pasta não rastreada `docs/prompts/` (arquivos de gestão do projeto, ignore-a e não a apague).
- Não faça commit, push, reset, checkout, clean ou stash.

## Alterações permitidas

**1. Instalar como devDependencies** (via `npm install --save-dev`, atualizando `package.json` e `package-lock.json`):
- `eslint` (^9.x)
- `@eslint/js` (^9.x)
- `globals` (^15.x)
- `eslint-config-prettier` (^9.x)
- `prettier` (^3.x)

**2. Criar `eslint.config.js`** na raiz (flat config, é ESM porque `package.json` já tem `"type": "module"`), com esta estrutura:
- Base: `js.configs.recommended` (de `@eslint/js`).
- `eslint-config-prettier` por último no array, pra desligar qualquer regra de estilo que conflite com o Prettier.
- Ignorar: `node_modules/`, `dist/`, `extension/dist/`, `coverage/`.
- Globals customizados por escopo de arquivo:
  - `src/**/*.js`: globals do navegador padrão (`...globals.browser`) mais um global customizado `figma: "readonly"` (é a API global injetada pelo runtime do plugin Figma, não existe em nenhum conjunto padrão).
  - `extension/**/*.js` (exceto `extension/dist/**`): `...globals.browser` mais `chrome: "readonly"` (API do Manifest V3).
  - `tests/**/*.js`: `...globals.node`.
- Regras (somente estas, não adicione outras por conta própria — é proposital manter o conjunto mínimo nesta primeira rodada):
  - `"no-unused-vars": "error"`
  - `"no-undef": "error"`
  - `"prefer-const": "error"`
  - `"no-var": "error"`
  - `"eqeqeq": ["error", "always"]`

**3. Criar `.prettierrc.json`** na raiz:
```json
{
  "singleQuote": false,
  "semi": true,
  "trailingComma": "none",
  "printWidth": 100
}
```

**4. Criar `.prettierignore`** na raiz:
```
node_modules
dist
extension/dist
coverage
*.md
```

**5. Adicionar scripts em `package.json`** (mantenha os scripts existentes intactos, só adicione):
```json
"lint": "eslint .",
"format": "prettier --write \"src/**/*.js\" \"extension/**/*.js\" \"!extension/dist/**\" \"tests/**/*.js\" \"*.js\""
```

**6. Rodar `npm run lint -- --fix` e depois `npm run format`** para aplicar automaticamente as correções e a formatação em todo `src/`, `extension/` (exceto `extension/dist/`) e `tests/`.

**7. Corrigir manualmente qualquer violação de `no-unused-vars` ou `no-undef` que o `--fix` não resolver sozinho** (esses dois nunca são autofixáveis). Se encontrar uma variável genuinamente não usada, remova-a. Se encontrar algo que parece não usado mas você não tiver certeza do motivo (ex.: pode ser intencional), **não remova** — liste no relatório final em vez de decidir sozinho.

Nenhuma mudança de lógica/comportamento é esperada — isso é só lint + formatação. Se o `--fix` automático mudar comportamento em algum arquivo (o que não deveria acontecer com essas regras), reverta aquele arquivo específico e reporte.

## Fora de escopo absoluto

- Não mexer em `.github/workflows/ci.yml` (adicionar lint ao CI é uma tarefa separada, futura).
- Não adicionar TypeScript, JSDoc typecheck, ou qualquer regra de estilo além das 5 listadas acima.
- Não rodar Prettier em arquivos `.md`, `.json`, `.html` — só `.js`.
- Não tocar em `dist/code.js` nem `extension/dist/popup.js` diretamente (se `npm run check` os regenerar como efeito colateral do build, tudo bem, mas não os edite manualmente).
- Não alterar nenhuma lógica de negócio para "resolver" um lint warning — se uma regra pegar algo que exige mudança de comportamento pra corrigir de verdade, pare e reporte em vez de decidir sozinho.

## Validação obrigatória

Rode, a partir da raiz do repositório:

```bash
npm run lint
npm run check
git status --short
git diff --check
```

`npm run lint` deve terminar sem erros. `npm run check` deve continuar mostrando 48 testes passando.

## Entrega

Ao final, responda com: a lista de arquivos alterados, quantas ocorrências o `--fix` corrigiu automaticamente, qualquer violação que precisou de correção manual (com justificativa) ou que ficou pendente por incerteza, e o resultado exato de `npm run lint` e `npm run check`. Pare após isso — não commite.
