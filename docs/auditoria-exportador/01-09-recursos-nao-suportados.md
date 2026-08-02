# Tarefa 01.09 — Reportar recursos não suportados

## Orientação humana

Decidir como o usuário deve ser informado quando o plugin não consegue reproduzir um recurso: aviso, placeholder, bloqueio da exportação ou etapa manual.

## Especificação para o agente

Criar um relatório estruturado por node e propriedade, com categoria, severidade, motivo e ação recomendada. Exemplos: SVG sem upload, backdrop blur, múltiplas sombras, blend mode e gradiente sem campo nativo.

O exportador não deve mascarar uma perda visual como sucesso completo.

## Critérios de aceite

- Cada recurso não suportado gera aviso rastreável.
- O relatório aponta o node Figma e o caminho Elementor.
- Placeholders possuem indicação explícita.
