---
tags:
  - documentação
  - elementor
  - schema
---

# Mapeamento Oficial de Widgets do Elementor (Schema v0.4)

Este documento exibe a anatomia exata das chaves (Control IDs) esperadas pelo Elementor no momento da importação do JSON. Este mapeamento foi levantado analisando o código-fonte PHP oficial dos widgets base do Elementor.

Qualquer alteração ou novo widget adicionado ao `code.js` do Figmentor **deve** respeitar estritamente essas chaves dentro do objeto `settings`. Chaves inexistentes ou mal formatadas farão com que o Elementor trave silenciosamente (White Screen no painel de edição).

---

## 🏗️ 1. Elementos Estruturais (Containers)

### 1.1 Flexbox Container
O Container é a fundação do layout. Substituiu as antigas Seções e Colunas.

**Nome do Widget (`widgetType` / `elType`):** `container`

| Figma/Figmentor Setting | Elementor Control ID | Tipo / Opções Válidas | Exemplo de Valor |
|---|---|---|---|
| Largura do Conteúdo | `content_width` | `boxed` / `full` | `"boxed"` |
| Largura Customizada | `width` | Object (size, unit) | `{ size: 1140, unit: "px" }` / `{ size: 100, unit: "%" }` |
| Direção Flex | `flex_direction` | `row` / `column` | `"column"` |
| Alinhar Eixo Principal | `justify_content` | `flex-start`, `center`, `space-between` | `"center"` |
| Alinhar Eixo Cruzado | `align_items` | `flex-start`, `center`, `stretch` | `"stretch"` |
| Envolvimento | `flex_wrap` | `nowrap` / `wrap` | `"nowrap"` |
| Espaçamento (Gap) | `gap` | Object (column, row, unit) | `{ column: 20, row: 20, unit: "px" }` |
| Padding | `padding` | Object (T, R, B, L, unit) | `{ top: 40, right: 20, bottom: 40, left: 20, unit: "px" }` |
| Cor de Fundo | `background_color` | String (Hex/RGBA) | `"rgba(255,255,255,1)"` |
| Tipo de Fundo | `background_background` | `"classic"`, `"gradient"`, `"video"` | `"classic"` (obrigatório para ativar a cor) |

---

## 📝 2. Widgets de Texto

### 2.1 Título (Heading)
**Nome do Widget:** `heading`

| Figma/Figmentor Setting | Elementor Control ID | Tipo / Opções Válidas | Exemplo de Valor |
|---|---|---|---|
| Conteúdo do Texto | `title` | String | `"Meu Título Principal"` |
| Cor do Texto | `title_color` | String (Hex/RGBA) | `"#333333"` |
| Alinhamento | `align` | `left`, `center`, `right`, `justify` | `"center"` |
| **Ativador de Tipografia**| `typography_typography`| `"custom"` | **MUITO IMPORTANTE:** Ativa os controles abaixo |
| Tamanho da Fonte | `typography_font_size` | Object (size, unit) | `{ size: 32, unit: "px" }` |
| Peso da Fonte | `typography_font_weight`| String (numérica) | `"400"`, `"700"` |

### 2.2 Editor de Texto
**Nome do Widget:** `text-editor`

| Figma/Figmentor Setting | Elementor Control ID | Tipo / Opções Válidas | Exemplo de Valor |
|---|---|---|---|
| Conteúdo do Texto | `editor` | String (Aceita HTML como `<br>`) | `"Linha 1<br>Linha 2"` |
| Cor do Texto | `text_color` | String (Hex/RGBA) | `"#666666"` |
| Alinhamento | `align` | `left`, `center`, `right`, `justify` | `"left"` |
| **Ativador de Tipografia**| `typography_typography`| `"custom"` | Ativa controles de tipografia |
| Tamanho da Fonte | `typography_font_size` | Object (size, unit) | `{ size: 16, unit: "px" }` |
| Peso da Fonte | `typography_font_weight`| String (numérica) | `"400"` |

---

## 🖼️ 3. Widgets de Imagem e Ícone

### 3.1 Imagem Simples
**Nome do Widget:** `image`

