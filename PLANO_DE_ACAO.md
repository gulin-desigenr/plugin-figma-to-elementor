---
tags:
  - planejamento
  - roadmap
  - figmentor
---

# Plano de Ação de Desenvolvimento — Figmentor

Este documento estrutura as próximas fases de desenvolvimento do plugin Figmentor, priorizadas com base na importância arquitetural e no impacto na experiência do usuário, derivado do `USER GUIDE` e do `ELEMENTOR_WIDGET_MAPPING`.

---

## 🎯 Critérios de Priorização
A lógica de priorização segue:
1. **Completude do MVP:** Funcionalidades que já existem na UI (`ui.html`) mas não têm backend (`code.js`).
2. **Qualidade de Código (Debt):** Refatoração necessária antes de escalar para funcionalidades mais complexas.
3. **Fidelidade de Design:** Funcionalidades que diminuem o atrito na passagem Figma → WP (Assets e Variáveis).
4. **Funcionalidades Avançadas:** Automação e machine learning.

---

## 🚀 FASE 1: Completude do MVP (Curto Prazo)
*Objetivo: Fazer com que todos os botões que já existem na interface do usuário funcionem corretamente.*

### 1.1 Widget: `icon-box` (Alta Prioridade)
- **O Problema:** O botão existe na UI, mas ao ser clicado não executa o parser correto porque não há lógica estruturada no `handleManualTag`.
- **Ação Técnica:**
  - Extrair o ícone (via nome da layer ou fallback estático).
  - Extrair os textos (híbrido de comportamento entre `heading` e `image-box`).
  - Popular as chaves obrigatórias: `selected_icon`, `title_text`, `description_text`, e `primary_color`.

### 1.2 Widgets Dinâmicos: `image-carousel` e `container-carousel` (Alta Prioridade)
- **O Problema:** Falta suporte a manipulação de arrays (Repetir nós filhos em uma propriedade de galerias).
- **Ação Técnica:**
  - Criar função auxiliar para processar irmãos (siblings) selecionados ou filhos de um Frame rotulado.
  - Para imagens: agrupar na chave `carousel` populando a array de objetos `{id, url}`.
  - Inserir padrões (fallback) para `slides_to_show` e `navigation`.

### 1.3 Widget: `button` (Alta Prioridade)
- **O Problema:** O widget de botão existe na interface, mas necessita de um handler específico no `code.js` para capturar todas as suas propriedades essenciais definidas pela estrutura do Elementor.
- **Ação Técnica:**
  - Extrair a string do nó de texto interno para popular a chave geométrica `text`.
  - Identificar o alinhamento e as propriedades de Auto Layout do Figma para mapear as chaves `align` (left, center, right, justify) e `size` (sm, md, lg, xl).
  - Extrair as propriedades de estilo essenciais (cor de fundo, cor do texto, tipografia, e `border-radius`).
  - Identificar se há um nó de vetor (ícone) junto ao texto para popular as chaves correspondentes `icon`, `icon_align` (left/right) e `icon_indent`, dependendo da ordem dos elementos no Auto Layout.
  - Mapear links de prototipagem (Figma Reactions) para o objeto de link no Elementor populando `link: { url: "...", is_external: false }`.

---

## 🛠️ FASE 2: Refatoração e Estabilidade (Curto Prazo)
*Objetivo: Tornar o `code.js` sustentável. Arquivos de 400+ linhas se tornam difíceis de manter para os agentes e desenvolvedores.*

### 2.1 Modularização do Backend
- **O Problema:** O `code.js` é um monólito. Utilitários de cor e strings estão misturados com a lógica de árvore.
- **Ação Técnica:**
  - Migrar para um sistema de módulos (Ex: webpack ou esbuild simples).
  - Separar em: `utils/colors.js`, `utils/typography.js`, `core/traverse.js`, `core/handlers.js`.

### 2.2 Controle de Erros e Validações
- **O Problema:** Falta de feedback visual detalhado para o usuário em caso de quebra ou seleção incorreta.
- **Ação Técnica:**
  - Criar um validador de seleção (Ex: Impedir export se múltiplas seções raiz simultâneas forem selecionadas e quebrarem o JSON).
  - Logs mais claros e feedback visual não bloqueante (`figma.notify`).

### 2.3 Sistema de Sub-Tagueamento (Inner Roles) para Widgets Complexos
- **O Problema:** Widgets com múltiplos elementos (como `image-box`, `icon-box`, `testimonial` e `button`) muitas vezes sofrem com extração trocada ou falha no JSON (ex: confundir o título com a descrição) porque o script tenta adivinhar o papel de cada nó com base em ordem hierárquica ou tamanho da fonte.
- **Ação Técnica Sugerida:**
  - **Ação no Código (Backend):** Modificar os handlers para que, antes de aplicar heurísticas, eles procurem por metadados explícitos ou convenções de nome de camada.
  - **Abordagem 1 (UI e PluginData):** Adicionar ações na aba do plugin para "Marcar como Título" ou "Marcar como Ícone". Isso usaria `node.setPluginData('elementor_role', 'title_text')` para registrar o papel ocultamente no Figma. O script leria `getPluginData` e associaria com 100% de confiança ao JSON.
  - **Abordagem 2 (Nomenclatura Power-User):** Ensinar via Tooltip que o usuário pode renomear explicitamente as camadas internas para `[title]`, `[description]`, `[icon]`, e `[image]`. O script faria um `.includes()` no nome da layer.

