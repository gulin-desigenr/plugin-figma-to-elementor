# Tarefa 00.01 — Definir contrato de saída

## Orientação humana

Decidir qual tipo de artefato o exportador deve gerar: uma página Elementor completa, um template de container ou ambos.

Também deve ser definido quais metadados são obrigatórios para que o arquivo possa ser importado e editado sem correções manuais.

## Especificação para o agente

Documentar e validar o schema de saída, incluindo `version`, `type`, `content`, `page_settings`, `id`, `elType`, `widgetType`, `settings`, `elements` e `isInner`.

Identificar campos obrigatórios por tipo de elemento e criar uma validação antes da exportação. A validação deve rejeitar ou sinalizar `null`, widgets sem `widgetType`, containers sem `elements` e campos com tipo incompatível.

## Decisões necessárias

- O exportador gera `type: "page"`, `type: "container"` ou uma opção configurável?
  - **Aprovado:** opção configurável na tela inicial: `section` ou `page`.
- `page_settings` deve ser sempre gerado?
  - **Aprovado:** gerado como `{}` somente no modo `page`, sem sobrescrever o tema.
- O Elementor deve gerar IDs automaticamente ou o plugin deve fornecê-los?
  - **Aprovado:** o plugin fornece IDs estáveis e `isInner` conforme a hierarquia.

## Contrato aprovado

### Modo seção

- O frame raiz deve possuir a tag `container`.
- A tag `page-wrapper` não é exibida na UI.
- `container-full` permanece disponível para elementos internos.
- O envelope usa `type: "container"`.

### Modo página

- O frame raiz deve possuir a tag `page-wrapper`.
- O wrapper é estrutural e seus filhos são incorporados diretamente em `content`.
- O envelope usa `type: "page"` e `page_settings: {}`.
- Configurações do WordPress, Elementor e Hello Elementor não são sobrescritas.

Antes do download, o exportador valida o envelope, os elementos, os IDs, os
widgets, os containers, `content`, `page_settings` e a ausência de valores nulos.

## Critérios de aceite

- O contrato aprovado está documentado.
- Um JSON exportado passa por validação estrutural.
- O comportamento para página e container está explícito.

## Validação manual concluída

Após a implementação do contrato, foram realizados testes de importação no
WordPress com os dois tipos de artefato:

- JSON de página, gerado no modo `page`;
- JSON de seção, gerado no modo `container`.

Ambos os arquivos foram importados com sucesso no Elementor. O teste confirma
que os envelopes `type: "page"` e `type: "container"` são aceitos no fluxo de
uso definido, e que `page_settings: {}` não impede a importação da página.

Os assets de imagem continuam dependendo de preenchimento manual no Elementor,
conforme o escopo aprovado para esta fase.