| Figma/Figmentor Setting | Elementor Control ID | Tipo / Opções Válidas | Exemplo de Valor |
|---|---|---|---|
| Objeto da Imagem | `image` | Object (url, id, size) | `{ url: "", id: "", size: "full" }` |
| Alinhamento | `align` | `left`, `center`, `right` | `"center"` |

### 3.2 Caixa de Imagem (Image Box)
**Nome do Widget:** `image-box`

| Figma/Figmentor Setting | Elementor Control ID | Tipo | Observação |
|---|---|---|---|
| Objeto da Imagem | `image` | Object | `{ url: "" }` |
| Título | `title_text` | String | O Elementor falha se você passar apenas `title`. Deve ser `title_text`. |
| Descrição | `description_text` | String | Idem ao acima. |
| Cor do Título | `title_color` | String | |
| Cor da Descrição | `description_color` | String | |
| **Ativadores de Typo** | `title_typography_typography`<br>`description_typography_typography` | `"custom"` | Devem ser engatilhados separadamente. |

### 3.3 Caixa de Ícone (Icon Box) - *Falta Implementar*
**Nome do Widget:** `icon-box`

| Figma/Figmentor Setting | Elementor Control ID | Tipo | Observação |
|---|---|---|---|
| Ícone | `selected_icon` | Object (value, library) | `{ value: "fas fa-star", library: "fa-solid" }` |
| Estilo de Visualização | `view` | `default`, `stacked`, `framed` | |
| Título | `title_text` | String | Mesmo padrão do Image Box. |
| Descrição | `description_text` | String | Mesmo padrão do Image Box. |
| Cor Primária | `primary_color` | String (Hex/RGBA) | Cor do ícone |

---

## 📋 4. Widgets Dinâmicos e Listas

### 4.1 Lista de Ícones (Icon List)
**Nome do Widget:** `icon-list`

| Figma/Figmentor Setting | Elementor Control ID | Tipo / Opções Válidas | Observação |
|---|---|---|---|
| Modo de Exibição | `view` | `default` (vertical) / `inline` (horizontal) | Essencial para emular layout "row". |
| Itens da Lista | `icon_list` | Array de Objetos | Array contendo a propriedade `text` e `selected_icon` em cada índice. |
| Cor do Ícone | `icon_color` | String (Hex/RGBA) | |
| Cor do Texto | `text_color` | String (Hex/RGBA) | |

**Exemplo de Objeto `icon_list`:**
```json
"icon_list": [
  {
    "text": "Item 1",
    "selected_icon": { "value": "fas fa-check", "library": "fa-solid" }
  },
  {
    "text": "Item 2",
    "selected_icon": { "value": "fas fa-check", "library": "fa-solid" }
  }
]
```

### 4.2 Carrossel de Imagens (Image Carousel) - *Falta Implementar*
**Nome do Widget:** `image-carousel`

| Figma/Figmentor Setting | Elementor Control ID | Tipo / Opções Válidas | Observação |
|---|---|---|---|
| Galeria | `carousel` | Array de Objetos de Imagem | Array de `{ id: "", url: "" }` |
| Slides Per View | `slides_to_show` | Número (em string) | Ex: `"3"` |
| Slides To Scroll | `slides_to_scroll` | Número (em string) | Ex: `"1"` |
| Navegação | `navigation` | `"both"`, `"arrows"`, `"dots"`, `"none"` | Setas ou pontinhos de paginação. |

### 4.3 Sanfona (Accordion)
**Nome do Widget:** `accordion`