---

## 🎨 FASE 3: Fidelidade e Sincronização (Médio Prazo)
*Objetivo: Diminuir o retrabalho manual do usuário no Elementor.*

### 3.1 Resolvabilidade de Variáveis Globais (Global Colors/Typography)
- **O Problema:** O plugin converte tudo para "hard-hex" (ex: `#FF0000`). Se o cliente mudar a cor da marca no Site Settings do Elementor, o componente importado não atualizará.
- **Ação Técnica:**
  - Adicionar na UI um mapeamento de `Global Keys` (Ex: Primary, Secondary, Text, Accent).
  - No traversing, quando o script varrer a cor, se ela for de um Token nativo do Figma, mapear não para `color: "#HEX"`, mas sim injetar a chave global interna do Elementor `__globals__: { text_color: "globals/colors?id=primary" }`.

### 3.2 Imagens e Assets em Base64 Data URI
- **O Problema:** O Elementor recebe imagens vazias, forçando o usuário a re-upar e recolocar imagens manualmente a cada seção importada.
- **Ação Técnica:**
  - Em `mapImage`, se for um bitmap do Figma, extrair os bytes.
  - Converter para string base64 (`data:image/png;base64,...`).
  - Injetar no `url` do plugin.
  - *Desafio:* Payload limite do Figma/Navegador para gerar blobs muito grandes. Necessita de redimensionamento interno.

---

## 🤖 FASE 4: Experiência Mágica (Longo Prazo)
*Objetivo: Reduzir a necessidade de marcação manual em grandes volumes.*

### 4.1 Parser de Elementos "Zero-Tag" via Heurística Avançada
- **O Problema:** O usuário gasta muito tempo tagueando estruturas óbvias para um desenvolvedor front-end.
- **Ação Técnica:**
  - Criar detectores visuais baseados em geometria.
  - "Se um frame possui 1 texto grande em cima, 1 imagem, e 1 texto menor = auto tag como `image-box`".
  - "Se um frame for Auto Layout na horizontal contendo texto adjacente a um vector (ícone) repetido 3 vezes = auto tag como `icon-list`".

---

## 📋 Resumo Priorizado para Execução Imediata

Se tivéssemos que abrir um Pull Request amanhã, a ordem de execução deve ser:

1. **Bugfix / Features faltantes:** Implementar os Handlers de `icon-box` e `image-carousel` no `code.js` para honrar os botões já expostos na UI.
2. **Melhoria Arquitetural:** Extrair os validadores visuais para aliviar o root file.
3. **QoL (Quality of Life):** Implementar conversão de Imagens pra Base64 para poupar cliques maçantes no WP.

---

## 📥 BACKLOG / GITHUB ISSUES PARA PRÓXIMAS FASES
*Estas tarefas foram extraídas das Issues do repositório para serem incorporadas após a Estabilidade da Fase 2.*

### Correções (Bugs & Refinamentos)
- **#8 Ignorar Elementos Soltos (Não-Tagueados):** Fazer com que a engine do `traverseNode` purgue e ignore elementos genéricos na canvas que não receberam tag do usuário, mantendo o JSON mais limpo e livre de sujeiras visuais do Figma.
- **#5 CSS Customizado Fantasma:** Corrigir injeção indevida de customizações CSS nativas que ficam chumbadas no container pai invisíveis para a edição do cliente no painel do WordPress.

### Novas Funcionalidades (Features)
- **#6/#7 Background-Image nativo:** Habilitar suporte à decodificação de `fills` do tipo `IMAGE` no objeto de Container, formatando a chave Elementor para que a propriedade `Imagem de Fundo` no painel Estilo herde a imagem vinculada.

### Atualização Mestra de Interface (Redesign)
- **#4 Layout do plugin é feio (UI Overhaul):** Refatorar completamente o código HTML/CSS da interface do Figmentor. Substituir a lista de botões genéricos por um Design System premium: cores neutras escuras (Dark Mode Figma-like), separação avançada por abas (Tabs), transições suaves, tooltips para tags complexas e identidade visual forte.

*(Nota: Importante notar que as antigas Issues #1, #2 e #3 já foram completamente arquitetadas, validadas e sanadas nas Fases 1.2, 1.3 e 2.1 durante os últimos ciclos de desenvolvimento!)*
