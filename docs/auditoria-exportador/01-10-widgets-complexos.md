# Tarefa 01.10 — Validar widgets complexos

## Orientação humana

Definir o comportamento esperado para accordions, nested accordions, carrosséis, listas e widgets compostos.

## Especificação para o agente

Criar fixtures específicas para cada tag complexa. Validar títulos, conteúdos, ícones, ordem, elementos internos, IDs de itens e relação entre container e widget.

Confirmar que elementos filhos não desaparecem por falta de tag, que `ignore` funciona e que arrays retornados pelo page wrapper são incorporados corretamente.

## Critérios de aceite

- Cada widget complexo gera schema válido.
- O conteúdo interno é preservado.
- Itens sem suporte são sinalizados, não descartados silenciosamente.
