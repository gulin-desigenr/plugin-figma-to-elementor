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
- Um placeholder de ícone deve ser um valor Elementor válido; nunca usar SVG com
  `id`/`url` vazios. Para `icon-list` e `icon-box`, o placeholder padrão é
  `fas fa-check`, com a falha do vetor original mantida no relatório.

## Estado após a Fase 02

**Concluída para assets.** O relatório identifica nome, nodeId, elemento, uso,
status, mídia/erro e ação recomendada. Falhas não são contadas como upload,
podem ser repetidas isoladamente e não deixam referências SVG vazias no
Elementor. Efeitos visuais não suportados ainda precisam ser incorporados ao
mesmo modelo de relatório.
