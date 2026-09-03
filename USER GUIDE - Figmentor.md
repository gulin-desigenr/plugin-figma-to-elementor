---
tags:
  - documentação
  - figmentor
  - bridge
fase: 02
status: aprovada
---

# Guia de uso — Figmentor Bridge

## 1. Visão geral

O Figmentor traduz layouts do Figma para conteúdo nativo do Elementor. Desde a
Fase 02, o produto é dividido em:

- **plugin Figma mínimo:** aplica tags e papéis, grava plugin data e registra o
  frame selecionado;
- **extensão Chrome:** lê a API do Figma, gera o documento, processa assets, usa
  a sessão WordPress aberta, salva no Elementor e verifica o rascunho depois de
  recarregar.

O objetivo é reduzir a reconstrução manual de hierarquia, Flexbox, spacing,
tipografia, cores e mídia. A extensão informa limitações; ela não deve apresentar
uma perda de asset como sucesso completo.

## 2. Arquitetura

```text
[Figma Plugin]
  tags + roles + sharedPluginData + seleção registrada
       ↓
[Figma REST API]
       ↓
[Adapter REST]
       ↓
[Motor compartilhado: traverse + handlers + styles]
       ↓
[Documento Elementor + sidecar Figmentor]
       ↓
[Assets: WebP / SVG / Font Awesome]
       ↓
[WordPress Media REST API]
       ↓
[Elementor AJAX: get_document_config + save_builder]
       ↓
[Draft + reload + verificação]
```

O adapter em `extension/src/figma-rest-adapter.js` apresenta os nós REST ao
mesmo motor usado pelo plugin. Assim, a extensão não possui um segundo mapper
simplificado.

## 3. Pré-requisitos

- Figma Desktop ou Web com permissão para editar o arquivo;
- token pessoal do Figma com `file_content:read`;
- permissão `selections:read` para detectar a seleção atual automaticamente;
- Chrome ou Chromium com a extensão carregada sem compactação;
- WordPress e Elementor abertos e autenticados em uma aba `wp-admin`;
- permissão do WordPress para cada tipo de mídia que será enviado.

## 4. Instalação

### 4.1 Build

Na raiz do projeto:

```bash
npm ci
npm run check
```

O comando gera `dist/code.js` e `extension/dist/popup.js` e executa os testes.

### 4.2 Plugin Figma

1. Abra o Figma Desktop.
2. Vá a **Plugins → Development → Import plugin from manifest**.
3. Escolha o `manifest.json` da raiz.
4. Execute o plugin em **Plugins → Development**.

### 4.3 Extensão Chrome

1. Abra `chrome://extensions`.
2. Ative o modo desenvolvedor.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `extension/`.
5. Depois de um novo build, clique em **Recarregar** no card da extensão.

## 5. Preparar o Figma

### 5.1 Página

1. Escolha **Criar uma página** no plugin.
2. Marque a raiz com `page-wrapper`.
3. Marque cada seção principal com `container`.
4. Use `container-full` nos containers internos que devem ocupar 100%.
5. Aplique tags de widget e papéis internos.
6. Selecione novamente a raiz. O plugin registra essa seleção.

`page-wrapper` é um pseudo-wrapper: organiza a página no Figma, mas seus filhos
são incorporados diretamente no `content` do Elementor.

### 5.2 Seção

1. Escolha **Criar uma seção**.
2. Marque o frame raiz com `container`.
3. Aplique tags e papéis nos descendentes.
4. Selecione novamente a raiz para registrá-la.

No destino, a extensão lê o documento existente e acrescenta a seção ao final.

## 6. Tags e papéis

### Tags estruturais e widgets

| Tag | Resultado |
|---|---|
| `page-wrapper` | raiz lógica de página, achatada em `content` |
| `container` | Flexbox container boxed/estrutural |
| `container-full` | Flexbox container full-width |
| `heading` | Heading |
| `text-editor` | Text Editor |
| `image` | Image com mídia nativa |
| `image-background` | background de container |
| `image-box` | Image Box |
| `icon-box` | Icon Box |
| `icon-list` | Icon List |
| `button` | Button |
| `accordion` | Accordion clássico |
| `accordeon` | Nested Accordion |
| `image-carousel` | Image Carousel |
| `container-carousel` | Nested Carousel experimental |
| `ignore` | omite o nó |

### Papéis internos

- `title_text`;
- `description_text`;
- `icon`;
- `image`.

O plugin grava os papéis em `elementor_role` e mantém prefixos nos nomes, como
`[TITLE]`, `[DESCRIPTION]`, `[ICON]` e `[IMAGE]`.

## 7. Executar o Bridge

1. Abra o painel lateral **Figmentor Bridge**.
2. Informe o token pessoal do Figma.
3. Informe a URL do arquivo Figma.
4. Clique em **Detectar seleção atual do Figma**.
5. Se a rota de seleção não estiver disponível, use o frame registrado pelo
   plugin ou uma URL com `node-id`.
6. Clique em **Ler frame registrado ou indicado pela URL**.
7. Confira o nome da origem, modo e quantidade de assets.
8. Avance para Elementor.
9. Selecione **Página** ou **Seção**.
10. Clique em **Detectar aba WordPress**.
11. Confira o post detectado e confirme **Inserir no Elementor**.

