# Roadmap do Figmentor

**Este é o documento de referência atual do projeto.** Ele substitui a documentação de planejamento antiga (Fase 02, plano de ação de março de 2026, itens de tarefa individuais), que foi movida para `docs/legado/` — preservada como histórico de decisão, mas não mais mantida. Reflete o estado real do projeto em **2026-09-06**.

## Processo de trabalho atual

- **Modelo PM/executor:** Claude gerencia e revisa; Codex/Antigravity executam as mudanças de código. Cada tarefa vira um prompt em `docs/prompts/NN-slug.md`; o executor entrega um relatório completo em `docs/relatorios/NN-slug.md` e um resumo curto no chat.
- **Branches:** cada mudança nasce numa branch a partir de `main` (ex.: `feature/nome-da-mudanca`), é revisada (diff + testes) e só então mesclada em `main`. `main` é sempre a versão íntegra e testada.
- **Falhas não bloqueiam por padrão:** erros que indicam um problema pontual (ex.: uma imagem que não subiu) viram aviso reportado ao usuário, não impedem o resto do processo. Erros estruturais (documento malformado, IDs duplicados, widget inválido) continuam bloqueando — são sinal de bug real no motor.

### Auditoria sistemática por widget (decisão de 2026-09-06)

Depois que uma auditoria comparativa real (Figma vs. resultado no Elementor, ver `docs/auditoria-atual/`) revelou bugs estruturais sérios que existiam desde a criação do projeto — mesmo com testes automatizados passando —, foi cogitado reescrever o plugin do zero. **A decisão foi não reescrever.** A base atual funciona de ponta a ponta (upload de assets, salvamento no Elementor, testes automatizados, CSS customizado). O que realmente faltava não era qualidade de código, era **disciplina de processo**: nunca tinha sido feita uma auditoria rigorosa comparando cada tipo de widget contra o resultado visual real no Figma.

A partir de agora, isso vira processo permanente: percorrer os tipos de widget do Figmentor, um de cada vez, comparando o resultado real no Elementor contra o Figma, rastreando qualquer divergência até a causa raiz no código (não só até o sintoma), e corrigindo com teste de regressão. A metodologia detalhada (fixtures, classificação de problemas, ordem de auditoria) está em `AUDITORIA_TECNICA_EXPORTACAO.md` (raiz do repo) — esse documento continua ativo, não foi para `docs/legado/`.

## O que já foi resolvido

- Fase 02: extensão Chrome (Figmentor Bridge) + motor compartilhado (`src/core`, `src/styles`) entre plugin Figma e extensão.
- Correção da validação de mídia nativa que aceitava upload falho silenciosamente.
- Versionamento e licença fechados (`package.json` 2.0.0, `extension/manifest.json` 1.0.0, `LICENSE`).
- ESLint + Prettier em todo o código.
- Política de mídia faltando: vira aviso reportado ao usuário em vez de bloquear o salvamento (erros estruturais continuam bloqueando).
- Testes diretos do motor (`tests/traverse.test.js`) cobrindo `traverseNode`/`handleManualTag`, incluindo as branches que não tinham nenhuma cobertura antes (button, container-carousel, accordeon).
- Suporte a WordPress local via HTTP (`localhost`, `127.0.0.1`, `*.local`, `*.test`) para permitir testar sem site próprio, sem enfraquecer a exigência de HTTPS para sites reais.
- **Correção estrutural de alto impacto:** o Figmentor sempre escreveu `settings.css_id`, mas o Elementor só lê `settings._element_id` para gerar o atributo `id` real no HTML — ou seja, todo `custom_css` gerado (gradientes, efeitos avançados) era código morto desde a criação do contrato de saída. Corrigido e validado visualmente (CSS customizado agora aplica de verdade no navegador).
- Correção de descoberta de assets aninhados (imagens dentro de seções com background tagueado deixavam de ser detectadas).
- **Flatten de `image-background`/`background-image`:** um grupo tagueado assim não gera mais widgets filhos soltos nem container próprio — vira só a fonte de uma imagem, recortada no tamanho do frame pai (com fallback de cor: seção → página-wrapper), aplicada como `background_image` nativo do container pai. Validado com uma estrutura sintética "Frame 12" reproduzindo o arquivo real do Pedro; ainda não validado visualmente no Elementor. Commit `dba2573`.

## Backlog atual, em ordem de prioridade sugerida

