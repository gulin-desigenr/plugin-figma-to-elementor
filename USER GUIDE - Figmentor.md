---
tags:
  - documentação
  - figmentor
---

# 1. VISÃO GERAL DO PLUGIN

O Figmentor é um plugin nativo do Figma desenhado para analisar a Abstract Syntax Tree (AST) de layouts construídos com Auto Layout (ou layouts livres com inteligência espacial) e convertê-los em templates JSON estritamente compatíveis com a estrutura de dados proprietária do construtor de páginas Elementor (v0.4 Schema). O motor utiliza um sistema de "Manual Tagging" via `getPluginData` e `setPluginData` para mapear nós do Figma para chaves de widgets e containers do Elementor.

O problema principal resolvido é o overhead técnico de recriar estruturas Flexbox (DOM) e transcrever propriedades CSS estruturais e tipográficas do design para o Elementor. A promessa central do produto passa a ser a traducao estrutural do layout, nao a reproducao completa de midia ou iconografia.

**O que o plugin NAO faz:** Ele nao realiza upload de assets digitais reais (imagens, SVGs, videos) e nao trata icones como parte do fluxo principal. Midias e iconografia devem ser aplicadas manualmente no Elementor.

**Stack Técnica:**
- Linguagem: Vanilla JavaScript (ES6+), HTML, CSS.
- API: Figma Plugin API.
- Output: JSON estático (`application/json`).
- Ambiente: Offline-first (executa localmente no Figma).

## 2. ARQUITETURA E FUNCIONAMENTO INTERNO

A arquitetura do Figmentor baseia-se em um percurso recursivo profundo na árvore de nós (`traverseNode`).

**Pipeline de Processamento:**
1. **Verificação de Tag Manual:** O algoritmo checa se o usuário rotulou o nó com uma tag específica (`elementor-tag`), invocando a `handleManualTag` que processa nós complexos agregando os filhos.
2. **Identificação Automática:** Se nao ha tag manual, verifica se e um no de Texto puro (`mapText`) e aplica fallbacks estruturais controlados.
3. **Extração de CSS e Geometria:** Funções dedicadas extraem Typography, Backgrounds, Borders, e Shadows.
4. **Inteligência Espacial e Auto Layout:** Para containers, o `getLayoutDirection` identifica propriedades de Flexbox e gap nativas do Figma. Caso o grupo não possua Auto Layout, um fallback heurístico analisa a variação no eixo Y para inferir se o comportamento esperado é `row` ou `column`.
5. **Flattening Estrutural:** Nós do tipo `FRAME` sem layoutMode e que não são a raiz da seleção não geram um nível no JSON (suprimindo a div), apenas repassam seus filhos para otimização da árvore DOM resultante no Elementor.

**Diagrama de Fluxo de Dados:**

```text
[Figma Document]
  ├── Node Selection
  │    └── UI: postMessage({ type: 'apply-tag' }) -> node.setPluginData()
  │
  ├── Export Trigger
  │    └── src/core/traverse.js: traverseNode(selection[0], isRoot=true)
  │         ├── Fallback: mapText / mapImage 
  │         ├── Tag Check: handleManualTag
  │         ├── CSS Extractor: Background, Borders, Shadows, Typography
  │         ├── Spatial Intel: getLayoutDirection
  │         └── Map to Elementor Schema (mapContainer / mapWidget)
  │
[JSON Compilation]
  └── Export V0.4 Object -> Blob Generation -> elementor-template-[timestamp].json
```

## 3. INSTALAÇÃO E CONFIGURAÇÃO

### 3.1 Pré-requisitos
- Figma Desktop App ou versão Web suportada.
- Acesso de edição ao design (necessário para injezir `PluginData`).
- Elementor com o recurso Flexbox Container ativo para importar o JSON gerado.

### 3.2 Instalação local
1. Clone o repositório contendo `manifest.json`, `dist/code.js` e `ui.html`.
2. Abra o Figma Desktop App.
3. Navegue até **Plugins > Development > Import plugin from manifest...**
4. Selecione o `manifest.json`.

### 3.3 Configurações Embutidas (Hardcoded)
Para maximizar a compatibilidade de parsing do Elementor, o código adota padrões seguros consolidados:
- **Largura do Root (Boxed):** Limitado artificialmente a `1140px` (padrão desktop).
- **Fallback de Fonte:** Configurado para `16px` e peso `400` caso a consulta original resulte em `figma.mixed`.
- **Mapeamento de Peso Numérico:** Dicionário regex-based (`mapFontWeight`) traduz variantes nominais ("Demi Bold", "Hairline") em peso numérico real (600, 100).

## 4. FLUXO DE USO COMPLETO

### 4.1 Exportar Múltiplos Componentes / Layout de Página
1. Selecione o `Frame` pai de todo o layout. Aplique a tag `Seção (1140px Boxed)`.
2. Selecione containers internos de layout e rotule-os como `Container Filho (100% Full)`.
3. Assinale blocos semânticos aplicando as respecticas tags (`heading`, `image-box`, `icon-list`, etc).
4. Verifique elementos não rotulados: nós de puro texto e blocos com inserção de imagem são processados automaticamente como fallback se visíveis.
5. Selecione novamente apenas o *Pai* da estrutura.
6. Clique em **GERAR E BAIXAR JSON**.
7. No painel de importação do Elementor, envie o arquivo exportado.

