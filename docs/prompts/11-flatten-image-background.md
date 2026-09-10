# Feature 11 — flatten de `image-background`/`background-image` no tamanho do frame pai

**Modelo recomendado:** o modelo mais capaz disponível no Antigravity (ex.: Gemini 3 Pro ou equivalente), esforço/thinking alto. Esta é uma feature grande, com mudanças em 5 arquivos que dependem umas das outras — leia o prompt inteiro antes de começar a editar qualquer arquivo.

**Natureza:** item 2 do backlog em `docs/ROADMAP.md`, especificado diretamente pelo Pedro com screenshots reais do Figma e do Elementor, e uma imagem de referência (`Teste - Exportação.webp`, 1920×1006) mostrando o resultado exato esperado.

## O problema

Hoje, um grupo tagueado `[IMAGE-BACKGROUND]` (ou `[BACKGROUND-IMAGE]`) no Figma é tratado como um container comum: a extensão desce recursivamente nos filhos dele e transforma cada imagem decorativa interna (ex.: ícones do TikTok flutuando sobre um gradiente) num **widget de imagem separado e solto** no Elementor — além de, também, gerar uma imagem de fundo pro grupo (que fica com dimensões erradas, potencialmente maiores que o frame que o contém, porque alguns elementos decorativos do grupo se estendem além da borda visível do frame).

## O comportamento correto

1. Um grupo tagueado `image-background`/`background-image` **não deve gerar nenhum elemento na árvore de saída** — nem um container, nem os widgets dos filhos dele. Ele passa a ser só a **fonte de uma imagem**, nunca uma estrutura própria.
2. Essa imagem deve ser renderizada e depois **recortada no tamanho do frame pai** (o node Figma que contém diretamente o grupo tagueado) — não no bounding box natural do grupo, que pode ultrapassar os limites do frame.
3. Se o frame pai (a "seção") não tiver uma cor de fundo sólida no Figma, use a cor de fundo do frame **página-wrapper** (a raiz da árvore) como fallback, compondo-a atrás das partes transparentes da imagem antes de exportar. Se a seção já tiver sua própria cor, use essa e não busque mais longe.
4. O resultado vai pro campo nativo `background_image` do **elemento pai** (o container que representa o frame que contém o grupo) — não de um container novo pro grupo em si, que deixa de existir na saída.
5. Os valores padrão de exibição (`background_position: "center center"`, `background_repeat: "no-repeat"`, `background_size: "cover"`, `size: "full"` na imagem nativa) **já estão corretos no código hoje** — não mude nada relacionado a isso.

## Exemplo real (do arquivo do Pedro, pra referência ao ler o código)

No Figma: `[CONTAINER] Frame 12` contém dois filhos diretos: `[IMAGE-BACKGROUND] Group 8` (5 imagens decorativas dentro) e `Group 7` (um grupo sem tag própria, com o conteúdo real: botão, imagem, headings). Hoje isso vira, no Elementor: um container com 5 widgets de imagem soltos (de dentro de Group 8) misturados com o conteúdo de Group 7. O correto: um único container (vindo de `Frame 12`) com `background_image` = a imagem flattened de `Group 8` recortada no tamanho de `Frame 12`, e como filhos diretos só o conteúdo de `Group 7` (que já é flattened automaticamente hoje, por não ter tag própria).

## Alterações necessárias, em ordem

### 1. `src/core/handlers.js` — `handleManualTag` não processa mais este tag

Hoje (por volta da linha 248-255):
```js
export async function handleManualTag(node, tag, isRoot, maps) {
  if (
    tag === "container" ||
    tag === "container-full" ||
    tag === "page-wrapper" ||
    tag === "image-background" ||
    tag === "background-image"
  ) {
```

Troque por:
```js
export async function handleManualTag(node, tag, isRoot, maps) {
  if (tag === "image-background" || tag === "background-image") {
    return null;
  }
  if (tag === "container" || tag === "container-full" || tag === "page-wrapper") {
```

Isso faz com que um grupo tagueado assim retorne `null` do `traverseNode`, e portanto nunca apareça como filho de nenhum container — sem precisar mudar mais nada na lógica de containers (o `if (res)` que já existe no loop de filhos do container pai já ignora resultados `null`). Não mexa em mais nada dentro dessa função.

### 2. `extension/src/assets.js` — descoberta calcula o recorte e para de recursar nos filhos

**Import novo no topo do arquivo:**
```js
import { figmaColorToRGBA } from "../../src/utils/colors.js";
```

