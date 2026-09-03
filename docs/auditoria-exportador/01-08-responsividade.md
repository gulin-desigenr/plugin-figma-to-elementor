# Tarefa 01.08 — Implementar responsividade

## Orientação humana

Definir a experiência desejada em mobile e tablet: empilhamento, tamanhos, paddings, imagens e ordem dos blocos.

## Especificação para o agente

Implementar apenas breakpoints e valores aprovados. Quando houver frames responsivos, extrair suas propriedades e associá-las ao mesmo nó desktop. Quando não houver, gerar configuração mínima e relatório de lacunas.

Evitar copiar ajustes manuais do JSON final como regras universais sem confirmação.

## Critérios de aceite

- Desktop não é alterado por regras mobile indevidas.
- Cada configuração responsiva tem origem documentada.
- O layout não cria overflow em larguras previstas.

## Estado após a Fase 02

**Pendente.** Nenhuma responsividade universal foi inventada. A Fase 02 entrega
o fluxo desktop persistente; mobile/tablet devem ser implementados somente a
partir de frames ou regras aprovadas.

Esta tarefa permanece responsável pelo modo orientado por frames reais. Para
gerar uma versão mobile/tablet a partir apenas do desktop, sem simular que os
valores vieram do Figma, usar a tarefa futura
[01.12 — Responsividade por política base](./01-12-responsividade-por-politica-base.md).
