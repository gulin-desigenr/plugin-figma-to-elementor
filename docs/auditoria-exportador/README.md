# Tarefas do exportador Figma → Elementor

Esta pasta organiza a evolução do exportador em tarefas independentes.

Cada tarefa possui duas perspectivas:

- **Orientação humana:** decisão de intenção, comportamento esperado e validação visual.
- **Especificação para o agente:** escopo técnico, pontos prováveis de implementação e testes.

## Fluxo de trabalho

1. O responsável humano revisa a tarefa e define as decisões de produto.
2. O agente implementa somente o escopo aprovado.
3. O agente atualiza ou cria os testes da tarefa.
4. O responsável humano valida o resultado visual e funcional.
5. A tarefa é marcada como concluída somente após as duas validações.

## Ordem recomendada

### Decisões de produto

1. [Definir contrato de saída](./00-01-contrato-de-saida.md)
2. [Definir estratégia de assets](./00-02-estrategia-de-assets.md)
3. [Definir estratégia de gradientes e efeitos](./00-03-gradientes-e-efeitos.md)
4. [Definir política responsiva](./00-04-politica-responsiva.md)
5. [Definir ajustes manuais](./00-05-ajustes-manuais.md)

### Implementação

6. [Criar base de testes](./01-01-base-de-testes.md)
7. [Corrigir contrato JSON e IDs](./01-02-json-e-ids.md)
8. [Corrigir estrutura e layout](./01-03-estrutura-e-layout.md)
9. [Preservar conteúdo e tipografia](./01-04-conteudo-e-tipografia.md)
10. [Implementar gradientes e estilos visuais](./01-05-gradientes-e-estilos.md)
11. [Implementar assets e ícones](./01-06-assets-e-icones.md)
12. [Preservar posicionamento e efeitos](./01-07-posicionamento-e-efeitos.md)
13. [Implementar responsividade](./01-08-responsividade.md)
14. [Reportar recursos não suportados](./01-09-recursos-nao-suportados.md)
15. [Validar widgets complexos](./01-10-widgets-complexos.md)
16. [Executar validação comparativa final](./01-11-validacao-final.md)

## Convenção de status

- `Pendente`: tarefa ainda não iniciada.
- `Em revisão humana`: decisões de intenção aguardando definição.
- `Em desenvolvimento`: implementação em andamento.
- `Em validação`: implementação concluída, aguardando conferência visual/funcional.
- `Concluída`: aceite técnico e humano realizados.