**Duas funções novas**, perto de `getDimensions` (por volta da linha 80):
```js
function firstSolidFillColor(node) {
  const paint = Array.isArray(node?.fills)
    ? node.fills.find((fill) => fill?.type === "SOLID" && fill.visible !== false)
    : null;
  return paint ? figmaColorToRGBA(paint.color, paint.opacity ?? paint.color?.a) : null;
}

function resolveBackgroundFallbackColor(sectionNode, rootNode) {
  return firstSolidFillColor(sectionNode) || firstSolidFillColor(rootNode) || null;
}
```

**Dentro de `discoverAssets`** (função inteira por volta da linha 134-191), três mudanças na função `visit`:

a) Assinatura ganha um quarto parâmetro `parentNode`:
```js
const visit = (node, path = "0", inheritedIconTag = null, parentNode = null) => {
```

b) No branch que hoje é:
```js
} else if (tag && ASSET_TAGS.has(tag) && !carouselChildIds.has(node.id)) {
  const kind =
    tag === "image-background" || tag === "background-image" ? "background" : "image";
  const targetFormat =
    kind === "image" || kind === "background" || kind === "carousel" ? "WEBP" : "WEBP";
  add(createAssetRecord(node, path, pluginId, kind, "PNG", targetFormat));
}
```
Troque por:
```js
} else if (tag && ASSET_TAGS.has(tag) && !carouselChildIds.has(node.id)) {
  const isFlattenedBackground = tag === "image-background" || tag === "background-image";
  const kind = isFlattenedBackground ? "background" : "image";
  const record = createAssetRecord(node, path, pluginId, kind, "PNG", "WEBP");
  if (isFlattenedBackground && parentNode?.absoluteBoundingBox && node?.absoluteBoundingBox) {
    const parentBounds = parentNode.absoluteBoundingBox;
    const nodeBounds = node.absoluteBoundingBox;
    record.width = parentBounds.width;
    record.height = parentBounds.height;
    record.aspectRatio =
      parentBounds.height > 0 ? Number((parentBounds.width / parentBounds.height).toFixed(4)) : null;
    record.crop = {
      width: parentBounds.width,
      height: parentBounds.height,
      offsetX: nodeBounds.x - parentBounds.x,
      offsetY: nodeBounds.y - parentBounds.y,
      backgroundColor: resolveBackgroundFallbackColor(parentNode, root)
    };
  }
  add(record);
}
```
(`root` aqui é o parâmetro de `discoverAssets(root, pluginId)` — já está no escopo, não precisa passar como argumento.)

c) No final da função `visit`, a recursão incondicional nos filhos:
```js
(node.children || []).forEach((child, index) =>
  visit(child, `${path}.${index}`, iconOwnerTag)
);
```
Troque por (não recursa nos filhos de um grupo `image-background`/`background-image`, e passa `node` como pai pra próxima chamada):
```js
const isFlattenedBackground = tag === "image-background" || tag === "background-image";
if (!isFlattenedBackground) {
  (node.children || []).forEach((child, index) =>
    visit(child, `${path}.${index}`, iconOwnerTag, node)
  );
}
```
(Você vai ter duas checagens `isFlattenedBackground` na função agora — uma dentro do branch do item "b", outra aqui no final. Isso é intencional, mantenha as duas; não tente unificar reestruturando o fluxo, é mais arriscado que duas checagens simples.)

d) A chamada inicial `visit(root);` no final de `discoverAssets` não precisa mudar (os parâmetros extras já têm default `null`).

### 3. `extension/src/elementor.js` — o container pai recebe o background do filho certo

**Função nova**, perto de `bindIcon`/`bindIconList` (por volta da linha 50-86):
```js
function findBackgroundChild(sourceNode, pluginId) {
  if (!Array.isArray(sourceNode?.children)) return null;
  return (
    sourceNode.children.find((child) => {
      const childTag = getNodeTag(child, pluginId);
      return childTag === "image-background" || childTag === "background-image";
    }) || null
  );
}
```

