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

### 3.3 Exportação de Imagens Tagueadas em WebP (Issue #9)
- **O Problema:** Imagens inseridas no Figma precisam ser manualmente exportadas e re-upadas no WordPress. Isso gera retrabalho constante e rompe o fluxo de entrega.
- **Descrição da Funcionalidade:**
  - Adicionar botão **"📥 Exportar Imagens"** na UI do plugin (`ui.html`).
  - Ao clicar, o plugin varre toda a seleção atual e localiza todos os nós tagueados como `image`, `image-box`, `image-carousel` ou que possuam image-fill.
  - Cada imagem é exportada individualmente em formato **WebP** usando a Figma Export API (`node.exportAsync({ format: 'WEBP' })`).
  - O `code.js` retorna os bytes para a UI via `postMessage`, e a UI dispara downloads de cada arquivo individualmente via blob URL (`URL.createObjectURL`).
  - O nome do arquivo exportado corresponde ao nome da camada no Figma (ex: `hero-banner.webp`).
- **Slider de Qualidade (0–100%):**
  - Exibir um **slider horizontal** logo acima ou abaixo do botão de exportação, com label dinâmico que mostra o valor atual (ex: `Qualidade: 80%`).
  - Valor padrão: **80%** (balanço entre fidelidade e tamanho de arquivo).
  - O valor selecionado é enviado junto com a mensagem `"export-images"` ao `code.js` como campo `quality` (número de 0 a 1, ex: `0.8`).
  - A API do Figma suporta o parâmetro: `node.exportAsync({ format: 'WEBP', quality: <0–1> })`.
  - O slider deve ter aparência visual consistente com o Design System do plugin (thumb estilizado, track com gradiente, sem aparência nativa do browser).
- **Ação Técnica:**
  - No `index.js`: adicionar handler para msg.type `"export-images"` que lê `msg.quality`, percorre a seleção, extrai bytes em WebP com `{ format: 'WEBP', quality: msg.quality }` de todos os nós elegíveis e retorna um array `[{ name, bytes }]`.
  - Na `ui.html`: adicionar o slider (`<input type="range" min="0" max="100" value="80">`) com label ao vivo via evento `input`, botão `"📥 Exportar Imagens"`, e handler JS que, ao receber `"images-exported"`, itera o array e faz download de cada item como `.webp`.
  - Feedback de progresso via `figma.notify()` durante a exportação (ex: `"Exportando 3 imagens em WebP (qualidade: 80%)..."`).
- **Critérios de Elegibilidade para Export:**
  - Nó com tag `image` ou `image-carousel`.
  - Nó com fill do tipo `IMAGE`.
  - Elemento filho interno de `image-box` com role `image`.
  - *(3.3.1)* Nó do tipo `SLICE` nativo do Figma, ou qualquer nó tagueado como `image` que seja do tipo `SLICE`.

### 3.3.1 Suporte a Slices do Figma na Exportação WebP

- **O Problema:** O Figma possui um tipo de nó nativo chamado **Slice** (`node.type === 'SLICE'`), que funciona como uma "janela de captura" — exporta como imagem única **tudo que está dentro da sua área retangular**, independente da hierarquia de camadas (incluindo nós acima, abaixo ou que transbordam a sua borda).
  - O fluxo atual de exportação WebP (3.3) **ignora Slices**, pois o `collectImageNodes` não os inclui nos critérios de elegibilidade.
  - O usuário também pode taguear um Slice com `"image"` para indicar ao plugin que aquele Slice deve ser tratado da mesma forma que uma imagem na exportação.

- **Comportamento Esperado:**
  - **Caso A — Slice nativo sem tag:** Qualquer nó de tipo `SLICE` presente na seleção (ou encontrado recursivamente) é elegível para exportação, usando exatamente o mesmo pipeline WebP (PNG → Canvas → WebP → JSZip).
  - **Caso B — Slice tagueado como `image`:** Se o usuário taguear um Slice como `image` via plugin, o comportamento deve ser idêntico ao Caso A — o Slice é exportado renderizando tudo dentro dos seus bounds.
  - **Nome do arquivo:** Usa o nome da camada do Slice no Figma, sanitizado para kebab-case (ex: `Slice — Hero Banner` → `slice-hero-banner.webp`).
  - **Escala e Qualidade:** Respeitam os mesmos controles da UI (slider de qualidade + seletor 1x/2x/3x).

- **Como o Figma lida com Slices tecnicamente:**
  - A Figma API trata `SLICE` como um nó exportável como qualquer outro via `node.exportAsync()`.
  - A diferença é que um Slice **não possui fills próprios** — ele é uma região de captura. O `exportAsync` dele renderiza todos os nós visíveis sobrepostos à sua área, como a exportação nativa do Figma faz.
  - Portanto, **não é necessária nenhuma lógica de composição manual** — `exportAsync({ format: 'PNG', useAbsoluteBounds: true, constraint: { type: 'SCALE', value: N } })` no nó Slice já produz o resultado correto.