0. **Sem suporte aos widgets atômicos do Editor V4 do Elementor** ([issue #16](https://github.com/gulin-desigenr/plugin-figma-to-elementor/issues/16), reportado 2026-09-09). O catálogo do Figmentor (`ELEMENTOR_SELECTOR_PROFILE = "elementor-core-3.x"` em `src/styles/elementor-selectors.js`, `SUPPORTED_WIDGET_TYPES` em `extension/src/contract.js`) só conhece os widgets clássicos do Elementor. O novo Editor V4 introduz widgets "atômicos" (Button element, Heading element, DIV Block, Flexbox element, etc.) sem nenhum equivalente hoje. Não confirmado ainda: se V4 é padrão ou experimental, se widgets clássicos continuam funcionando em paralelo, se existe tradução 1:1 clássico→atômico. Investigar antes de decidir escopo da correção.
1. **Achado #5 — `custom_css` mira o elemento errado na maioria dos widgets** ([issue #12](https://github.com/gulin-desigenr/plugin-figma-to-elementor/issues/12)). `src/styles/effects.js` sempre usa o slot `"root"` (o wrapper externo do widget) para aplicar efeitos, exceto no caso especial de gradiente de texto em heading/text-editor. Isso está certo para `container`, mas errado para vários widgets onde a superfície visual real é um elemento interno (confirmado para `button`, que precisa do slot `.elementor-button` já definido em `src/styles/elementor-selectors.js` mas nunca usado para isso). Não verificado ainda: `icon-box`, `image-box`, `icon-list`, `accordion`/`nested-accordion`, carousels.
2. **Achado #3 — texto branco sem fundo** ([issue #13](https://github.com/gulin-desigenr/plugin-figma-to-elementor/issues/13)). Um `image-box` (`content[3].elements[1].elements[0]` na página de teste) tem `title_color` branco correto, mas sem o fundo escuro/imagem que deveria acompanhar — texto invisível sobre fundo branco. Causa raiz não identificada; suspeita é outro caso de `extractBackground` não encontrando o fundo do node correto.
3. **Sombra duplicada em imagens com drop-shadow** ([issue #11](https://github.com/gulin-desigenr/plugin-figma-to-elementor/issues/11), reportado 2026-09-09). `mapImage` (`src/core/handlers.js:845-857`) aplica um `image_box_shadow` nativo do Elementor via `extractShadows` sempre que a imagem tem uma única sombra simples no Figma — mas a imagem exportada (renderizada pela API do Figma) já vem com a sombra "queimada" nos pixels, já que não há como pedir ao Figma pra renderizar sem um efeito aplicado. Resultado: sombra dupla. Ainda não investigado a fundo.
4. **Achado #4 — grade virando coluna única gigante** ([issue #14](https://github.com/gulin-desigenr/plugin-figma-to-elementor/issues/14)). Um container de ~7565px de altura sugere uma grade do Figma (múltiplas colunas) sendo empilhada em coluna vertical única no Elementor. Causa raiz não identificada; provavelmente em `src/core/handlers.js` (mapeamento de layout wrap/grid). Mesmo padrão observado informalmente no site real antes da auditoria formal.
5. **Performance — "o plugin demora demais para converter"** ([issue #15](https://github.com/gulin-desigenr/plugin-figma-to-elementor/issues/15), relatado pelo Pedro em 2026-09-06). Causa ainda não diagnosticada — pode ser do lado do Figma (leitura do frame, renderização de imagens) ou do lado do WordPress (upload sequencial, um asset por vez). Investigar antes de otimizar.
6. **Quebrar `handleManualTag`** (`src/core/handlers.js`, ~860 linhas, 12+ branches com extração de cor/tipografia duplicada) em funções menores — a rede de segurança de testes diretos já existe, é o próximo passo natural.
7. **Mover fetches do WordPress de `world:"MAIN"` para `"ISOLATED"`** na extensão — hoje o nonce/payload fica exposto a qualquer script já rodando na página do WordPress.
8. **Cobrir com teste os pontos de I/O ainda sem prova nenhuma:** `probeWordPressTab` (parsing manual de `<script>` da página), upload de mídia, orquestração geral da extensão.
9. **Reorganizar em workspaces npm** (`packages/shared-engine`, `packages/figma-plugin`, `packages/chrome-extension`) — hoje a extensão referencia `../../src` por caminho relativo.
10. **CI:** passo de lint automático, checagem de que `dist/`/`extension/dist/` não ficou desatualizado em relação à fonte, empacotamento da extensão para release.
11. **Retry/backoff na API do Figma** + lote (`batch`) nas chamadas de `renderNodeImage`, em vez de uma requisição por asset.
12. **Formalizar o contrato entre motor e extensão** — hoje `src/core/contract.js` e `extension/src/contract.js` são duas implementações paralelas e duplicadas da mesma lógica de normalização/validação, sem nenhuma checagem de que estão sincronizadas.

> **Convenção (definida pelo Pedro em 2026-09-09):** issue no GitHub = sempre um **bug** (achado durante o desenvolvimento ou pré-existente), com sintoma observado e, quando possível, causa rastreada no código. Tarefas de engenharia planejadas (refactor, infraestrutura, testes, CI) ficam só aqui no roadmap, não viram issue.

## Auditoria sistemática por widget — plano de execução (proposta, não decisão fechada)

Sugestão de ordem para percorrer os tipos de widget comparando Figma vs. Elementor, do mais usado/visível para o mais raro/experimental:

1. `heading`, `text-editor` — widgets de texto, base de quase toda página.
2. `image`, `image-box` — já parcialmente auditado (achado #3 pendente no image-box).
3. `container`/`container-full`/`page-wrapper` e o próprio `image-background`/`background-image` (item 2 do backlog).
4. `icon-box`, `icon-list` — dependem de checar o achado #5 (slot de efeito) além da estrutura básica.
5. `button` — estrutura já auditada (achado #5 confirmado); falta o resto dos efeitos/tipografia.
6. `accordion`/`nested-accordion` — mais raro, mas usado na página de teste atual.
7. `image-carousel`/`container-carousel`/`nested-carousel` — por último: `nested-carousel` já está marcado como `experimental: true` no registro de seletores, e carousels dependem de comportamento de Swiper.js que precisa de verificação separada.

Isso é uma proposta de ordem, ajustável conforme o que for mais urgente para o uso real do Pedro.