**Dentro de `bindElementAssets`**, troque o branch que hoje é (por volta da linha 103-114):
```js
if (element.elType === "container" && ["image-background", "background-image"].includes(tag)) {
  settings.background_background = "classic";
  settings.background_image = nativeImage();
  settings.background_position = settings.background_position || "center center";
  settings.background_repeat = settings.background_repeat || "no-repeat";
  settings.background_size = settings.background_size || "cover";
  settings.figmentor_assets.background_image = assetMetadata(
    source,
    "background",
    "background_image"
  );
}
```
por (repare que agora procuramos o filho de fundo em `source.children`, em vez de checar a tag do próprio `source` — depois da mudança 1, nenhum elemento vai ter `tag` igual a `image-background`/`background-image`, porque esse tag nunca mais produz elemento nenhum):
```js
if (element.elType === "container") {
  const backgroundChild = findBackgroundChild(source, pluginId);
  if (backgroundChild) {
    settings.background_background = "classic";
    settings.background_image = nativeImage();
    settings.background_position = settings.background_position || "center center";
    settings.background_repeat = settings.background_repeat || "no-repeat";
    settings.background_size = settings.background_size || "cover";
    settings.figmentor_assets.background_image = assetMetadata(
      backgroundChild,
      "background",
      "background_image"
    );
  }
}
```

Não mude mais nada nessa função (`bindIcon`, `bindIconList`, o branch de `image-carousel`, a lógica do sidecar no final).

### 4. `extension/src/webp.js` — nova função de recorte + composição de cor

Adicionar uma função nova, exportada, seguindo o mesmo padrão de fábricas injetáveis (`canvasFactory`/`bitmapFactory`) já usado em `convertPngBlobToWebp` — reutilize `defaultCanvasFactory`/`defaultBitmapFactory` já existentes no arquivo:

```js
function encodeCanvasToPng(canvas) {
  if (typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type: "image/png" });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("O navegador não conseguiu gerar o PNG."))),
      "image/png"
    );
  });
}

/**
 * Recorta o PNG renderizado pelo Figma no tamanho do frame pai (`width`/`height`),
 * posicionando-o em (`offsetX`, `offsetY`) — necessário porque um grupo tagueado
 * image-background pode ter bounding box maior que o frame que o contém. Se
 * `backgroundColor` for informado, preenche o canvas com essa cor antes de
 * desenhar a imagem por cima, pra não perder cor atrás de partes transparentes.
 */
export async function compositeBackgroundImage(pngBlob, options = {}) {
  const { width, height, offsetX = 0, offsetY = 0, backgroundColor = null } = options;
  if (!width || !height) throw new Error("compositeBackgroundImage precisa de width e height.");
  const bitmap = await (options.bitmapFactory || defaultBitmapFactory)(pngBlob);
  try {
    const canvas = (options.canvasFactory || defaultCanvasFactory)(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("O navegador não criou o contexto 2D para compor o background.");
    context.clearRect?.(0, 0, width, height);
    if (backgroundColor) {
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(bitmap, offsetX, offsetY);
    return await encodeCanvasToPng(canvas);
  } finally {
    bitmap.close?.();
  }
}
```

### 5. `extension/popup.js` — usar o recorte antes da conversão pra WebP

**Import**: adicione `compositeBackgroundImage` ao import já existente de `./src/webp.js`.

Na função `processAssets` (por volta da linha 272-325), logo depois de:
```js
const rendered = await renderNodeImage(
  token,
  manifest.source.fileKey,
  asset.figmaNodeId,
  isSvg ? "svg" : "png"
);
let uploadBlob = rendered.blob;
const mimeType = isSvg ? "image/svg+xml" : "image/webp";

if (!isSvg) {
  const converted = await convertPngBlobToWebp(rendered.blob);
```
Troque por:
```js
const rendered = await renderNodeImage(
  token,
  manifest.source.fileKey,
  asset.figmaNodeId,
  isSvg ? "svg" : "png"
);
let uploadBlob = rendered.blob;
const mimeType = isSvg ? "image/svg+xml" : "image/webp";

if (!isSvg) {
  const sourceBlob = asset.crop
    ? await compositeBackgroundImage(rendered.blob, asset.crop)
    : rendered.blob;
  const converted = await convertPngBlobToWebp(sourceBlob);
```
(O restante do bloco `if (!isSvg) { ... }` continua igual — só a origem do blob que entra em `convertPngBlobToWebp` muda quando `asset.crop` existe.)

## Testes obrigatórios

**`tests/extension.test.js`** — adicione pelo menos estes casos (procure os testes existentes de `discoverAssets` e `buildElementorDocument`/`patchElementorAssets` como referência de estilo de fixture):