- **Ação Técnica:**

  #### Backend (`src/index.js`) — `collectImageNodes`
  Adicionar um **4º critério de elegibilidade** na função `collectImageNodes`, antes da recursão em `children`:

  ```js
  // Priority 4: Figma native Slice node — exports everything within its bounds
  if (node.type === 'SLICE') {
    results.push(node);
    return results; // Slice já cobre sua área; não recursar
  }
  ```

  > **Observação:** Como Slices não possuem `children` exportáveis (são apenas regiões), o `return results` garante que não haja recursão desnecessária.

  #### Backend — Identificação de Slices tagueados como `image`
  O critério 1 já captura nós tagueados como `"image"` — incluindo Slices tagueados. Basta garantir que o **critério 4** (Slice nativo) seja verificado **antes** do critério 3 (IMAGE fill), pois Slices não têm fills e falhariam silenciosamente no critério 3.

  #### UI (`ui.html`) — Nenhuma mudança necessária
  O pipeline Canvas → WebP → JSZip já funciona com qualquer `Uint8Array` de bytes PNG gerado pelo `exportAsync`, independente se o nó é um Slice, Rectangle ou qualquer outro tipo.

- **Fluxo Completo:**
  ```
  Usuário seleciona frame com Slices
       ↓
  collectImageNodes percorre nós
       ↓
  Encontra node.type === 'SLICE' (ou Slice tagueado como 'image')
       ↓
  exportAsync(PNG, scale: Nx, useAbsoluteBounds: true)
  → Figma renderiza TUDO dentro dos bounds do Slice
       ↓
  UI recebe bytes PNG
  → Canvas converte para WebP (quality: Q%)
  → JSZip empacota como 'webp-exports/nome-do-slice.webp'
       ↓
  Download automático do .zip
  ```

- **Casos de Validação:**
  - **V1:** Frame com Slice nativo sem tag → Slice aparece no zip como `.webp`
  - **V2:** Slice tagueado como `image` → idem ao V1
  - **V3:** Slice com conteúdo em múltiplas camadas → resultado é uma imagem flat única (composição correta via `exportAsync`)
  - **V4:** Slice + imagem normal na mesma seleção → ambos exportados no mesmo zip
  - **V5:** Slice em escala 2x → sufixo `@2x` no nome do arquivo



### 3.4 Captura e Mapeamento de Fonte (Font Family) para o JSON
- **O Problema:** Atualmente, apenas `font-size` e `font-weight` são extraídos dos nós de texto. A `font-family` (ex: `"Inter"`, `"Roboto"`, `"Lato"`) é ignorada, forçando o usuário a reconfigurar a tipografia manualmente em cada widget após a importação.
- **Descrição da Funcionalidade:**
  - O plugin lê a propriedade `fontName.family` de cada nó de texto (`TEXT`) no Figma.
  - Essa informação é injetada nos `settings` do widget exportado sob as chaves padrão do Elementor:
    - `typography_font_family` → para widgets `heading`, `text-editor`, `button`, `image-box`, `icon-box`, etc.
    - `title_typography_font_family` / `description_typography_font_family` → para widgets com título/descrição separados.
  - **Fallback:** Se a fonte usada não for reconhecida pelo Elementor (fontes personalizadas, fontes de sistema), o campo é omitido e o Elementor aplicará sua fonte padrão configurada no Site Settings — sem quebrar o JSON.
- **Ação Técnica:**
  - Em `styles/index.js`, dentro de `extractTextStyle()`: Adicionar extração de `node.fontName.family` (com guard para `figma.mixed`) e retornar como campo `fontFamily` no objeto de style.
  - Em `handlers.js`, em todos os blocos de widget que já aplicam tipografia: Injetar a chave `typography_font_family` (e suas variantes prefixadas) usando o `fontFamily` retornado.
  - Em `utils/nodes.js`: cobrir o caso `figma.mixed` com um fallback gracioso (retorna `null` ou string vazia).
- **Diagrama de Fluxo:**
  ```
  Nó TEXT no Figma
  └─ fontName.family = "Inter"
       └─ extractTextStyle() → { fontFamily: "Inter", size: 24, weight: "700" }
            └─ handlers.js → settings.typography_font_family = "Inter"
                 └─ JSON exportado → Elementor aplica fonte "Inter" automaticamente
  ```

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
3. **Fidelidade Tipográfica (3.4):** Implementar captura de `font-family` para eliminar reconfiguração manual de fontes no Elementor após importação.
4. **Automação de Assets (3.3):** Implementar exportação em lote de imagens WebP para eliminar o processo manual de re-upload no WordPress.
5. **Escala Futura:** Planejar arquitetura para a detecção heurística "Zero-tag" nos sprints tardios.
