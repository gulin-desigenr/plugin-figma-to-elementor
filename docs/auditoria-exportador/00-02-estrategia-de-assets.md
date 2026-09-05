# Tarefa 00.02 — Definir estratégia de assets

## Orientação humana

Escolher como imagens, SVGs, ícones e backgrounds do Figma chegarão ao Elementor.

A decisão pode ser: manter placeholders, exportar um manifesto, fazer upload automático para a biblioteca de mídia ou exigir preenchimento manual.

## Especificação para o agente

Mapear todos os recursos visuais para `nodeId`, nome, tipo, formato, dimensões e destino. O exportador não deve fingir que um asset está pronto usando uma URL vazia sem sinalização.

Definir o contrato entre exportação e upload. Quando o upload não estiver disponível, gerar um relatório de assets pendentes associado ao elemento Elementor.

## Decisões necessárias

- Upload automático será parte do plugin ou de uma etapa externa?
- SVG deve ser preservado como SVG ou convertido para PNG/WebP?
- Backgrounds compostos devem ser exportados como imagem única?

## Critérios de aceite

- Todo asset do Figma tem um destino definido.
- Placeholders são identificados explicitamente.
- Nenhum ícone real é substituído silenciosamente. Se o SVG falhar, um
  placeholder explícito e válido pode ser usado, desde que a falha, o node e a
  ação de retry apareçam no relatório.

## Decisão aprovada na Fase 02

- O plugin Figma só registra referências; a extensão Chrome executa exportação,
  conversão, upload e patch do documento.
- Raster é renderizado pelo Figma, convertido para WebP com alvo de 150 KB e
  enviado à biblioteca WordPress.
- SVG personalizado é enviado como SVG real; Font Awesome permanece nativo.
- Background composto pode ser rasterizado como uma única composição do node.
- `assetRef` e metadados ficam no sidecar, separados dos controles Elementor.
- Falha não interrompe o lote: gera relatório e permite retry somente dos falhos.
- SVG pendente ou recusado nunca pode ser serializado como
  `library: "svg"` com `id`/`url` vazios. `icon-list` e `icon-box` usam
  explicitamente `fas fa-check` enquanto a mídia original não estiver confirmada.

**Estado:** concluída com limitação externa. No aceite real, 8 de 19 assets foram
enviados e 11 SVGs foram recusados pela política do WordPress. O comportamento
de continuação, relatório, placeholder seguro e rascunho persistente foi aprovado.
