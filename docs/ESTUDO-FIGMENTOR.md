# Estudo do Figmentor — histórico, funcionamento e visão

> **Este documento é vivo, não é um relatório fechado.** A ideia é você conseguir voltar aqui a qualquer momento, entender onde o projeto está, e ir complementando conforme formos avançando. Diferente do `docs/ROADMAP.md` (que é operacional — processo de trabalho, backlog priorizado, o que falta fazer), este aqui é pra **estudo e contexto**: como o projeto chegou até aqui, como ele funciona por dentro, e pra onde estamos indo.
>
> **Como manter isso atualizado:** as seções "Como funciona hoje" e "Onde estamos agora" devem ser **editadas no lugar** conforme a realidade muda (não empilhar histórico nelas). A seção "Linha do tempo" é a única pensada como **log — só adiciona, não reescreve o que já foi registrado**. Quando pedir pra atualizar este documento, é isso que vou fazer.
>
> Última atualização: 2026-09-10.

---

## 1. O que é o Figmentor

O Figmentor converte um frame do Figma (desenhado e tagueado por você) direto em uma página ou seção do Elementor, no WordPress — sem passar por copiar/colar manual de texto, reconstruir layout do zero, ou baixar imagem por imagem.

Duas peças de software fazem isso juntas:

- **Plugin do Figma** (`src/`, roda dentro do próprio Figma) — lê a árvore de nodes selecionada, junto com as tags que você aplicou (`[IMAGE]`, `[BUTTON]`, `[CONTAINER]`, etc.), e sabe transformar isso num documento estruturado no formato que o Elementor entende.
- **Extensão Chrome "Figmentor Bridge"** (`extension/`) — faz a ponte de verdade: lê o mesmo frame direto pela API REST do Figma (sem precisar abrir o plugin dentro do Figma), sobe as imagens pro WordPress, e insere o resultado no editor do Elementor como rascunho, com verificação de que o Elementor de fato salvou.

As duas peças compartilham o mesmo **motor de tradução** (`src/core/`, `src/styles/`) — a lógica de "essa camada do Figma virou qual elemento do Elementor, com quais configurações" é uma só, usada nos dois lugares. Isso é importante: quando corrigimos um bug no motor, ele vale pra ambos os caminhos.

## 2. Como funciona hoje (arquitetura)

### 2.1 O fluxo, passo a passo

1. **Você tagueia no Figma.** Cada camada que deve virar algo específico no Elementor recebe uma tag no nome (ex.: `[BUTTON] Frame`, `[IMAGE-BACKGROUND] Group 8`) ou via plugin data. As tags reconhecidas hoje: `container`, `container-full`, `page-wrapper`, `image`, `image-box`, `image-background`/`background-image`, `icon-box`, `icon-list`, `button`, `accordion`/`accordeon`, `image-carousel`, `container-carousel`, `ignore`.
2. **A extensão lê o frame** direto da API REST do Figma (`extension/src/figma-api.js`), usando seu token pessoal.
3. **O motor traduz a árvore** (`src/core/traverse.js` → `traverseNode`, e `src/core/handlers.js` → `handleManualTag`): percorre os nodes recursivamente, e pra cada tag decide o `widgetType` do Elementor e monta as `settings` (cor, tipografia, espaçamento, bordas, sombras, efeitos avançados).
4. **A extensão descobre os assets** (`extension/src/assets.js` → `discoverAssets`): separado da árvore de widgets, percorre o mesmo frame procurando o que precisa virar upload de mídia (imagens, ícones SVG, backgrounds).
5. **O documento final é montado** (`extension/src/elementor.js` → `buildElementorDocument`): junta a árvore de widgets com os metadados de asset, valida a estrutura (`extension/src/contract.js`).
6. **Os assets sobem pro WordPress** (`extension/popup.js` → `processAssets`, um por vez hoje — ver item de performance no roadmap): cada imagem/ícone é convertido pra WebP (`extension/src/webp.js`) e enviado via API REST de mídia do WordPress.
7. **O documento é inserido no Elementor** (`extension/src/wordpress.js` → `insertElementorDocument`): salva como rascunho via AJAX do próprio Elementor, na sessão já aberta no navegador.
8. **A extensão recarrega a página e confirma** que o Elementor realmente persistiu o conteúdo (não só que a requisição teve sucesso).
9. **Você revisa visualmente** — o Figmentor não promete pixel-perfect automático; sempre existe uma etapa de revisão manual sua no editor do Elementor.

