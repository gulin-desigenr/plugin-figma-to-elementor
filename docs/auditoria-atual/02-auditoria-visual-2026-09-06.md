> **Ativo.** Achados #3, #4 e #5 ainda em aberto — ver o backlog consolidado em [`docs/ROADMAP.md`](../ROADMAP.md).

# Auditoria 02 — comparação visual e de código Figma vs. resultado do Figmentor

**Data:** 2026-09-06
**Contexto:** primeira auditoria comparativa real desde a Fase 02 (item 01.11 registrava "paridade visual total pendente"). Feita contra o site de teste local (`http://figmentor-teste.local/figmentor-teste/`, Elementor gratuito + Hello Elementor) e o preview do Figma (`SOCIAL-IMPACT`, node 135:3).

## Resumo executivo

A hipótese inicial (container sem `container_type: "flex"` faz o Elementor ignorar layout em linha) foi **investigada e refutada** com evidência direta — Elementor usa flex por padrão e o layout em linha da seção de badges renderiza corretamente. Em compensação, a investigação encontrou um bug sistêmico bem mais grave e 100% confirmado no código-fonte real do Elementor instalado: **o Figmentor escreve `settings.css_id`, mas o controle real do Elementor para isso se chama `_element_id`** — o Elementor nunca lê `css_id`, então nenhum elemento exportado recebe um `id` real no HTML. Isso invalida, silenciosamente, todo `custom_css` gerado (30 ocorrências só nesta página), porque cada bloco de CSS customizado depende de um seletor `#{css_id}` que nunca existe de verdade na página. Além disso, foi confirmado um caso de texto branco (correto, extraído fielmente do Figma) renderizado sem o fundo escuro/imagem que deveria acompanhá-lo, tornando o conteúdo funcionalmente invisível, e um contêiner de ~7565px de altura que sugere uma grade do Figma sendo empilhada em coluna única em vez de manter múltiplas colunas. Não foi possível, dentro do escopo desta rodada, percorrer as seis seções inteiras pixel a pixel — a investigação parou nos primeiros achados de alto impacto porque eles provavelmente dominam a maior parte da divergência visual observada em qualquer seção da página.

## Achado #1 — `container_type` ausente: **REFUTADO**

**Hipótese original:** sem `settings.container_type: "flex"`, o Elementor trataria o container como bloco simples e ignoraria `flex_direction`/`justify_content`/etc.

**Verificação:** pesquisa externa (busca web sobre containers do Elementor) indica que o Flexbox é o layout padrão de containers desde 2023, sem exigir `container_type` explícito. Confirmado empiricamente: inspecionando o container de badges (`elementor-element-c3tu1a2`) ao vivo no site de teste via `getComputedStyle`, ele tem `display: flex`, `flex-direction: row`, `flex-wrap: nowrap`, e os 8 widgets de texto (`GET PAID TO TRAVEL`, `TIKTOK GO`, etc.) aparecem lado a lado exatamente como no Figma. Screenshot de confirmação: `/var/folders/8p/v_zv5vhs3_xb8xyszdz0wn8r0000gn/T/claude-chrome-screenshots-01Qol7/screenshot-1788721117692-1.jpg`.

**Conclusão:** não é necessário adicionar `container_type` em lugar nenhum do código. Descartar essa hipótese.

## Achado #2 — `settings.css_id` não é o controle real do Elementor (`_element_id`) — **CONFIRMADO, prioridade Alta**

**Evidência direta (código-fonte do Elementor instalado em `/Users/pedrogulin/Local Sites/figmentor-teste/app/public/wp-content/plugins/elementor/`):**

`includes/widgets/common-base.php`, linha 782 — o controle "CSS ID" é registrado com a chave `_element_id` (com underscore), não `css_id`:
```php
$this->add_control(
    '_element_id',
    [
        'label' => esc_html__( 'CSS ID', 'elementor' ),
        ...
```

`includes/base/element-base.php`, linha 839 — é essa e somente essa chave que o Elementor lê para emitir o atributo `id` no HTML final:
```php
if ( ! empty( $settings['_element_id'] ) ) {
    $this->add_render_attribute( '_wrapper', 'id', trim( $settings['_element_id'] ) );
}
```

O Figmentor, em todo o código (`src/core/contract.js`, `src/core/handlers.js`, `extension/src/contract.js`), lê e escreve exclusivamente `settings.css_id` — a chave `_element_id` não aparece em nenhum lugar do repositório. Confirmado ao vivo: inspecionando o DOM renderizado do site de teste, **nenhum elemento tem atributo `id`**, apesar do JSON exportado atribuir `css_id` único a cada elemento (ex.: `figmentor-element-13543`, `figmentor-image-box-135290`).

