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
- Nenhum ícone real é substituído silenciosamente por um ícone genérico.
