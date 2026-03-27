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

## ✨ FASE 4: Refinamentos e UI Overhaul
*Objetivo: Limpar inconsistências no payload e garantir a estética profissional do plugin.*

### 4.1 Ignorar Elementos Soltos (Não-Tagueados) (Issue #8)
- **O Problema:** A engine não purga os elementos genéricos sem tag, mantendo sujeiras visuais no JSON.
- **Ação Técnica:** Adicionar lógica no `traverseNode` para forçar o skip de nós órfãos de tags de widget.

### 4.2 CSS Customizado Fantasma (Issue #5)
- **O Problema:** Injeção indevida de CSS ou position attributes que bloqueiam a edição nativa via Elementor.
- **Ação Técnica:** Filtrar as propriedades enviadas, garantindo que formatações inline absolutas não escapem.

### 4.3 Background-Image Nativo (Issue #6/#7)
- **O Problema:** Consolidar os preenchimentos de imagem (`IMAGE` fills) aplicados sobre fundos de Container.
- **Ação Técnica:** Refinar tratativas em `styles/index.js` para mesclar background sólido e imagem de fundo corretamente no JSON do Elementor.

### 4.4 Redesign Mestre de Interface (Issue #4)
- **O Problema:** Layout atual (`ui.html`) não transmite a qualidade premium condizente com as regras de design moderno, prejudicando o onboarding.
- **Ação Técnica:** Refatorar HTML/CSS do `ui.html` utilizando um Design System com base visual do Figma UI (Dark Mode nativo, Tabs para controle, tooltips elucidativos e states hover fluídos).

---

## 🔮 FASE 5: Experiência Mágica (Longo Prazo)
*Objetivo: Reduzir a necessidade de marcação manual em grandes volumes.*

### 5.1 Parser de Elementos "Zero-Tag" via Heurística Avançada
- **O Problema:** O usuário gasta muito tempo tagueando estruturas óbvias para um desenvolvedor front-end.
- **Ação Técnica:**
  - Criar detectores visuais baseados em geometria.
  - "Se um frame possui 1 texto grande em cima, 1 imagem, e 1 texto menor = auto tag como `image-box`".
  - "Se um frame for Auto Layout na horizontal contendo texto adjacente a um vector (ícone) repetido 3 vezes = auto tag como `icon-list`".

---

## 📋 Resumo Priorizado para Execução (Próximos Passos)

1. **Qualidade Mestra (UI e Pipeline):** Entregar a interface premium solicitada no roadmap (UI Overhaul).
2. **Qualidade de Exportação (Backend):** Proteger o payload limpando CSS fantasmas e expurgando loose-nodes (elementos soltos não-tagueados).
3. **Escala Futura:** Planejar arquitetura para a dectecção heurística "Zero-tag" nos sprints tardios.