**Impacto medido nesta página:** 30 elementos têm `settings.custom_css` definido (gradientes, efeitos avançados — ver `docs/auditoria-exportador/00-03-gradientes-e-efeitos.md`). A validação em `contract.js` até exige que cada `custom_css` referencie `#{css_id}` como seletor raiz — mas como esse id nunca existe de verdade na página, **nenhum dos 30 blocos de CSS customizado pode surtir efeito no site publicado**, mesmo passando 100% na nossa própria validação interna (que só verifica consistência entre o `custom_css` e o `css_id` gerados por nós, não que o Elementor de fato consuma esse id).

**Causa raiz:** mismatch de nome de chave entre o que o Figmentor escreve (`css_id`) e o que o Elementor lê (`_element_id`). Provavelmente presente desde a criação de `normalizeElementorDocument`/`safeCssId` em `src/core/contract.js` — não é uma regressão recente, é estrutural desde o início do contrato de saída.

**Onde corrigir (não implementado nesta auditoria, só localizado):** todos os pontos que escrevem `settings.css_id` como campo nativo do elemento Elementor (`src/core/contract.js:88-89`, `extension/src/contract.js:187-190`) precisariam também (ou em vez disso) escrever `settings._element_id` com o mesmo valor, e `custom_css` precisaria referenciar `#{_element_id}` em vez de `#{css_id}`. Como `css_id` também é usado internamente pelo Figmentor para deduplicação e para nomear seletores em `src/styles/elementor-selectors.js`, a correção provavelmente deve manter `css_id` como o identificador interno do Figmentor e adicionar `_element_id` como um campo espelhado só na saída final — não trocar um pelo outro sem entender todos os consumidores internos primeiro.

## Achado #3 — texto branco correto, mas sem o fundo que o acompanha no Figma — prioridade Alta

**Seção:** "Already creating for TikTok Shop?" (`content[3].elements[1].elements[0]`, um widget `image-box`, `sourceNodeId` da família `135:xxx`).

**Sintoma confirmado:** `title_color: "rgba(255,255,255,1)"` no JSON exportado — a cor branca **foi extraída corretamente**, é fiel ao Figma. Mas, ao vivo no navegador, esse título (`<h3 class="elementor-image-box-title">`) tem `color: rgb(255,255,255)` sobre `background-color: rgba(0,0,0,0)` (transparente) — sem nenhum fundo escuro ou imagem atrás, o texto fica branco sobre a página branca, efetivamente invisível. Confirmado via `getComputedStyle` ao vivo, não é suposição.

**Causa raiz:** não identificada com certeza dentro do escopo desta auditoria. É consistente com o container pai (ou algum ancestral) não estar recebendo o background (imagem ou cor sólida escura) que o node correspondente tem no Figma — possivelmente outro caso do mesmo tipo de problema já corrigido nas correções 05/06 (descoberta de assets aninhados), mas dessa vez para **cor/fundo de container**, não para imagem. Recomenda-se investigar `extractBackground` (`src/styles/index.js` ou onde estiver implementada) para esse `sourceNodeId` específico antes de propor correção.

## Achado #4 — contêiner de ~7565px de altura, possível grade virando coluna única — prioridade Alta (sintoma), causa não identificada

Entre a seção de badges (fim ~5100px) e o título "Already creating..." (~11133px) existe um único container (`elementor-element-c306wal`, classes `e-flex e-con-boxed e-con e-parent`) com **7565px de altura**. Isso é consistente com uma grade de itens do Figma (provavelmente múltiplas colunas) sendo traduzida para uma única coluna vertical no Elementor, empilhando itens que deveriam estar lado a lado — o mesmo padrão de "grid vira lista vertical gigante" observado informalmente no site real (`joinsocialimpact.com`) em 2026-09-05, antes desta auditoria formal.

**Causa raiz:** não identificada com certeza — não deu tempo de rastrear até `handlers.js`/`traverse.js` dentro do escopo desta rodada. Fica como prioridade para a próxima investigação, já que é o tipo de bug que o refactor do `handleManualTag` (próximo item do roadmap) pode tanto revelar quanto acidentalmente mascarar — vale investigar **antes** do refactor, não depois.

## Achado #5 — `custom_css` mira o wrapper errado na maioria dos widgets — **confirmado, prioridade Alta** (2026-09-06, pós-correção da Feature 10)

