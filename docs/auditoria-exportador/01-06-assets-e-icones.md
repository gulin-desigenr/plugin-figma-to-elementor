# Tarefa 01.06 — Implementar assets e ícones

## Orientação humana

Imagens, SVGs e ícones devem aparecer como os elementos reais do Figma, ou ser claramente marcados como pendentes.

## Especificação para o agente

Implementar exportação de imagens e vetores por node. Criar manifesto ou integração de upload conforme a decisão 00.02. Usar Font Awesome somente quando o vetor for realmente identificado como Font Awesome.

Preservar dimensões, crop, radius e relação entre asset e widget Elementor.

## Critérios de aceite

- As quatro imagens do caso deixam de ser placeholders quando o fluxo de upload estiver disponível.
- Os ícones dos badges e cards correspondem aos vetores do Figma.
- Assets ausentes aparecem em relatório próprio.

## Estado após a Fase 02

**Concluída no pipeline, com limitações do destino.** A extensão descobre raster,
background, carrossel e vetores; gera WebP com alvo de 150 KB; envia SVG real;
mantém Font Awesome nativo; preenche IDs/URLs WordPress; continua após falha; e
permite retry. SVG pendente ou recusado não é enviado como referência vazia:
`icon-list` e `icon-box` usam o placeholder explícito `fas fa-check`, mantendo a
falha e o retry no relatório. No aceite real, 8/19 assets foram enviados e 11
SVGs foram recusados pelo WordPress, sem impedir o rascunho persistente.
