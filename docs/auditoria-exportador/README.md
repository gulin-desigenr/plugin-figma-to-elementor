# Tarefas do Figmentor — Figma → Elementor

Esta pasta preserva as decisões e requisitos que orientaram o exportador. A
partir da Fase 02, a execução é distribuída entre o plugin Figma mínimo e a
extensão Chrome Figmentor Bridge.

O registro canônico da arquitetura atual está em
[`../FASE-02-BRIDGE.md`](../FASE-02-BRIDGE.md). As tarefas abaixo mantêm a base
histórica e indicam o estado alcançado depois da fase aprovada em 2026-08-03.

## Fluxo de trabalho atual

1. O responsável humano define a intenção e prepara tags/papéis no Figma.
2. O plugin persiste os metadados e registra a raiz.
3. A extensão executa o motor compartilhado pela API REST do Figma.
4. Validação estrutural e semântica acontece antes de qualquer save.
5. Assets são processados com continuação e relatório por item.
6. O WordPress recebe as mídias usando a sessão aberta.
7. O Elementor salva como rascunho.
8. A extensão recarrega e verifica a persistência.
9. O responsável humano valida o resultado visual e as limitações reportadas.

## Decisões de produto

| Tarefa | Estado após a Fase 02 |
|---|---|
| [00.01 — Contrato de saída](./00-01-contrato-de-saida.md) | Concluída; validação estrutural e semântica |
| [00.02 — Estratégia de assets](./00-02-estrategia-de-assets.md) | Concluída com limitação externa para SVG |
| [00.03 — Gradientes e efeitos](./00-03-gradientes-e-efeitos.md) | Implementada tecnicamente; validação visual Elementor pendente |
| [00.04 — Política responsiva](./00-04-politica-responsiva.md) | Pendente para fase posterior |
| [00.05 — Ajustes manuais](./00-05-ajustes-manuais.md) | Parcial; sidecar e relatório distinguem a origem de assets |

## Implementação

| Tarefa | Estado após a Fase 02 |
|---|---|
| [01.01 — Base de testes](./01-01-base-de-testes.md) | Concluída; 47 testes |
| [01.02 — JSON e IDs](./01-02-json-e-ids.md) | Concluída |
| [01.03 — Estrutura e layout](./01-03-estrutura-e-layout.md) | Concluída no contrato; validação visual contínua |
| [01.04 — Conteúdo e tipografia](./01-04-conteudo-e-tipografia.md) | Funcional com limitações para runs mistos |
| [01.05 — Gradientes e estilos](./01-05-gradientes-e-estilos.md) | Implementada tecnicamente; validação visual pendente |
| [01.06 — Assets e ícones](./01-06-assets-e-icones.md) | Concluída; SVG depende do servidor e usa placeholder seguro |
| [01.07 — Posicionamento e efeitos](./01-07-posicionamento-e-efeitos.md) | Implementada para efeitos; posicionamento avançado continua sanitizado |
| [01.08 — Responsividade](./01-08-responsividade.md) | Pendente |
| [01.09 — Recursos não suportados](./01-09-recursos-nao-suportados.md) | Concluída para assets |
| [01.10 — Widgets complexos](./01-10-widgets-complexos.md) | Funcional com validação visual pendente |
| [01.11 — Validação final](./01-11-validacao-final.md) | Fase 02 aprovada; paridade visual total pendente |
| [01.12 — Responsividade por política base](./01-12-responsividade-por-politica-base.md) | Proposta de tarefa futura |

## Evidência de aceite da Fase 02

```text
Assets enviados: 8/19
Elementor salvo como rascunho (6 elemento(s)).
Persistência confirmada após recarregar (50 IDs verificados).
```

As mídias raster 605–612 foram persistidas. Onze SVGs foram recusados pelo
WordPress e ficaram registrados como falhas retryáveis. A arquitetura e o fluxo
foram aprovados; SVG recusado não deixa mais referência vazia em widgets, e
`icon-list`/`icon-box` usam placeholder Font Awesome explícito. Fidelidade de
algumas imagens e recursos visuais compostos permanecem no backlog.

## Convenção de status

- `Pendente`: ainda não iniciado ou explicitamente adiado.
- `Parcial`: parte do contrato funciona, mas os critérios não estão completos.
- `Em validação`: implementação pronta aguardando aceite real.
- `Concluída`: critérios técnicos atingidos.
- `Aprovada`: critérios técnicos e aceite humano do escopo da fase.
- `Limitação externa`: depende de configuração/política do Figma, WordPress ou Elementor.