Depois da Feature 10 corrigir `_element_id`, o Pedro validou visualmente no editor do Elementor (com Elementor Pro instalado por ele mesmo no site de teste) e achou um problema estrutural na geração do próprio `custom_css`: em `src/styles/effects.js`, a função `extractAdvancedEffects` calcula `targetSlot` como `"root"` para todo widget, **exceto** o caso especial de gradiente de texto em `heading`/`text-editor` (linha ~198: `const targetSlot = textGradient ? (...) : "root";`). `"root"` resolve pra um seletor vazio (`scopeSelector(cssId, "")` → `#{cssId}` puro, sem sufixo) — ou seja, mira sempre o wrapper mais externo do widget.

Isso está certo pra `container` (o wrapper de container é a própria superfície visual), mas está **errado** pra vários tipos de widget, onde o Elementor renderiza a aparência visual real (fundo, sombra, borda) num elemento **interno**, não no wrapper externo — que costuma reservar mais espaço/alinhamento do que o conteúdo visível. Confirmado ao vivo pelo Pedro pra `button`: aplicar `background`/`box-shadow` em `#{css_id}` (o wrapper) produzia um retângulo preto maior que o botão verde visível; o efeito só ficou correto usando o seletor `.elementor-button` (que já existe no registro de `src/styles/elementor-selectors.js`, slot `button.slots.button`, mas nunca é usado pra isso).

**Causa raiz:** `targetSlot` hardcoded como `"root"` em `src/styles/effects.js`, sem consultar o registro de slots por tipo de widget pra decidir qual sub-elemento realmente representa a superfície visual de cada widget.

**Onde corrigir (não implementado, só localizado):** `src/styles/effects.js`, a lógica que define `targetSlot` (linha ~198) precisaria de um mapa por `widgetType` → slot correto pra efeitos gerais (background/box-shadow/blur/blend-mode/opacity), usando os slots que já existem em `ELEMENTOR_SELECTOR_REGISTRY` (`elementor-selectors.js`). **Confirmado até agora:** `button` → slot `button` (`.elementor-button`); `container` → `root` (sem mudança); `image` → `root` parece correto (Pedro não reportou problema, e o wrapper de imagem normalmente não tem padding extra). **Não verificado ainda:** `icon-box`, `image-box`, `icon-list`, `accordion`/`nested-accordion`, `image-carousel`/`nested-carousel` — precisam de checagem visual no editor, widget por widget, antes de qualquer correção ampla (não adivinhar pelo nome do slot).

**Decisão do Pedro (2026-09-06):** registrar o achado, não corrigir agora — fica no backlog pra quando o `custom_css`/efeitos avançados voltarem a ser prioridade.

## Achados não investigados (fora do escopo desta rodada por limite de tempo)

- Comparação seção-a-seção completa das 6 seções da página (hero, "not for part-time attention", badges, "already creating", benefícios, CTA final) — só as primeiras ~3 seções foram olhadas com profundidade.
- Responsividade em viewports menores (mobile/tablet) — só desktop (1534px) foi verificado ao vivo.
- Auditoria de tipografia fina (family/weight/line-height) fora do caso já citado.

## Tabela agregada

| Achado | Prioridade | Status | Arquivo(s) de código provável |
|---|---|---|---|
| #1 `container_type` ausente | — | Refutado, não é bug | nenhum |
| #2 `css_id` vs `_element_id` | Alta | Confirmado | `src/core/contract.js`, `extension/src/contract.js`, `src/styles/elementor-selectors.js` |
| #3 texto branco sem fundo | Alta | Confirmado (sintoma); causa não identificada | provavelmente `src/styles/index.js` (extração de background) |
| #4 grade virando coluna de 7565px | Alta | Confirmado (sintoma); causa não identificada | provavelmente `src/core/handlers.js` (mapeamento de layout wrap/grid) |
| #5 `custom_css` mira wrapper errado (exceto container) | Alta | Confirmado pra `button`; outros widgets não verificados | `src/styles/effects.js`, `src/styles/elementor-selectors.js` |

**Status em 2026-09-06:** achado #2 corrigido e validado visualmente (commit `5ebaa98`, Feature 10). Achados #3, #4 e #5 registrados no backlog, ainda não corrigidos — decisão do Pedro foi seguir em frente por hora. `src/core/contract.js`, `src/core/handlers.js` e `src/styles/effects.js` concentram as causas prováveis — reforça a decisão já tomada de priorizar testes diretos (feito) antes do refactor de `handleManualTag`.