### 4.2 Restricao deliberada de midia e iconografia
1. Imagens, SVGs, mockups, texturas e icones nao fazem parte do fluxo estrutural principal do Figmentor.
2. O JSON exportado deve ser entendido como base estrutural do layout.
3. O upload e a escolha final de imagens e icones acontecem manualmente no Elementor.
4. O JSON deve priorizar spacing, tipografia, cores, dimensoes e hierarquia estrutural.

## 5. MAPEAMENTO DE ELEMENTOS E TAGS (FIGMA → ELEMENTOR)

| Elemento/Tag Figma | Widget/Elemento Elementor | Estrutura de Chaves Injetadas (Settings) | Limitações Atuais |
|---|---|---|---|
| `container` | `container` | `content_width: "boxed"`, width: `{ size: 1140 }` | Recomendado apenas em Root. |
| `container-full` | `container` | `content_width: "full"`, width: `{ size: 100, unit: "%" }` | Herda paddings e layout-direction. |
| `heading` | `heading` | `title`, `title_color`, `typography_typography: "custom"` | Lê todos os caracteres de texto subjacentes. |
| `text-editor` | `text-editor` | `editor`, `text_color` | Une múltiplos nós `<br>`. Fallback para textos < 32px. |
| `image-box` | `image-box` | `title_text`, `description_text`, tipografias | Uso legado. Nao faz parte do fluxo estrutural recomendado. |
| `icon-list` | `icon-list` | `icon_list` (Array of objects com texto individualizados) | Uso legado. Iconografia fica fora do fluxo principal. |
| `image` | `image` | `image: { url: "", id: "" }`, `_width` | Uso legado. Midia deve ser aplicada manualmente depois. |

*Widgets fora do escopo principal:* `image`, `image-box`, `icon-list`, `icon-box`, `image-carousel` e fluxos dependentes de iconografia ou assets reais.

## 6. COMPORTAMENTO DE ESTILOS E PARSING

- **Cores (Fills):** Rotina `extractTextStyle` analisa `node.fills[0]`. Converte RGB para um rgba() compátivel. O sistema reporta falha caso a cor esteja segmentada de maneira mista (`figma.mixed`).
- **Backgrounds:** `extractBackground` checa shapes no container pai. Injeta `background_background: "classic"` ativando a propriedade nativa do Control System do Elementor. O foco aqui e background estrutural nativo, nao upload de imagem.
- **Tipografia:** Captura `fontSize` e injeta flag forçada `typography_typography: "custom"`. Retorna para o standard de `16px/400` se houver colisão de estilos mistos no nó.
- **Geometria / Espaçamento:** Extração literal de `paddingTop` e similares via objeto iterável de dimensões no JSON. Se detectado Figma AutoLayout, recupera a propriedade `itemSpacing` e aplica nos eixos (`gap.column/row`).
- **Borders & Radius [NOVO]:** A função `extractBorders` mapeia pesos nativos de traço (`strokeWeight`), cor de preenchimento (`rgba`) e arredondamento individual com suporte à detecção customizada das 4 pontas ou formato redondo integral, acoplando as strings `"solid"` apropriadas.
- **Sombras Analíticas [NOVO]:** A função `extractShadows` interpreta instâncias `DROP_SHADOW` válidas aplicando um switch com eixos X/Y (`horizontal`/`vertical`), raio (`blur`), expansão (`spread`) e transparência de overlay no `box_shadow`.

## 7. RESOLUÇÃO DE PROBLEMAS COMUNS (TROUBLESHOOTING)

- **Sintoma:** O layout no Elementor expande a 100% da viewport, perdendo o alinhamento central em navegadores ultrawide.
  - **Causa:** O nó raiz (Root) não estava tagueado como `container` ou a seleção no momento da exportação foi feita nos filhos, perdendo as diretivas `boxed` centrais.

- **Sintoma:** Painel lateral de edição do Elementor não carrega, UI quebrada (tela em branco de load infinito).
  - **Causa/Solução:** JSON construiu Control IDs errados (Geralmente marcando elementos heterogêneos muito extensos unicamente como "text-editor").

- **Sintoma:** Propriedades de texto não herdam mudanças, mostrando `figma.mixed` ao invés de código real, revertendo para Fonte padrão cinza.
  - **Solução:** O script não desmembra texto multi-estilo no mesmo layer nativo. Você precisa desdobrar elementos fracionados em novos nós separados de textos agrupados.

## 8. ROADMAP DE DESENVOLVIMENTO

Consulte o arquivo `README.md` para as etapas futuras macro do projeto.

**Foco em Correcao e evolucao estrutural (WIP):**
- Refinar a paridade de spacing, sizing e tipografia entre Auto Layout e Elementor.
- Melhorar a fidelidade estrutural de containers, wrappers e hierarquia de blocos.
- Reforcar o fluxo entre exportador e upload manual do JSON.
- Manter midia e iconografia fora da promessa central do produto.
