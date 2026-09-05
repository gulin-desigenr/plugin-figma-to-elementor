# Auditoria Técnica do Figmentor Bridge

## Objetivo

Auditar o Figmentor como um compilador e um pipeline de persistência: identificar
em qual etapa nasce cada problema e corrigir de forma reproduzível, com fixtures,
JSON esperado, relatório de assets e testes de regressão.

```text
Plugin Figma: tags + pluginData + frame registrado
→ Figma REST API
→ Adapter de nós REST
→ Traversal
→ Interpretação semântica
→ Mapeamento para Elementor
→ Normalização e validação
→ Manifesto e exportação de assets
→ WebP/SVG e WordPress Media
→ JSON Elementor com IDs/URLs reais
→ save_builder como draft
→ Reload e verificação de persistência
```

Esta auditoria deve servir como base para desenvolvimento direcionado, evitando planos genéricos que não estejam ligados a uma divergência concreta.

## Estado após a Fase 02

A arquitetura plugin mínimo + extensão Chrome foi aprovada em 2026-08-03. O
motor de `src/core/` e `src/styles/` é compartilhado entre os dois bundles. O
fluxo integrado salvou um rascunho e confirmou 50 IDs após reload.

O aceite não significa paridade visual total: 8 de 19 assets foram enviados e
11 SVGs foram recusados pelo WordPress; crop, composição e posicionamento de
algumas imagens ainda exigem refinamento. Veja
[`docs/FASE-02-BRIDGE.md`](docs/FASE-02-BRIDGE.md).

## Camadas da auditoria

### 1. Contrato de saída

Para cada tag, definir o resultado esperado:

| Entrada Figma | Saída esperada |
|---|---|
| `container` | `elType: "container"` |
| `heading` | `widgetType: "heading"` |
| `text-editor` | `widgetType: "text-editor"` |
| `button` | `widgetType: "button"` |
| `accordion` | `widgetType: "accordion"` |
| `accordeon` | `widgetType: "nested-accordion"` |

Verificar também a presença e o nível correto de:

```text
elType
widgetType
settings
elements
width
padding
gap
flex_direction
background
typography
border
box_shadow
css_id
```

### 2. Fixtures de entrada

Criar casos controlados que representem estruturas reais do Figma:

- frame vertical simples;
- frame horizontal;
- container com `FILL`;
- container com largura fixa;
- texto grande e texto pequeno;
- texto com estilo misto;
- background sólido e gradiente;
- radius uniforme e independente;
- sombra;
- botão com ícone e reação URL;
- accordion clássico;
- nested accordion;
- elemento `ignore`;
- elemento `image-background`;
- frame sem tag;
- frame com filhos sem tag;
- estruturas com múltiplos níveis;
- seleção vazia ou inválida.

Cada fixture deve registrar:

```text
Entrada Figma simulada
PluginData e tags
JSON esperado
JSON atual
Diferenças encontradas
```

### 3. Invariantes do documento e do JSON

Além de comparar valores, validar regras estruturais:

- nenhum item de `content` pode ser `null`;
- todo widget precisa ter `widgetType`;
- todo elemento precisa ter `settings`;
- todo container precisa ter `elements`;
- nenhum `css_id` pode conter acentos, espaços ou caracteres inválidos;
- nenhum campo obrigatório pode ser `undefined`;
- propriedades removidas pela sanitização precisam estar justificadas.
- `image`, `background_image` e itens de `carousel` precisam usar `id`/`url`
  nativos do WordPress;
- `selected_icon` precisa distinguir Font Awesome de biblioteca `svg`;
- `assetRef` não pode ser misturado a campos nativos do Elementor;
- IDs de elementos e mídias esperados precisam existir após o reload;
- a resposta do servidor precisa confirmar `draft`.

### 4. Auditoria do traversal

Arquivo principal: `src/core/traverse.js`.

Perguntas:

- nós invisíveis são ignorados corretamente?
- `ignore` desaparece e `image-background` vira background nativo?
- filhos sem tag são processados ou descartados?
- o resultado muda quando o frame raiz está ou não tagueado?
- frames sem Auto Layout são achatados corretamente?
- um nó com fill de imagem é classificado antes de seus filhos?
- resultados `null` podem chegar ao JSON final?
- arrays retornados por `page-wrapper` são incorporados corretamente?

Ponto de risco conhecido: o adapter REST precisa expor propriedades equivalentes
às da Plugin API. Qualquer novo campo usado pelo motor compartilhado deve ganhar
uma fixture REST para impedir perda silenciosa.

### 5. Auditoria dos mapeadores

Arquivo principal: `src/core/handlers.js`.

Para cada tag, comparar:

```text
entrada visual
→ função executada
→ widgetType
→ settings gerados
→ elementos filhos
```

Verificar se cada propriedade está:

- no campo correto;
- no nível correto;
- com o tipo correto;
- compatível com o schema do Elementor;
- preservada após a sanitização.

### 6. Auditoria visual e de estilos

Arquivo principal: `src/styles/index.js`.

Testar separadamente:

#### Cores

- cor sólida;
- opacidade;
- `figma.mixed`;
- múltiplos fills;
- gradiente;
- estilo global.

#### Tipografia

