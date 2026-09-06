# Tarefa 01.07 — Preservar posicionamento e efeitos

## Orientação humana

Elementos sobrepostos, badges, sombras e blur devem manter o mesmo papel visual do Figma, dentro das limitações aprovadas do Elementor.

## Especificação para o agente

Revisar a sanitização para não remover posicionamento válido. Mapear absolute positioning, offsets, z-index e overlap somente quando derivados de evidência do Figma.

Ampliar a extração de sombras para distinguir sombra simples, múltiplas camadas e inner shadow. Tratar backdrop blur como CSS ou recurso não suportado conforme decisão 00.03.

## Critérios de aceite

- O grupo de badges da instrutora permanece sobreposto corretamente.
- Sombras simples continuam funcionando.
- Efeitos complexos não desaparecem silenciosamente.

## Estado após a Fase 02

**Parcial.** A estrutura, offsets permitidos pelo contrato e drop shadow simples
são mapeados. Crop, composição e posicionamento de algumas imagens/backgrounds
foram identificados pelo aceite humano como a principal frente de refinamento.
