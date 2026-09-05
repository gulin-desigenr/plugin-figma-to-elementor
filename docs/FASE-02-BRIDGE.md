# Fase 02 — Figmentor Bridge

Status: **concluída e aprovada em 2026-08-03; correção de segurança do icon-list aplicada em 2026-08-10**.

Este documento registra a arquitetura, o contrato e a evidência de aceite da
Fase 02. Ele substitui, para o estado atual do produto, as descrições antigas em
que o plugin Figma gerava um JSON para importação manual e os assets ficavam
fora do fluxo.

## Resultado da fase

O Figmentor passou a ser composto por dois clientes com responsabilidades
separadas:

```text
Plugin Figma mínimo
  → aplica tags e papéis
  → grava pluginData/sharedPluginData
  → registra o frame/seleção

Extensão Chrome (Figmentor Bridge)
  → lê o Figma pela API REST
  → adapta os nós REST ao motor compartilhado
  → gera e valida o documento Elementor
  → descobre, exporta e converte assets
  → usa a sessão WordPress já aberta
  → salva via elementor_ajax/save_builder
  → força status draft
  → recarrega e confirma a persistência
```

O motor estrutural continua em `src/core/` e `src/styles/`. Ele é usado pelo
bundle do plugin e também incorporado ao bundle da extensão. Não há um segundo
mapper simplificado na extensão.

## Responsabilidades por runtime

### Plugin Figma

- aplicar `elementor-tag` e `elementor_role`;
- manter os prefixos semânticos nos nomes dos nós;
- persistir os dados no namespace compartilhado `figmentor`;
- registrar a raiz selecionada;
- continuar permitindo geração local de JSON como apoio e diagnóstico.

O plugin não recebe credenciais do WordPress e não faz upload de mídia.

### Extensão Chrome

- guardar o token pessoal do Figma localmente;
- ler seleção atual ou frame registrado pela API do Figma;
- preservar `page-wrapper`, containers, `container-full`, hierarquia e
  `isInner` durante a geração;
- normalizar e validar o schema estrutural e semântico;
- gerar o manifesto/relatório de assets;
- converter imagens raster para WebP com alvo máximo de 150 KB;
- exportar vetores personalizados como SVG real;
- manter Font Awesome como `selected_icon` nativo quando identificado;
- enviar mídia pela REST API do WordPress com a sessão aberta;
- substituir referências por `mediaId` e `mediaUrl` reais;
- continuar após falhas e permitir repetir apenas os assets falhos;
- inserir como página ou acrescentar uma seção ao final;
- salvar somente como rascunho e verificar o documento depois do reload.

## Contrato de dados

Os campos que o Elementor renderiza ficam nos seus controles nativos:

```json
{
  "image": { "id": 606, "url": "https://site/.../logo.webp", "size": "full" },
  "background_background": "classic",
  "background_image": { "id": 605, "url": "https://site/.../hero.webp", "size": "full" },
  "selected_icon": { "value": "fas fa-star", "library": "fa-solid" }
}
```

Rastreabilidade interna não é misturada nesses campos. `assetRef`, `nodeId`,
tipo de asset e estado do upload ficam no sidecar `document.figmentor`, usado
pela extensão e removido do payload de conteúdo enviado ao Elementor.

## Assets

### Raster

O Figma renderiza a composição em PNG. A extensão busca combinações de escala e
qualidade para gerar WebP com até 150 KB. Quando o teto não é tecnicamente
atingível, o melhor candidato é mantido e o relatório registra a ocorrência; a
conversão não interrompe os demais assets.

### SVG e ícones

- Font Awesome identificado pelo nome permanece nativo e não é enviado como
  arquivo.
- Vetor personalizado é solicitado ao Figma em SVG e enviado como
  `image/svg+xml`, sem rasterização.
- O WordPress pode recusar SVG por política de MIME ou segurança. Essa recusa é
  uma limitação do destino, não autorização para trocar silenciosamente o vetor
  por um ícone genérico.
- Falhas permanecem no relatório e podem ser reenviadas pelo botão
  **Repetir somente assets falhos**.

## Salvamento no Elementor

A extensão não assume a presença de `window.elementor`,
`window.elementorCommon` ou `window.elementorFrontend`. Ela lê a configuração
serializada pela página administrativa, descobre endpoint e nonces e usa o
envelope real do `elementor_ajax`.

Sequência obrigatória:

