# Tarefa 00.05 — Definir ajustes manuais

## Orientação humana

Listar decisões que não devem ser automatizadas, como alteração editorial de texto, troca de fonte, criação de conteúdo, ajustes de conversão ou escolha de layout mobile.

## Especificação para o agente

Adicionar uma classificação de origem para cada propriedade relevante: `figma`, `exportador`, `manual`, `elementor-default` ou `não suportado`.

O relatório deve diferenciar perda do exportador de uma alteração intencional feita no Elementor.

## Critérios de aceite

- Ajustes manuais não são tratados como bugs automaticamente.
- Toda divergência sem fonte nativa é marcada para revisão humana.
- O JSON final pode ser comparado sem perder a origem da decisão.