### 2.2 Onde cada tipo de configuração vem de

- **Estrutura/layout** — direção flex, espaçamento, largura: `src/core/handlers.js`, função por tag.
- **Cor, tipografia, bordas, sombra simples** — mapeados direto pra campos **nativos** do Elementor (os controles que aparecem no painel do editor).
- **Efeitos avançados** (gradiente, blend mode, blur, sombra composta) — não têm campo nativo equivalente no Elementor, então viram `custom_css` (`src/styles/effects.js`), escopado por um ID único por elemento.
- **Assets** (imagem, ícone, background) — descobertos e enviados separadamente, depois "encaixados" nos widgets certos (`extension/src/elementor.js` → `bindElementAssets`).

### 2.3 As duas identidades de cada elemento (ponto de confusão comum)

Todo elemento exportado tem **dois** identificadores que parecem a mesma coisa mas não são:

- **`css_id`** — o identificador interno do Figmentor. Usado pra nomear seletores CSS, evitar duplicidade, gerar relatórios. Sempre existiu.
- **`_element_id`** — o campo que o Elementor **de verdade** lê pra colocar um `id` real no HTML publicado. Só passou a ser preenchido em 2026-09-06 (ver linha do tempo) — antes disso, todo `custom_css` gerado era efetivamente inofensivo/inerte, porque o seletor que ele usava nunca existia na página de verdade.

### 2.4 O que valida e o que não bloqueia mais

- **Erros estruturais** (documento malformado, IDs duplicados, widget não suportado) sempre bloqueiam o salvamento — são sinal de bug real no motor.
- **Mídia faltando** (uma imagem que não subiu) não bloqueia mais desde 2026-09-06 — vira aviso reportado no relatório da extensão, e o resto do conteúdo é salvo normalmente.

## 3. Onde estamos agora (estado atual, 2026-09-10)

