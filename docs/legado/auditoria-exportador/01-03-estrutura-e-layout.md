# Tarefa 01.03 — Corrigir estrutura e layout

## Orientação humana

O layout exportado deve conservar a organização visual do Figma: direção, largura, padding, gap, alinhamento, wrap e sizing.

## Especificação para o agente

Revisar o traversal e `mapContainer`. Mapear `layoutSizingHorizontal`, `layoutSizingVertical`, `layoutWrap`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `itemSpacing` e paddings sem sobrescrever valores legítimos.

Não forçar `nowrap` para todos os containers horizontais. Tratar gap negativo como overlap ou valor inválido, nunca como `gap` CSS negativo.

## Critérios de aceite

- O checklist é exportado com wrap.
- Containers `FILL` geram 100% corretamente.
- Larguras fixas permanecem fixas.
- Padding e gap têm unidade e nível corretos.

## Estado após a Fase 02

**Concluída no contrato, com validação visual contínua.** A extensão reutiliza o
traversal do plugin por meio do adapter REST e preserva page-wrapper, containers,
container-full, hierarquia, sizing, direção, wrap, alinhamentos, padding e gap.
O aceite real confirmou a persistência da árvore; ajustes visuais de imagens não
alteram o aceite estrutural.
