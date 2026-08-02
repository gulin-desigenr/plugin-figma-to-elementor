# Tarefa 01.02 — Corrigir contrato JSON e IDs

## Orientação humana

O resultado deve ser importável e editável no Elementor sem depender de IDs ou campos criados manualmente depois da exportação.

## Especificação para o agente

Gerar IDs Elementor determinísticos e válidos para containers e widgets. Garantir `elements: []` nos widgets quando exigido pelo contrato e preencher `isInner` conforme a posição estrutural.

Garantir unicidade global de `css_id`. Prefixar IDs que começam por número e aplicar sufixo previsível a nomes repetidos.

## Critérios de aceite

- Todos os elementos possuem ID válido.
- Não há `css_id` duplicado no documento.
- O JSON passa no validador estrutural.
- A exportação repetida do mesmo frame produz IDs estáveis.
