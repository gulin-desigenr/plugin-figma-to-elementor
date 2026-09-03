# Tarefa 01.11 — Executar validação comparativa final

## Orientação humana

Validar se a página atende à intenção visual e funcional: hierarquia, conteúdo, conversão, leitura, assets e comportamento responsivo.

## Especificação para o agente

Executar a comparação em três camadas:

```text
Figma real → JSON do plugin → JSON/renderização Elementor
```

Produzir uma matriz final por seção, com divergência, origem provável, severidade e status. Repetir os testes de regressão e verificar que o JSON permanece importável.

## Critérios de aceite

- As seis seções têm correspondência estrutural.
- Não existem placeholders não aprovados.
- O JSON passa no contrato de saída.
- As divergências restantes estão classificadas como manuais, limitações do Elementor ou itens futuros.
- O responsável humano aprova a aparência final.
- Nenhum `icon-list` ou `icon-box` contém `selected_icon` SVG sem mídia válida,
  inclusive quando o WordPress recusa o upload.

## Estado após a Fase 02

**Fase 02 aprovada; paridade visual total pendente.** O teste real percorreu
Figma → JSON fiel → assets → WordPress → Elementor → draft e confirmou a
persistência de 50 IDs após reload. O responsável humano aprovou a arquitetura e
a implementação da página para esta fase. Onze SVGs recusados e problemas de
fidelidade/posicionamento de algumas imagens foram explicitamente registrados
para as próximas fases.

Após o aceite, foi corrigido um caso de crash do editor Elementor causado por
SVG vazio dentro de `icon-list`. O caso agora possui teste de regressão: SVG
confirmado usa mídia nativa; SVG falho usa placeholder Font Awesome explícito e
permanece reportado para retry.