O botão de inserção só fica disponível quando o documento e a sessão WordPress
estão válidos.

## 8. Assets

### 8.1 Imagens e backgrounds

A extensão solicita um PNG ao Figma e procura combinações de escala e qualidade
para produzir WebP com alvo máximo de 150 KB. O resultado enviado ao Elementor
usa o formato nativo:

```json
{
  "id": 606,
  "url": "https://site/wp-content/uploads/.../arquivo.webp",
  "size": "full"
}
```

Se o teto não for atingível, o melhor candidato é preservado e a ocorrência é
reportada sem interromper o restante do fluxo.

### 8.2 Ícones

- Um nome reconhecido como Font Awesome gera `selected_icon` nativo.
- Um vetor personalizado é exportado e enviado como SVG real.
- O WordPress pode bloquear SVG. Nesse caso, o item falha, permanece no relatório
  e fica disponível para retry. Enquanto o upload não for confirmado, o
  Elementor recebe o placeholder explícito `fas fa-check` em vez de um SVG vazio.
  O relatório informa que o placeholder foi aplicado e identifica o vetor original.

### 8.3 Retry

Falhas não cancelam os assets seguintes. Depois de corrigir limite, MIME,
permissão ou configuração do servidor, clique em **Repetir somente assets
falhos**. O retry não consegue contornar sozinho uma política ativa do WordPress.

## 9. Metadados e contrato Elementor

Campos renderizados (`image`, `background_image`, `carousel`, `selected_icon`)
contêm apenas valores aceitos pelo Elementor. A rastreabilidade (`assetRef`,
`nodeId`, tipo e estado) fica em `document.figmentor`, separada dos settings
nativos.

Antes da inserção, a extensão valida:

- envelope de página ou container;
- IDs únicos e `isInner`;
- containers, widgets e `widgetType`;
- `css_id` globalmente único;
- formato das mídias nativas;
- ausência de `assetRef` misturado aos controles nativos.

## 10. Salvamento como rascunho

A extensão usa endpoint e nonces expostos pela página administrativa. Ela não
depende de `window.elementor`, `window.elementorCommon` ou
`window.elementorFrontend`.

Durante a inserção:

1. valida a sessão;
2. envia os assets;
3. força o post para `draft` pela REST API do WordPress;
4. lê o documento Elementor atual;
5. substitui a página ou anexa a seção;
6. salva com `save_builder`;
7. exige resposta positiva e status `draft`;
8. recarrega a aba;
9. verifica novamente os IDs de elementos e mídias.

Não considere sucesso se a interface confirmar somente JSON ou upload. A
mensagem esperada termina com a confirmação de persistência após recarregar.

## 11. Relatório

Cada asset mostra:

- nome e `nodeId` Figma;
- elemento/uso (`image`, `background`, `icon-box`, `icon-list` etc.);
- sucesso com ID de mídia ou falha com ação recomendada;
- disponibilidade para retry.

O relatório pode ser baixado e deve acompanhar qualquer diagnóstico de perda
visual.

## 12. Solução de problemas

### Seleção atual não detectada

- mantenha o plugin Figma aberto;
- confirme `selections:read` no token;
- selecione uma única raiz válida;
- use o frame registrado ou uma URL com `node-id` como fallback.

### Botão de inserir desabilitado

- conclua a leitura do frame;
- abra o editor Elementor em uma aba autenticada;
- clique em **Detectar aba WordPress**;
- conceda a permissão de host solicitada pela extensão.

### SVG falha

Confirme se o WordPress aceita `image/svg+xml` para o usuário atual. Instalar ou
configurar suporte seguro a SVG é uma decisão do site. Depois da correção, use o
retry. Não converta automaticamente o vetor para PNG se a exigência é SVG real.

### Status retorna `publish`

Recarregue a versão atual da extensão. A Fase 02 altera o post explicitamente
para `draft` antes do `save_builder` e recusa sucesso sem confirmação.

### Imagem existe, mas está visualmente incorreta

Confira crop, dimensões do widget/container, `background_position`,
`background_size`, bordas e a composição do node exportado. O upload correto não
garante, sozinho, paridade visual.

## 13. Evidência de aceite da Fase 02

Em 2026-08-03, o fluxo real concluiu:

```text
Assets enviados: 8/19
Elementor salvo como rascunho (6 elemento(s)).
Persistência confirmada após recarregar (50 IDs verificados).
```

As mídias 605–612 foram criadas. Onze SVGs foram recusados pelo WordPress e
continuaram no relatório. O resultado foi aprovado para a Fase 02, com o
refinamento visual de imagens e a política de SVG registrados como limitações.

## 14. Próximas frentes

- fidelidade de crop, composição e posicionamento de imagens/backgrounds;
- diagnóstico mais específico para rejeição de SVG no servidor;
- aceite visual dos gradientes, fills, strokes e sombras compostas da tarefa
  00.03 em uma instalação Elementor real;
- responsividade baseada em frames/regras aprovadas;
- validação visual sistemática dos widgets complexos.

Veja [docs/FASE-02-BRIDGE.md](docs/FASE-02-BRIDGE.md) para o registro técnico.
