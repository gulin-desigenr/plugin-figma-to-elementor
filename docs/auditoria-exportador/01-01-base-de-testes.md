# Tarefa 01.01 — Criar base de testes

## Orientação humana

Garantir que cada alteração futura possa ser verificada sem depender somente de uma página real. A validação deve incluir estrutura e, quando possível, aparência.

## Especificação para o agente

Criar fixtures mínimas para `traverseNode`, `handleManualTag`, `mapContainer`, `mapText`, sanitização e serialização de assets.

Cada fixture deve conter entrada simulada do Figma, plugin data, JSON esperado e diferenças observadas. Os testes devem verificar invariantes e valores específicos.

## Critérios de aceite

- Existe comando reproduzível para executar os testes.
- Há pelo menos uma fixture por classe de elemento.
- Falhas indicam caminho JSON e regra responsável.