| Figmentor Setting | Elementor Control ID | Tipo / Opções Válidas | Observação |
|---|---|---|---|
| Itens da Sanfona | `tabs` | Array de Objetos | Cada item deve conter `tab_title` e `tab_content`. |
| Título do Item | `tab_title` | String | Campo interno de cada item do repeater. |
| Conteúdo do Item | `tab_content` | String (aceita HTML) | Campo interno de cada item do repeater. |
| Ícone Fechado | `selected_icon` | Object (value, library) | Ex: `{ value: "fas fa-plus", library: "fa-solid" }` |
| Ícone Aberto | `selected_active_icon` | Object (value, library) | Ex: `{ value: "fas fa-minus", library: "fa-solid" }` |
| Tag HTML do Título | `title_html_tag` | `h1`-`h6` / `div` | Default seguro: `div`. |
| Cor do Título | `title_color` | String (Hex/RGBA) | |
| Cor do Conteúdo | `content_color` | String (Hex/RGBA) | |
| Alinhamento do Ícone | `icon_align` | `left` / `right` | Default seguro: `left`. |
| Tipografia do Título | `title_typography_*` | Grupo de tipografia | Mesmo padrão dos widgets já suportados. |
| Tipografia do Conteúdo | `content_typography_*` | Grupo de tipografia | Mesmo padrão dos widgets já suportados. |

**Exemplo de Objeto `tabs`:**
```json
"tabs": [
  {
    "tab_title": "Pergunta 1",
    "tab_content": "Resposta 1"
  },
  {
    "tab_title": "Pergunta 2",
    "tab_content": "Resposta 2"
  }
]
```

### 4.4 Accordeon (Nested Accordion)
**Nome do Widget:** `nested-accordion`

| Figmentor Setting | Elementor Control ID | Tipo / Opções Válidas | Observação |
|---|---|---|---|
| Itens do Accordeon | `items` | Array de Objetos | Cada item deve conter `item_title` e pode conter `element_css_id`. |
| Título do Item | `item_title` | String | Campo interno de cada item do nested repeater. |
| CSS ID do Item | `element_css_id` | String | Aplicado no item, não no widget raiz. |
| Conteúdo do Item | `elements` | Array de Containers | Cada item recebe um container filho correspondente em `elements`. |
| Ícone de Expandir | `accordion_item_title_icon` | Object (value, library) | Default seguro: `fas fa-plus`. |
| Ícone de Recolher | `accordion_item_title_icon_active` | Object (value, library) | Default seguro: `fas fa-minus`. |
| Posição do Ícone | `accordion_item_title_icon_position` | `start` / `end` | Default seguro: `start`. |
| Posição do Título | `accordion_item_title_position_horizontal` | `start` / `center` / `end` / `stretch` | Default seguro: `stretch`. |
| Tag HTML do Título | `title_tag` | `h1`-`h6` / `div` / `span` / `p` | Default seguro: `div`. |
| FAQ Schema | `faq_schema` | `yes` / `no` | Sai como `no` por padrão no plugin. |
| Estado Inicial | `default_state` | `expanded` / `all_collapsed` | Default seguro: `expanded`. |
| Máx. Itens Abertos | `max_items_expended` | `one` / `multiple` | Default seguro: `one`. |
| Duração da Animação | `n_accordion_animation_duration` | Object | Ex: `{ size: 400, unit: "ms" }`. |
| Cor do Título | `normal_title_color` | String (Hex/RGBA) | Cor base do título no estado normal. |
| Tipografia do Título | `title_typography_*` | Grupo de tipografia | Tipografia do título do item. |

**Observação de implementação**
No plugin do Figma, `accordion` e `accordeon` coexistem como tags distintas de UI. A `Sanfona` exporta o widget clássico `accordion`, enquanto o `Accordeon` exporta `nested-accordion`, com um container aninhado por item para receber widgets internos.

---

## 🛑 Padrão de Estilos Globais e Avançados
Controles que recaem sobre a aba "Avançado", válidos para quase todos os widgets e containers:

- **Bordas**: `border_border` (`"solid"`), `border_width` (Obj), `border_color` (Hex/RGBA), `border_radius` (Obj).
  - *Atenção:* Em alguns widgets (como `image`) as keys recebem o prefixo correspondente: `image_border_radius`.
- **Sombras**: `_box_shadow_type` (`"yes"`), `_box_shadow` (Obj com `horizontal`, `vertical`, `blur`, `spread`, `color`).
- **Margens**: `margin` (mesmo objeto unitário do padding).

> **Atenção (Elementor Developers):** As chaves de controles avançados do layoutWrapper, como custom posicionamento e Sombras globais, são frequentemente prefixadas por underscore (`_width`, `_box_shadow`). As nativas do widget ficam sem prefixo.
