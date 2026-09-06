# Correção 06 — remover por completo a supressão de imagens aninhadas em seção tagueada

**Modelo recomendado:** o modelo mais capaz disponível no Antigravity (ex.: Gemini 3 Pro ou equivalente), esforço/thinking alto.
**Natureza:** correção de regressão de produção, segunda rodada no mesmo mecanismo da correção 05 — dessa vez removendo a causa por completo em vez de limitar seu alcance.

## Causa raiz confirmada (de novo)

Depois da correção 05, Pedro tentou o mesmo export. Menos imagens ficaram de fora dessa vez (o cluster mais profundo, dentro de `content[3]`, foi resolvido), mas 5 continuam faltando: os mesmos nodes `100:183`, `100:424`, `100:425`, `100:428`, `100:430`, todos filhos **diretos** (não netos) de `120:2` — o node `[IMAGE-BACKGROUND] Group 8`.

A correção 05 limitou a flag `insideRasterTag`, em `extension/src/assets.js` → `discoverAssets` → `visit()`, pra valer só um nível abaixo de um node tagueado como asset (em vez de se propagar pra árvore inteira). Isso resolveu os casos de netos/bisnetos, mas o problema nunca foi a profundidade — é que, no design real do Pedro, os **filhos diretos** de uma seção com `[IMAGE-BACKGROUND]` são frequentemente imagens de conteúdo genuínas e distintas (não uma camada decorativa duplicando o próprio background). Qualquer supressão baseada em "está dentro de um node tagueado", mesmo limitada a 1 nível, vai continuar descartando conteúdo real.

Não há evidência, em nenhum dado real do Pedro até agora, de um caso em que essa supressão realmente evitasse um problema (imagem duplicada). Ela existe desde antes da auditoria, presumivelmente como proteção defensiva contra um cenário hipotético (a camada de preenchimento que compõe visualmente um node já tagueado como `image`/`image-background` sendo contada como asset separado). O risco real desse cenário hipotético é baixo — mesmo que aconteça, o pior resultado é uma imagem extra sendo enviada ao WordPress sem nenhum widget do Elementor referenciá-la (upload desperdiçado, não um bug visível). Isso é estritamente melhor do que o que a supressão está causando hoje: imagens de conteúdo real ficando de fora do export e travando a validação final.

## Objetivo

Remover completamente o mecanismo `insideRasterTag`/`childInsideRaster` de `discoverAssets`. A partir de agora, a única coisa que impede um node de virar asset duplicado é a checagem já existente `!carouselChildIds.has(node.id)` (que continua intacta, é um mecanismo diferente e correto) e a deduplicação por `assetRef` na função `add` (também intacta).

## Estado e preservação

- Repositório: `/Users/pedrogulin/Library/Mobile Documents/com~apple~CloudDocs/PEDRO_DEV/[01.2] PLUGIN FIGMA TO ELEMENTOR__feature_elementor_bridge`; branch `agent/figmentor-audit-baseline`.
- O working tree deve estar limpo neste momento (as correções 03, 04 e 05 já foram commitadas e enviadas). Se `git status --short` mostrar algo além da pasta não rastreada `docs/prompts/`, pare e reporte — não é seu.
- Não faça commit, push, reset, checkout, clean ou stash. A revisão e o commit são feitos por outra pessoa depois.

## Alterações permitidas

**`extension/src/assets.js`**, dentro de `discoverAssets`:

1. Na assinatura de `visit`, remover o parâmetro `insideRasterTag = false`:
   ```js
   const visit = (node, path = "0", inheritedIconTag = null) => {
   ```

2. No branch de fallback (o `else if` que hoje começa com `!insideRasterTag &&`), remover essa condição — ele passa a ser:
   ```js
   } else if (
     !carouselChildIds.has(node.id) &&
     Array.isArray(node.fills) &&
     node.fills.some((fill) => fill?.type === "IMAGE" && fill.visible !== false)
   ) {
   ```

3. Remover a linha `const childInsideRaster = Boolean(tag && ASSET_TAGS.has(tag));` e ajustar a chamada recursiva pra não passar mais esse quarto argumento:
   ```js
   (node.children || []).forEach((child, index) =>
     visit(child, `${path}.${index}`, iconOwnerTag)
   );
   ```

Não altere `carouselChildIds`, `iconOwnerTag`, a deduplicação em `add()`, nem as outras duas branches de detecção de asset (`image-carousel` e `tag && ASSET_TAGS.has(tag)`).

## Alterações em testes

**`tests/extension.test.js`**:

- O teste `'extension discovers untagged raster images nested inside image-background section'` (adicionado na correção 05) deve continuar passando sem alteração — ele já cobre uma imagem 3 níveis abaixo, e vai continuar retornando os mesmos 2 assets.
- Adicionar um novo teste ao lado desse, cobrindo especificamente o caso real que ainda falhava: uma imagem sem tag que é **filha direta** (não neta) de um node tagueado `image-background`. Estrutura sugerida:
  ```js
  test("extension discovers untagged raster images that are direct children of an image-background section", () => {
    const root = {
      id: "1:1",
      name: "[CONTAINER] Section",
      type: "FRAME",
      children: [
        {
          id: "20:1",
          name: "[BACKGROUND] Hero background",
          type: "FRAME",
          width: 1920,
          height: 800,
          pluginData: { [pluginId]: { "elementor-tag": "image-background" } },
          children: [
            {
              id: "20:2",
              name: "Direct Child Photo",
              type: "RECTANGLE",
              width: 400,
              height: 300,
              fills: [{ type: "IMAGE", visible: true }]
            }
          ]
        }
      ]
    };

    const assets = discoverAssets(root, pluginId);
    assert.equal(assets.length, 2);
    assert.deepEqual(
      assets.map((asset) => asset.kind),
      ["background", "image"]
    );
    assert.equal(assets[1].figmaNodeId, "20:2");
  });
  ```

**`CHANGELOG.md`**: adicionar uma linha em `### Fixed` sob `[Unreleased]` descrevendo que a supressão de imagem aninhada foi removida por completo (a correção anterior, que limitava a 1 nível, não era suficiente porque imagens de conteúdo reais aparecem como filhas diretas de seções com background tagueado).

Nenhum outro arquivo deve ser tocado.

## Fora de escopo absoluto

- Qualquer mudança na lógica de `carouselChildIds`, `iconOwnerTag`, na deduplicação por `assetRef`, ou nas outras branches de `visit()`.
- Mexer em `extension/src/elementor.js`, `contract.js`, `wordpress.js`, ou qualquer arquivo de `src/`.
- Reintroduzir qualquer forma de supressão baseada em ancestral tagueado — o objetivo explícito desta correção é eliminar esse mecanismo, não recalibrá-lo.
- Rodar ou testar contra um WordPress/Figma real.
- Fazer commit, push, reset, checkout, clean ou stash.

## Validação obrigatória

Rode, a partir da raiz do repositório:

```bash
npm run check
git diff --check
```

`npm run check` builda plugin + extensão e roda a suíte inteira. Hoje são 50 testes; deve continuar tudo passando mais o novo teste de regressão (51 no total).

## Entrega

Ao final, responda com: o diff exato de `assets.js`, o novo teste adicionado, e o resultado exato de `npm run check` (contagem de testes passando). Pare após isso — não commite.
