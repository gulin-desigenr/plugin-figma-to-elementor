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

## Implementação da tarefa 00.03

**Implementada tecnicamente; em validação visual no Elementor.**

### Matriz de representação

| Origem Figma | Representação | Regra |
|---|---|---|
| Um fill SOLID | Campo nativo | Mantém o background sólido existente |
| Uma DROP_SHADOW visível | Campo nativo | Mantém o shadow simples existente |
| Gradiente linear, radial, angular ou diamond | settings.custom_css | CSS escopado pelo settings.css_id, com stops, direção e opacidade |
| Múltiplos fills | settings.custom_css | Não reduz silenciosamente a composição para uma cor |
| Múltiplas sombras ou INNER_SHADOW | settings.custom_css | Gera box-shadow composto e registra a estratégia |
| LAYER_BLUR | settings.custom_css | Gera filter: blur(...) |
| BACKGROUND_BLUR | settings.custom_css | Gera backdrop-filter e prefixo WebKit |
| Blend mode | settings.custom_css | Converte o valor Figma para mix-blend-mode quando há equivalente CSS |
| Paint não reproduzível | Flag | Fica no relatório técnico, sem fingir paridade |
| Composição de imagem/background | Asset raster | Continua no fluxo de assets da Fase 02 |

### Contrato de seletores

O catálogo versionado elementor-core-3.x cobre os widgets exportados pelo
Figmentor: container, heading, text-editor, image, image-box, icon-box,
icon-list, button, accordion, nested-accordion e image-carousel. Cada entrada
possui root, slots internos, estados e, quando aplicável, alvo por item.
nested-carousel permanece experimental porque não foi confirmado no core
Elementor consultado e não recebe seletor inventado.

Todo elemento normalizado recebe um css_id determinístico. O CSS gerado usa
esse ID como escopo e registra no sidecar o widget, o seletor resolvido, a
estratégia, os tipos de paints/effects e flags.

### Relatório e UI

O relatório técnico combinado reúne assets e efeitos em um único JSON baixável.
A interface mostra apenas um resumo agregado de efeitos e mantém os detalhes
fora da UI principal, evitando a proliferação de painéis.

### Evidência atual

- 47 testes automatizados aprovados;
- cobertura de registro de seletores, gradientes, blur, blend, múltiplos
  shadows, fallback, CSS IDs e resumo compacto;
- custom_css permanece no payload do elemento e não é mais removido pela
  sanitização;
- ainda falta validar em uma instalação Elementor real se o controle custom_css
  aceita e renderiza o CSS salvo pelo endpoint utilizado.

Até essa validação externa, a tarefa não deve ser marcada como aprovada
visualmente.
