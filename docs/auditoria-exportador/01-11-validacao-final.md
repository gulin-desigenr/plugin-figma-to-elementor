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
