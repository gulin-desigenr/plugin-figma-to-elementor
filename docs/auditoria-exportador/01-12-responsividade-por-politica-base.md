# Tarefa 01.12 — Responsividade derivada por política base

## Objetivo

Permitir que a extensão gere uma configuração mobile/tablet útil a partir de um
frame desktop, sem exigir um segundo frame no Figma. Esta tarefa complementa:

- [00.04 — Política responsiva](./00-04-politica-responsiva.md), que define a
  origem e a autorização das regras;
- [01.08 — Implementar responsividade](./01-08-responsividade.md), que trata a
  extração quando existem frames mobile/tablet.

As tarefas anteriores continuam válidas para o modo **orientado por fonte**. Esta
tarefa introduz o modo **orientado por política**.

## Princípio

O layout desktop continua sendo a fonte estrutural. A extensão aplica um perfil
responsivo explicitamente escolhido pelo usuário; ela não afirma que os valores
foram medidos em um frame mobile.

```text
Figma desktop
  + perfil responsivo aprovado
  → settings Elementor desktop + tablet/mobile
```

Toda propriedade gerada pelo perfil deve carregar a origem:

```text
figma             valor comprovado no frame
responsive-policy valor aplicado pelo perfil base
manual            exceção informada pelo usuário
elementor-default valor deixado para o Elementor
```

## Escopo da política base

O perfil deverá permitir configurar, no mínimo:

- padding horizontal e vertical de seções por breakpoint;
- gap entre itens de containers;
- direção e empilhamento de containers (`row` → `column`);
- alinhamento e distribuição no mobile;
- escala de tipografia para heading, texto, botão e widgets compostos;
- largura máxima e comportamento de imagens/backgrounds;
- visibilidade opcional de elementos por breakpoint;
- espaçamento de widgets e botões;
- exceções por tag ou `css_id`.

Os valores padrão devem ser uma decisão de produto versionada, não uma inferência
silenciosa do tamanho do frame desktop.

## Modelo sugerido

```json
{
  "responsive_policy": {
    "profile": "base-gulin-v1",
    "breakpoints": {
      "tablet": { "max": 1024 },
      "mobile": { "max": 767 }
    },
    "section": {
      "padding": {
        "tablet": { "top": 48, "right": 24, "bottom": 48, "left": 24, "unit": "px" },
        "mobile": { "top": 32, "right": 20, "bottom": 32, "left": 20, "unit": "px" }
      },
      "gap": {
        "tablet": { "column": 24, "row": 24, "unit": "px" },
        "mobile": { "column": 16, "row": 16, "unit": "px" }
      }
    },
    "typography": {
      "heading": { "tablet": 0.82, "mobile": 0.68 },
      "body": { "tablet": 0.95, "mobile": 0.9 }
    }
  }
}
```

Os números acima são apenas formato ilustrativo. Os valores oficiais devem ser
aprovados antes da implementação e não devem ser embutidos no mapper sem uma
versão de perfil.

## Regras de aplicação

1. Preservar sempre o valor desktop original.
2. Aplicar a política somente aos campos que o perfil declarar.
3. Não substituir uma configuração responsiva comprovada por frame quando ela
   existir.
4. Permitir exceção por elemento, tag ou `css_id`.
5. Não criar imagem mobile inexistente; reutilizar o asset desktop e registrar a
   origem `responsive-policy`.
6. Gerar somente controles responsivos nativos do Elementor compatíveis com a
   versão detectada.
7. Quando um campo não tiver representação nativa, manter o desktop e gerar um
   aviso no relatório.
8. Manter a política e suas origens fora dos settings desconhecidos enviados ao
   Elementor, usando o sidecar `document.figmentor`.

## Compatibilidade com as tarefas existentes

| Situação | Tarefa responsável |
|---|---|
| Há frame mobile/tablet no Figma | 00.04 + 01.08 |
| Só há frame desktop e perfil base aprovado | 01.12 |
| Exceção editorial/manual | 00.05 + sidecar |
| Campo sem controle responsivo nativo | 01.12 gera flag; não inventa CSS |

## Interface futura da extensão

Na etapa de preparação do Figma, oferecer:

- `Sem política responsiva`;
- `Usar perfil base`;
- `Usar perfil base e revisar`;
- seleção futura de frames mobile/tablet, quando disponíveis.

O painel deve mostrar um resumo dos valores que serão aplicados antes do JSON
ser gerado e permitir baixar o perfil junto ao relatório.

## Testes obrigatórios

- desktop sem frame mobile gera settings responsive do perfil;
- desktop sem política mantém o comportamento atual;
- padding de seção é aplicado por breakpoint;
- gap de container é aplicado por breakpoint;
- heading/body/button recebem escala tipográfica configurada;
- containers horizontais empilham somente quando o perfil declarar;
- desktop original não é alterado;
- exceção por `css_id` vence o perfil global;
- frame mobile real vence a política base;
- imagem desktop é reutilizada e marcada como fallback;
- campo não suportado gera flag rastreável;
- JSON continua válido e persistente no Elementor.

## Critérios de aceite

- A extensão consegue gerar uma versão mobile/tablet útil sem frame adicional.
- Nenhuma regra é apresentada como extraída do Figma quando veio da política.
- O usuário consegue revisar o perfil antes da inserção.
- Os valores responsive são compatíveis com o Elementor instalado.
- A saída mantém desktop, sidecar, origens e relatório auditáveis.

**Estado:** proposta de tarefa futura. Não implementada na Fase 02.