1. Um node tagueado `image-background`, filho de um node maior (o "frame pai", com seu próprio `absoluteBoundingBox` menor que o do grupo, simulando o grupo "vazando" pra fora do frame), com 2-3 filhos próprios com `fills: [{type: "IMAGE"}]`. Rode `discoverAssets` e confirme: (a) só **1** asset é descoberto no total (o background — os filhos do grupo não viram assets separados), (b) `asset.crop.width`/`height` batem com o `absoluteBoundingBox` do **pai**, não do grupo, (c) `asset.crop.offsetX`/`offsetY` estão corretos (bounding box do grupo menos bounding box do pai).
2. O mesmo cenário, mas com o frame pai tendo um `fills: [{type:"SOLID", color: {...}}]` — confirme que `asset.crop.backgroundColor` reflete essa cor.
3. O mesmo cenário, mas o frame pai SEM fill — passe também um root (terceiro nível) com fill sólido próprio, e confirme que `asset.crop.backgroundColor` usa a cor do **root**, não fica `null`.
4. `handleManualTag` chamado diretamente com `tag: "image-background"` (ou `"background-image"`) retorna `null` (use o mesmo padrão de `tests/traverse.test.js`, adaptando um node REST via `adaptRestNode`).
5. `buildElementorDocument` de ponta a ponta com uma estrutura tipo "Frame 12" (container com um filho `[IMAGE-BACKGROUND]` com sub-imagens e outro filho sem tag com conteúdo real) — confirme que o container resultante tem `settings.figmentor_assets.background_image` (antes do patch) e **nenhum widget de imagem solto** vindo do grupo de background; confirme que os filhos do container são só o conteúdo do segundo grupo.
6. `compositeBackgroundImage` (novo, em `tests/effects.test.js` ou um novo describe em `tests/extension.test.js` — o que fizer mais sentido dado os testes existentes de `convertPngBlobToWebp`): usando os factories injetáveis (mock de canvas/bitmap, seguindo o padrão dos testes existentes de WebP), confirme que o canvas resultante tem o `width`/`height` pedidos e que `context.fillRect` foi chamado quando `backgroundColor` é passado, e não foi chamado quando é `null`.

**`CHANGELOG.md`**: adicione uma linha em `### Added` sob `[Unreleased]` descrevendo a feature (grupos `image-background`/`background-image` agora flattening no tamanho do frame pai, com fallback de cor, aplicados como background nativo do container pai em vez de gerar widgets soltos).

Nenhum outro arquivo deve ser tocado.

## Estado e preservação

- Repositório: `/Users/pedrogulin/Developer/[01.2] PLUGIN FIGMA TO ELEMENTOR__feature_elementor_bridge`; branch `feature/flatten-image-background` (já criada a partir de `main`). **Confirme que está nessa branch** (`git branch --show-current`) antes de editar.
- O working tree deve estar limpo, exceto pela pasta não rastreada `docs/prompts/`. Se `git status --short` mostrar outra coisa, pare e reporte.
- Não faça commit, push, reset, checkout, clean ou stash.

## Fora de escopo absoluto

- Qualquer outro tag (`container`, `container-full`, `page-wrapper`, `image`, `image-box`, `icon-box`, etc.) — comportamento deles não muda.
- `image-carousel`/`container-carousel` — não têm relação com este fix, não toque nesses branches.
- Os achados #3, #4 e #5 da auditoria (`docs/auditoria-atual/02-auditoria-visual-2026-09-06.md`) — são tarefas separadas.
- Rodar ou testar contra um WordPress/Figma real.
- Fazer commit, push, reset, checkout, clean ou stash.

## Validação obrigatória

```bash
npm run check
git diff --check
```

Hoje são 66 testes; deve continuar tudo passando mais os novos (pelo menos 6 novos, então 72+ no total).

## Entrega

Escreva um relatório completo em `docs/relatorios/11-flatten-image-background.md` (diffs de todos os 5 arquivos, os testes novos, resultado exato de `npm run check`). Depois responda no chat **só** com este formato:

```
Feature 11 concluída sem commit ou push.

- <o que foi implementado, 1 linha por item relevante>
- Testes: X arquivos, Y testes aprovados; typecheck/build/format [status]
- Lint: [status]

Relatório: <caminho completo do arquivo>
```

Se qualquer parte da especificação acima não bater com o que você encontrar no código real ao editar (nomes de função diferentes, estrutura diferente da descrita), **pare e reporte a divergência em vez de adaptar por conta própria** — essa feature tem peças que dependem umas das outras, uma adaptação errada numa ponta quebra a outra silenciosamente. Pare após a entrega — não commite.
