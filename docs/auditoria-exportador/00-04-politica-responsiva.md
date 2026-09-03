# Tarefa 00.04 — Definir política responsiva

## Orientação humana

Decidir quais comportamentos mobile e tablet devem ser desenhados no Figma e quais podem ser definidos como regra de produto.

Sem um frame responsivo de referência, o agente não deve inventar tamanhos, paddings ou imagens mobile.

## Especificação para o agente

Separar propriedades comprovadas pelo Figma das propriedades responsivas fornecidas manualmente. Registrar a origem de cada configuração: Figma, regra global ou decisão manual.

Implementar breakpoints somente quando houver dados suficientes e preservar configurações desktop quando não houver referência responsiva.

## Critérios de aceite

- Nenhuma regra mobile é criada por inferência silenciosa.
- Cada ajuste responsivo tem uma fonte identificável.
- O comportamento sem frame mobile está documentado.

## Estado após a Fase 02

**Pendente.** A Fase 02 preserva o desktop lido do Figma e não inventa regras
mobile/tablet. A arquitetura suporta evolução do mapper compartilhado, mas a
política responsiva ainda precisa de frames ou regras humanas aprovadas.

Essa tarefa continuará sendo a política para valores comprovados no Figma. A
tarefa futura [01.12](./01-12-responsividade-por-politica-base.md) tratará do
caso complementar em que o usuário aprova um perfil base sem fornecer frame
mobile/tablet.
