# Tarefa 00.03 — Definir gradientes e efeitos

## Orientação humana

Definir o nível de fidelidade desejado para gradientes, blur, sombras, blend modes e efeitos compostos.

O objetivo é decidir quando usar controles nativos do Elementor, quando gerar CSS e quando rasterizar uma composição.

## Especificação para o agente

Criar uma matriz de decisão por efeito:

- campo nativo do Elementor;
- CSS no elemento ou na página;
- asset rasterizado;
- flag de não suportado.

Registrar stops, direção, opacidade, tipo de sombra, blur e blend mode antes de escolher a representação final.

## Critérios de aceite

- Cada efeito do Figma possui uma estratégia aprovada.
- O agente não introduz CSS sem justificativa.
- Efeitos impossíveis de reproduzir são reportados.
