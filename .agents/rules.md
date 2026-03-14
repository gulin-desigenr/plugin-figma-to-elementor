# Regras de Desenvolvimento — Figmentor Plugin

## Contexto do Projeto

Plugin Figma que converte designs em JSON compatível com Elementor.
Arquitetura simples: `code.js` (backend/lógica) + `ui.html` (frontend/UI) + `manifest.json` (manifesto Figma).

**Versão atual**: 0.4  
**Repositório**: https://github.com/gulin-desigenr/plugin-figma-to-elementor

## Regras de Git

1. **NUNCA** fazer commit direto na `main`
2. Sempre trabalhar em branches `feature/` ou `fix/` criadas a partir de `dev`
3. Mensagens de commit em **português**, prefixadas: `feat:`, `fix:`, `refactor:`, `docs:`, `style:`, `chore:`
4. Antes de qualquer push, garantir que o plugin funciona no Figma
5. Fazer merge para `dev` primeiro. Merge de `dev` → `main` apenas quando estável

## Regras de Código

1. Toda função nova **DEVE** ter JSDoc com `@param` e `@returns`
2. Nomes de variáveis/funções em **inglês**, textos de UI em **português**
3. **Não hardcodear versões** no código — usar `manifest.json` como fonte de verdade
4. Ao adicionar novo widget, **SEMPRE** atualizar ambos os arquivos:
   - `code.js` → handler dentro de `handleManualTag()`
   - `ui.html` → botão na seção correspondente
5. Manter o JSON de export **compatível** com a estrutura Elementor — nunca inventar keys
6. Indentação: **2 espaços**. Ponto-e-vírgula: **obrigatório**

## Arquitetura — Mapa de Funções

### code.js — Fluxo Principal
```
figma.ui.onmessage
├── apply-tag → setPluginData + rename node
└── export-json → traverseNode() → JSON
                    ├── handleManualTag() → widget/container
                    ├── mapText() → heading ou text-editor
                    ├── mapImage() → image widget
                    └── mapContainer() → container element
```

### code.js — Utilitários
- `figmaColorToRGBA()` — converte cor Figma para rgba()
- `mapFontWeight()` — mapeia nome de estilo para peso numérico
- `getLayoutDirection()` — detecta row/column
- `extractBorders()` — extrai bordas e border-radius
- `extractShadows()` — extrai drop shadows
- `extractTextStyle()` — extrai cor, tamanho e peso do texto
- `extractBackground()` — extrai cor de fundo

### ui.html
- Botões de tagging → `applyTag()` → postMessage para code.js
- Botão "GERAR" → postMessage `export-json`
- Listener → recebe JSON, exibe no textarea, faz download automático

## Widgets — Status de Implementação

| Widget | Handler em code.js | Botão em ui.html | Status |
|---|---|---|---|
| `container` | ✅ | ✅ | Completo |
| `container-full` | ✅ | ✅ | Completo |
| `heading` | ✅ | ✅ | Completo |
| `text-editor` | ✅ | ✅ | Completo |
| `image` | ✅ | ✅ | Completo |
| `image-box` | ✅ | ✅ | Completo |
| `icon-list` | ✅ | ✅ | Completo |
| `icon-box` | ❌ | ✅ | **Falta handler** |
| `image-carousel` | ❌ | ✅ | **Falta handler** |
| `container-carousel` | ❌ | ✅ | **Falta handler** |

## Regras de Teste

1. Antes de merge para `dev`, testar com um frame Figma que contenha **todos os tipos de widget suportados**
2. Validar que o JSON exportado importa corretamente no Elementor
3. Testar tanto layouts `HORIZONTAL` quanto `VERTICAL`
4. Testar nós com e sem Auto Layout

## O que NÃO fazer

- ❌ Não instalar dependências npm sem aprovação do Pedro
- ❌ Não alterar `manifest.json` sem discussão
- ❌ Não remover tags existentes da UI sem plano de migração
- ❌ Não usar `git add .` para commits — adicionar arquivos individualmente
- ❌ Não criar arquivos fora da estrutura do projeto