1. detectar e validar a aba WordPress/Elementor;
2. confirmar o destino com o usuário;
3. processar os assets sem abortar no primeiro erro;
4. alterar explicitamente o post para `draft` pela REST API;
5. obter o documento atual com `get_document_config`;
6. substituir o conteúdo em modo página ou anexar ao final em modo seção;
7. salvar com `save_builder`;
8. exigir resposta positiva e status `draft`;
9. recarregar a aba;
10. consultar o documento novamente e verificar IDs de elementos e mídias.

Somente depois dessa sequência a interface informa sucesso.

## Validação automatizada

Em 2026-08-17, `npm run check` concluiu com 47 testes aprovados. A suíte cobre,
entre outros:

- seleção atual e frame registrado;
- adapter REST e motor compartilhado;
- hierarquia, layout, spacing, tipografia, cores, bordas e sombras;
- formatos nativos de imagens, backgrounds e ícones;
- Font Awesome e SVG personalizado;
- WebP abaixo do teto e melhor candidato quando o teto é impossível;
- relatório, continuação após falha e seleção de retry;
- página vazia e inserção de seção ao final;
- envelope `elementor_ajax`, transição para draft e rejeição de falso sucesso;
- verificação de elementos e mídias após persistência.

## Correção pós-aceite — crash do icon-list

Em 2026-08-10 foi corrigido um problema descoberto após o aceite: quando o
WordPress recusava um SVG personalizado, a extensão ainda podia salvar no
Elementor um `selected_icon` com `library: "svg"` e `id`/`url` vazios. Ao abrir o
`icon-list`, o editor tentava hidratar essa mídia inválida e podia entrar em
ciclo de atualização ou ficar indisponível.

A regra definitiva agora é:

- SVG confirmado: usar `{ value: { id, url }, library: "svg" }`;
- SVG pendente ou falho: usar explicitamente
  `{ value: "fas fa-check", library: "fa-solid" }`;
- manter o vetor original, status, erro e retry no relatório/sidecar;
- nunca enviar SVG vazio ao Elementor;
- rejeitar semanticamente qualquer SVG sem `id` e `url` antes do save.

Essa correção vale para `icon-list` e `icon-box`. O placeholder é informado ao
usuário e não representa sucesso do asset original.

## Validação integrada aprovada

Teste real realizado no Figma, Chrome, WordPress e Elementor em 2026-08-03:

- 19 assets descobertos;
- 8 assets enviados e associados a IDs reais de mídia (605–612);
- imagens e backgrounds raster enviados com sucesso;
- 11 vetores SVG recusados pelo WordPress e mantidos no relatório;
- documento salvo como rascunho;
- 6 elementos de topo salvos;
- persistência confirmada após reload com 50 IDs verificados.

Mensagem final observada:

```text
Assets enviados: 8/19
Elementor salvo como rascunho (6 elemento(s)).
Persistência confirmada após recarregar (50 IDs verificados).
```

O aceite humano considerou a exportação e implementação da página um grande
sucesso. Permanecem problemas de fidelidade e posicionamento de algumas imagens
e a política de SVG do WordPress. Esses itens seguem para fases posteriores e
não invalidam o aceite da arquitetura e do fluxo persistente da Fase 02.

## Limitações registradas

- 11 SVGs do caso de validação não foram aceitos pela biblioteca de mídia do
  WordPress usado no teste.
- SVG recusado não pode mais deixar um widget com referência SVG vazia; o
  placeholder Font Awesome explícito mantém o editor Elementor editável.
- Algumas imagens/backgrounds ainda precisam de refinamento de crop, dimensão,
  composição ou posicionamento no Elementor.
- A tarefa 00.03 implementa gradientes e efeitos compostos em CSS escopado,
  mantendo este recurso em validação visual até o aceite em uma instalação
  Elementor real.
- Responsividade continua sujeita às tarefas específicas do roadmap.
- O botão de retry não contorna uma política do servidor; ele apenas repete o
  upload depois que a causa externa foi corrigida.

## Como executar novamente

1. Rode `npm run check` na raiz.
2. Reimporte/recarregue o plugin Figma usando `manifest.json`.
3. Em `chrome://extensions`, carregue `extension/` sem compactação ou clique em
   **Recarregar** depois do build.
4. Abra o plugin, aplique tags e selecione/registe a raiz.
5. Na extensão, conecte o token, detecte a seleção e leia o frame.
6. Mantenha o editor Elementor aberto e autenticado.
7. Escolha Página ou Seção, detecte a aba e confirme a inserção.
8. Revise o relatório, repita falhos se a política do servidor tiver mudado e
   confirme o rascunho depois do reload.
