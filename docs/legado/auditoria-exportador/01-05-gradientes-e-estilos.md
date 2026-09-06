# Tarefa 01.05 — Implementar gradientes e estilos visuais

## Orientação humana

O resultado deve reproduzir a identidade visual: dourado, fundos, bordas, raios e hierarquia de contraste.

## Especificação para o agente

Expandir a extração de fills para gradientes lineares e radiais, incluindo stops, direção e opacidade. Implementar a estratégia aprovada para texto com gradiente, botões e backgrounds.

Separar estilo nativo, CSS e rasterização. Não converter um gradiente em cor sólida sem aviso.

## Critérios de aceite

- Botões e títulos com gradiente conservam o gradiente.
- Gradientes de seção são preservados ou explicitamente sinalizados.
- A solução não quebra backgrounds sólidos existentes.

## Estado após a implementação da 00.03

**Implementada tecnicamente; validação visual no Elementor pendente.**
Backgrounds sólidos, bordas, radius e sombras simples continuam nativos.
Gradientes lineares/radiais/angular/diamond e efeitos compostos são preservados
em CSS escopado por ID, com flags para paints que não possuem equivalente CSS.
Imagens de background continuam no fluxo nativo/raster de assets.
