# Auditoria Técnica do Exportador Figma → Elementor

## Objetivo

Auditar o Figmentor como um compilador: identificar em qual etapa nasce cada problema e corrigir de forma reproduzível, com fixtures, JSON esperado e testes de regressão.

```text
Árvore de nós Figma
→ Traversal
→ Interpretação semântica
→ Mapeamento para Elementor
→ Sanitização
→ JSON final
→ Importação/renderização
```

Esta auditoria deve servir como base para desenvolvimento direcionado, evitando planos genéricos que não estejam ligados a uma divergência concreta.

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

### 3. Invariantes do JSON

Além de comparar valores, validar regras estruturais:

- nenhum item de `content` pode ser `null`;
- todo widget precisa ter `widgetType`;
- todo elemento precisa ter `settings`;
- todo container precisa ter `elements`;
- nenhum `css_id` pode conter acentos, espaços ou caracteres inválidos;
- nenhum campo obrigatório pode ser `undefined`;
- propriedades removidas pela sanitização precisam estar justificadas.

### 4. Auditoria do traversal

Arquivo principal: `src/core/traverse.js`.

Perguntas:

- nós invisíveis são ignorados corretamente?
- `ignore` e `image-background` sempre desaparecem?
- filhos sem tag são processados ou descartados?
- o resultado muda quando o frame raiz está ou não tagueado?
- frames sem Auto Layout são achatados corretamente?
- um nó com fill de imagem é classificado antes de seus filhos?
- resultados `null` podem chegar ao JSON final?
- arrays retornados por `page-wrapper` são incorporados corretamente?

Ponto de risco conhecido: filhos sem tag podem ser ignorados quando não estão dentro de uma estrutura considerada validada. Isso deve ser testado explicitamente.

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

### 7. Recursos incompletos

Não classificar automaticamente como bug os recursos que são placeholders por decisão de produto:

- imagens com `url: ""`;
- carrosséis sem URL de imagem;
- ícones derivados de nomes de vetores;
- gradientes não exportados;
- assets que dependem de upload manual.

Para cada um, decidir se deve ser:

```text
suportado agora
mantido como placeholder
removido da UI
marcado explicitamente como não suportado
```

### 8. Auditoria da interface

Comparar cada controle da UI com o backend.

Os toggles abaixo existem visualmente, mas precisam de auditoria específica:

- `toggle-ignore-loose`;
- `toggle-flexbox`.

Registrar controles sem efeito como problemas de interface desconectada.

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
6. Assets: imagens, ícones, SVGs e gradientes.
7. Interface: toggles, loading, mensagens, cópia e download.

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

