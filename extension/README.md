# Figmentor Bridge

Extensão Chrome para orquestrar o workflow Figma → Elementor.

O painel é aberto pela ação da extensão e permanece visível na lateral do Chrome
enquanto você navega entre as abas.

## Fase 02

Status: **concluída e aprovada em 2026-08-03**. Versão validada da extensão:
`0.2.1`.

- lê o frame registrado pelo plugin Figma usando a API REST do Figma;
- detecta a seleção mais recente do Figma pela rota REST `/v1/selections` quando o token possui `selections:read`;
- sincroniza automaticamente a última seleção válida enquanto o plugin Figma está aberto;
- lê tags e `pluginData` retornados pela API;
- reutiliza no bundle da extensão o mesmo traversal, handlers e extratores de estilo do plugin Figma;
- adapta os nós REST do Figma sem achatar frames e grupos relevantes;
- preserva layout, hierarquia, `isInner`, gaps, paddings, tipografia, cores, bordas e sombras;
- normaliza e valida estrutural e semanticamente o contrato Elementor;
- grava `image`, `background_image`, `carousel` e `selected_icon` no formato nativo do Elementor;
- mantém `assetRef` e rastreabilidade somente no sidecar `document.figmentor`;
- gera um manifesto de assets com referências por `nodeId`;
- procura qualidade e escala para manter cada raster abaixo de 150 KB;
- detecta a aba ativa de WordPress/Elementor;
- valida a sessão e o nonce do WordPress;
- renderiza os assets pela API do Figma;
- converte imagens para WebP com limite de 150 KB;
- envia os assets para `/wp-json/wp/v2/media` usando a sessão ativa;
- mantém Font Awesome como ícone nativo e envia vetores personalizados como SVG real;
- mantém `fas fa-check` como placeholder explícito em `icon-list` e `icon-box`
  quando o SVG personalizado está pendente ou falha; nunca envia SVG vazio;
- continua após falhas e permite repetir somente os assets falhos;
- salva diretamente pelo endpoint oficial `elementor_ajax`/`save_builder` da instalação detectada;
- força e confirma o status `draft` pela REST API do WordPress antes do salvamento Elementor;
- consulta `get_document_config`, recarrega a aba e consulta novamente para confirmar persistência;
- recusa qualquer confirmação de sucesso sem status `draft` e sem encontrar os elementos/mídias esperados;
- mostra e permite baixar relatório individual com nome, nodeId, elemento, motivo e ação recomendada.

O salvamento não depende de `window.elementor`, `window.elementorCommon` ou
`window.elementorFrontend`. Endpoint e nonces são lidos da configuração que o
WordPress/Elementor serializa na página administrativa.

## Instalação local

1. Abra `chrome://extensions`.
2. Ative o modo desenvolvedor.
3. Clique em **Carregar sem compactação**.
4. Selecione esta pasta `extension/`.
5. Depois de cada alteração local, clique em **Recarregar** no card da extensão.
6. Execute o plugin Figma e mantenha-o aberto durante a seleção.
7. Selecione um frame válido no Figma; a seleção será sincronizada automaticamente.
8. Abra a extensão e informe o token pessoal na primeira etapa.
9. Na etapa Figma, informe a URL do arquivo e clique em **Detectar seleção atual do Figma**.
10. Clique em **Ler frame registrado ou indicado pela URL**.
11. Avance para a etapa Elementor e detecte a aba WordPress aberta.
12. Revise o destino e confirme a inserção. A aba será recarregada após o rascunho ser confirmado.

Antes de recarregar a extensão, execute `npm run build`. O painel carrega
`extension/dist/popup.js`, que contém o motor compartilhado do plugin e o código
da extensão em um único bundle compatível com Manifest V3.

A interface é faseada: o token fica na tela de conexão, os dados do Figma ficam
na segunda tela e a ação **Inserir no Elementor** fica na terceira. O botão só
é habilitado depois que o JSON e a sessão ativa do WordPress estiverem prontos.

O namespace padrão dos dados compartilhados é `figmentor`. O plugin grava as tags
e o frame registrado em `sharedPluginData`, que a API REST consegue retornar com
`plugin_data=shared`.

Para a detecção automática da seleção, o Personal Access Token precisa ter as
permissões `file_content:read` e `selections:read`. Se essa permissão não estiver
disponível, a extensão tenta usar o registro salvo pelo plugin como fallback.

## Evidência de aceite

No teste integrado real:

- 19 assets foram descobertos;
- 8 imagens/backgrounds foram enviados como mídias 605–612;
- 11 SVGs foram recusados pelo WordPress e mantidos no relatório;
- 6 elementos de topo foram salvos;
- o servidor confirmou o status `draft`;
- o reload confirmou 50 IDs persistidos.

```text
Assets enviados: 8/19
Elementor salvo como rascunho (6 elemento(s)).
Persistência confirmada após recarregar (50 IDs verificados).
```

O aceite da Fase 02 cobre a arquitetura e o fluxo persistente. A fidelidade de
crop/composição/posicionamento de algumas imagens e a habilitação segura de SVG
no WordPress permanecem como limitações registradas.

## Solução de problemas de assets

- SVG recusado: o widget permanece editável com o placeholder explícito
  `fas fa-check`; habilite `image/svg+xml` de forma segura no WordPress e use
  **Repetir somente assets falhos** para aplicar o SVG original.
- WebP acima do alvo: a extensão usa o melhor candidato disponível e registra a
  ocorrência; revise dimensões/composição do node.
- Upload sem ID/URL: revise a resposta e a política da REST API; o item permanece
  falho e não impede o salvamento dos demais.
- Mídia enviada mas visualmente divergente: verifique crop, container de origem,
  `background_position`, `background_size`, radius e dimensões no Elementor.

O registro técnico completo está em
[`docs/FASE-02-BRIDGE.md`](../docs/FASE-02-BRIDGE.md).