- família;
- peso;
- tamanho;
- line-height;
- letter-spacing;
- uppercase;
- underline;
- italic;
- estilo misto.

#### Bordas

- radius uniforme;
- radius independente;
- stroke sólido;
- múltiplos strokes;
- stroke misto.

#### Sombras

- drop shadow;
- inner shadow;
- múltiplas sombras;
- sombra invisível;
- spread;
- opacidade.

Cada resultado deve ser classificado como:

```text
preservado
preservado parcialmente
convertido incorretamente
não suportado
```

### 7. Assets, ícones e recursos incompletos

Na Fase 02, URLs vazias deixaram de ser a estratégia aprovada. Auditar:

- descoberta do node correto;
- render Figma em PNG ou SVG;
- WebP com alvo de 150 KB e caso em que o teto é impossível;
- resposta real do WordPress e presença de `id`/`source_url`;
- associação ao elemento correto;
- Font Awesome nativo versus vetor SVG;
- continuação, relatório e retry após falha;
- persistência de mídia depois do reload.
- `icon-list` e `icon-box` nunca podem receber `selected_icon` com
  `library: "svg"` sem `value.id` e `value.url` válidos;
- SVG pendente ou recusado deve usar placeholder Font Awesome explícito,
  manter a falha no sidecar/relatório e continuar editável no Elementor.

Para cada um, decidir se deve ser:

```text
campo nativo Elementor
sidecar Figmentor
asset rasterizado
SVG real
Font Awesome nativo
falha retryável
limitação do servidor
placeholder Elementor válido
```

### 8. Auditoria das interfaces

Comparar cada controle do plugin e da extensão com o backend correspondente.

Os toggles abaixo existem visualmente, mas precisam de auditoria específica:

- `toggle-ignore-loose`;
- `toggle-flexbox`.

Registrar controles sem efeito como problemas de interface desconectada.

Na extensão, validar também:

- fases Token, Figma e Elementor;
- seleção atual e fallback do frame registrado;
- habilitação do botão somente com documento e sessão válidos;
- confirmação humana antes de upload/save;
- relatório e download;
- retry somente dos falhos;
- mensagem final diferenciando upload, draft e persistência.

### 9. Auditoria WordPress e Elementor

Arquivos principais: `extension/src/wordpress.js` e
`extension/src/elementor.js`.

Verificar:

- contexto, endpoint e nonces detectados na página administrativa;
- ausência de dependência de globais internas do editor;
- envelope real do `elementor_ajax`;
- `get_document_config` antes e depois do save;
- modo página substituindo e modo seção anexando;
- transição REST explícita do post para `draft`;
- tratamento de resposta HTTP, `body.code`, ID e URL da mídia;
- validação do `save_builder` por ação;
- reload e nova leitura para confirmar elementos e mídias.

## Classificação de problemas

| Tipo | Significado |
|---|---|
| Quebra | erro ou JSON inválido |
| Divergência | JSON válido, mas valor incorreto |
| Perda | propriedade existente no Figma desaparece |
| Falso positivo | o plugin exporta algo indevido |
| Inconsistência | mesma regra funciona de formas diferentes |
| Não implementado | UI ou código parcial sem entrega completa |
| Interface desconectada | controle não altera o backend |
| Contrato Elementor | campo incompatível com o schema esperado |

## Formato para registrar cada problema

```markdown
## AUDIT-TRAV-001 — Filhos sem tag são descartados

Categoria: Perda de conteúdo
Severidade: Alta
Camada: Traversal
Arquivo: src/core/traverse.js

Entrada:
- Frame raiz sem tag
- Filho TEXT sem tag

Esperado:
- Filho exportado como heading ou text-editor

Atual:
- Filho retorna null e desaparece do JSON

Causa provável:
- isInsideValidated permanece false

Correção proposta:
- Alterar a regra de validação ou exigir tag explícita no root

Teste de regressão:
- Fixture com frame sem tag e filho TEXT
```

## Ordem recomendada de auditoria

1. Integridade do JSON: `null`, elementos ausentes e campos inválidos.
2. Traversal: conteúdo descartado, hierarquia e flattening.
3. Containers: width, `FILL`, padding, gap e alinhamentos.
4. Tipografia e cores: valores, unidades, estilos mistos e globais.
5. Widgets complexos: button, accordion, nested accordion e carrosséis.
6. Assets: imagens, backgrounds, ícones, SVGs, WebP e relatório.
7. WordPress: sessão, upload, draft e erros reais do servidor.
8. Elementor: payload, página vazia, append de seção e save_builder.
9. Persistência: reload e comparação dos IDs esperados.
10. Interfaces: toggles, loading, mensagens, confirmação e retry.

## Ciclo de desenvolvimento focado

```text
1. Escolher uma divergência específica
2. Criar uma fixture mínima
3. Capturar o JSON atual
4. Definir o JSON esperado
5. Corrigir somente a causa
6. Rodar o teste da fixture
7. Verificar regressões em outros casos
8. Registrar a alteração
```

O primeiro conjunto de testes deve cobrir `traverseNode()`, `handleManualTag()`, `mapContainer()`, `mapText()` e a sanitização do output, pois essas funções controlam a maior parte do resultado final.