- **Funciona de ponta a ponta**, testado contra um WordPress local (Elementor gratuito + Pro do próprio Pedro) e contra o site real (`joinsocialimpact.com`): upload de assets, salvamento como rascunho, confirmação de persistência.
- **72 testes automatizados** passando (`npm run check`), incluindo testes diretos do motor de tradução (não só indiretos via extensão).
- **`custom_css`/gradientes/efeitos avançados funcionam de verdade** desde a correção do `_element_id` — mas o **seletor usado ainda mira o elemento errado** na maioria dos widgets além de container/imagem (issue #12, ver linha do tempo).
- **Ambiente de teste local montado:** WordPress local via app "Local" (`figmentor-teste.local`), permitindo testar sem depender do site real — a extensão foi ajustada pra aceitar isso sem abrir mão de exigir HTTPS em sites reais.
- **6 bugs conhecidos e rastreados no GitHub** (issues #11 a #16 — ver seção 5). Nenhum é bloqueante pro uso do dia a dia; são lacunas de fidelidade visual ou de suporte a versão mais nova do Elementor.
- **Repositório organizado:** `main` é a branch principal e sempre íntegra; cada mudança nasce numa branch própria; documentação antiga (Fase 02, plano de março) foi movida pra `docs/legado/`; `docs/ROADMAP.md` é a fonte única do backlog atual.

## 4. Pra onde queremos ir

Decisão central (2026-09-06): **não reescrever o plugin do zero.** A base funciona; o que faltava era disciplina de processo, não qualidade de código. A partir daqui, o caminho é uma **auditoria sistemática, widget por widget** — comparar o resultado real no Elementor contra o Figma, achar a causa raiz de cada divergência, corrigir com teste de regressão. É assim que os achados #2 (`_element_id`) e a feature de `image-background` nasceram, e é assim que os próximos vão nascer.

O backlog vivo e priorizado (o que fazer a seguir, em que ordem) está sempre em **`docs/ROADMAP.md`** — não duplico a lista aqui de propósito, pra não ter duas fontes de verdade brigando entre si. Only a visão de mais alto nível fica aqui:

- Fechar a auditoria sistemática por tipo de widget (heading/text-editor → image/image-box → containers → icon-box/icon-list → button → accordion → carousels, nessa ordem sugerida).
- Decidir o que fazer sobre o Editor V4/widgets atômicos do Elementor (issue #16) — ainda não sabemos se é urgente ou se pode esperar.
- Depois da auditoria visual amadurecer, entrar no débito técnico estrutural: quebrar `handleManualTag`, mover fetches sensíveis pra `world: "ISOLATED"`, formalizar o contrato duplicado entre motor e extensão, workspaces npm, CI.

## 5. Bugs conhecidos (rastreados no GitHub)

| Issue | Resumo | Status |
|---|---|---|
| [#11](https://github.com/gulin-desigenr/plugin-figma-to-elementor/issues/11) | Sombra duplicada em imagens com drop-shadow (queimada no pixel + box-shadow nativo) | Aberto |
| [#12](https://github.com/gulin-desigenr/plugin-figma-to-elementor/issues/12) | `custom_css` mira o wrapper externo em vez do elemento visual real, na maioria dos widgets | Aberto |
| [#13](https://github.com/gulin-desigenr/plugin-figma-to-elementor/issues/13) | Texto branco de `image-box` sem o fundo escuro que deveria acompanhar | Aberto |
| [#14](https://github.com/gulin-desigenr/plugin-figma-to-elementor/issues/14) | Grade do Figma (múltiplas colunas) virando uma coluna vertical gigante | Aberto |
| [#15](https://github.com/gulin-desigenr/plugin-figma-to-elementor/issues/15) | Plugin demora demais para converter (causa ainda não diagnosticada) | Aberto |
| [#16](https://github.com/gulin-desigenr/plugin-figma-to-elementor/issues/16) | Sem suporte aos widgets atômicos do Editor V4 do Elementor | Aberto |

(Convenção: issue no GitHub = sempre um bug, achado ou pré-existente. Tarefa de engenharia planejada = só no `docs/ROADMAP.md`, nunca vira issue.)

## 6. Glossário rápido

- **Tag** — o texto entre `[colchetes]` no nome da camada do Figma (ou plugin data equivalente), que diz ao Figmentor que widget do Elementor aquela camada deve virar.
- **`css_id` vs. `_element_id`** — ver seção 2.3.
- **Achado** — um item específico encontrado durante a auditoria visual comparativa (Figma vs. resultado real no Elementor), documentado em `docs/auditoria-atual/`.
- **`custom_css`** — CSS gerado pelo Figmentor pra efeitos que não têm campo nativo equivalente no Elementor (gradientes, blend mode, blur, sombra composta).
- **Slot** — um sub-elemento visual dentro de um widget do Elementor (ex.: `.elementor-button` é o slot "botão" dentro do widget button, que por sua vez tem um wrapper externo maior). Catalogado em `src/styles/elementor-selectors.js`.
- **Motor (engine)** — o código compartilhado entre o plugin Figma e a extensão Chrome (`src/core/`, `src/styles/`).

---

## Linha do tempo (log — só adiciona, nunca reescreve)

### 2026-08-02 — Base do motor
- `41a89cb`, `ea60b8f` — alinhamento do repositório e modos de exportação por página/seção.

### 2026-09-03 — Fase 02: nasce a extensão Chrome
- `427fc3f` — motor expandido com efeitos, seletores e rastreamento de seleção.
- `c01b9e1` — extensão "Figmentor Bridge" adicionada.
- `5ad16a3` — arquitetura da Fase 02 documentada.
- `f0502db` — primeira correção de segurança: validação de mídia nativa aceitava upload falho silenciosamente (uma imagem que falhasse no upload podia ser salva como se fosse válida, vazia).
- `65098d2` — versionamento e licença fechados (`package.json` 2.0.0, licença privada).

### 2026-09-05/06 — O incidente: a extensão fica inutilizável, e a correção em cadeia
- ESLint + Prettier aplicados em todo o código (`b916437`).
- Pedro tenta usar a extensão e ela trava completamente ao validar o JSON — início de uma sequência de 3 correções no mesmo dia:
  1. A validação de mídia (correção acima) também bloqueava a etapa de *preparo* do JSON, antes de qualquer upload existir (`9acf4c0`).
  2. Descoberta de assets ignorava imagens aninhadas dentro de seções com background tagueado — corrigido em duas rodadas, a segunda removendo a supressão por completo depois que a primeira (limitar a 1 nível) ainda deixava conteúdo real de fora (`871214e`, `56ed2c4`).
  3. Depois de resolvido, Pedro pediu uma regra permanente: nenhuma falha pontual deveria travar o processo inteiro — nasce a política de "mídia faltando vira aviso, não bloqueio" (`3e7d736`).
- Repositório movido de dentro do iCloud Drive pra `~/Developer/` depois que a sincronização automática corrompeu o `.git` (arquivo fantasma em `refs/heads/`).
- Testes diretos do motor adicionados (`1dcbd54`) — antes disso, `traverse.js`/`handlers.js` só eram testados indiretamente via a extensão.
- Ambiente de teste local (WordPress + Elementor via app "Local") montado porque Pedro não tinha site próprio disponível pra testar — extensão ajustada pra aceitar `localhost`/`*.local`/`*.test` sem exigir HTTPS (`49a09f5`).
- **Auditoria visual comparativa real** (Figma vs. resultado no Elementor) feita por um agente em background — primeira vez que isso foi feito de forma rigorosa. Achado principal: `css_id` nunca era o campo que o Elementor lia (`_element_id` era o certo) — **todo `custom_css` gerado desde a criação do projeto era código morto**. Corrigido e validado visualmente no mesmo dia (`365c7f1`).
- Decisão estratégica: não reescrever o plugin do zero — adotar auditoria sistemática por widget como processo permanente.
- Documentação reorganizada: histórico movido pra `docs/legado/`, `docs/ROADMAP.md` criado como fonte única de verdade atual.
- Feature de flatten de `image-background`/`background-image` especificada por Pedro (com screenshots reais) e implementada (`7601dc8`) — grupos decorativos de fundo deixam de gerar widgets soltos e passam a virar uma imagem única, recortada no tamanho do frame pai.

### 2026-09-09 — Rotina de issues no GitHub
- Convenção definida: issue no GitHub = sempre bug (achado ou pré-existente); tarefa de engenharia planejada fica só no roadmap.
- Pedro reporta sombra duplicada em imagens com drop-shadow — causa raiz identificada no mesmo dia (issue #11).
- Backlog da auditoria visual (achados #3, #4, #5) e a queixa de performance viram issues formais (#12–#15).
- Pedro identifica, com apoio da documentação oficial do Elementor, que o Editor V4/widgets atômicos não têm nenhum suporte no Figmentor hoje (issue #16).

### 2026-09-10 — Este documento
- Criado a pedido do Pedro, pra servir de material de estudo e acompanhamento contínuo do projeto — complementar ao `docs/ROADMAP.md`, não um substituto.
