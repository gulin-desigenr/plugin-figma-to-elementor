# Tarefa 01.04 — Preservar conteúdo e tipografia

## Orientação humana

Textos devem manter conteúdo, parágrafos, hierarquia e destaques visuais do Figma. Alterações editoriais continuam sendo decisões humanas.

## Especificação para o agente

Serializar segmentos de texto, preservando família, peso, cor, italic, underline, transformação e estilos de cada trecho. Converter parágrafos e quebras para o formato esperado pelo widget Elementor.

Corrigir a conversão de letter-spacing percentual para `em`. Evitar duplicação entre `title_text` e `description_text` quando há somente um texto no widget.

## Critérios de aceite

- Runs mistos não são achatados.
- Quebras de parágrafo são renderizadas corretamente.
- Famílias tipográficas são preservadas quando disponíveis.
- O conteúdo semântico permanece igual ao Figma.
