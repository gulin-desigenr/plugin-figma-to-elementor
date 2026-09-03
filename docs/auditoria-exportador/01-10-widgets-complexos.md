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
- `icon-list` e `icon-box` permanecem editáveis quando um SVG falha: o widget
  recebe `fas fa-check` como placeholder explícito e mantém o vetor original
  no relatório para retry.

## Estado após a Fase 02

**Funcional com validação visual pendente.** O motor compartilhado mantém
accordion, nested accordion, listas, carrosséis e containers internos. Assets de
listas/carrosséis entram no manifesto. Compatibilidade visual completa de cada
widget e a habilitação de SVG no WordPress permanecem em revisão futura. O
crash causado por referência SVG vazia em `icon-list` foi corrigido e possui
teste de regressão.
