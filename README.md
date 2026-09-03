# Figmentor — Figma to Elementor

> Bridge local para traduzir um frame do Figma em conteúdo Elementor, enviar
> assets pela sessão WordPress aberta e salvar um rascunho cuja persistência é
> confirmada após recarregar.

![Fase](https://img.shields.io/badge/Fase%2002-aprovada-success)
![Plugin Figma](https://img.shields.io/badge/plugin-1.2.0-purple)
![Extensão Chrome](https://img.shields.io/badge/bridge-0.2.1-blue)

## Estado atual

A Fase 02 foi concluída e aprovada em 2026-08-03. O produto não é mais um
plugin monolítico que depende apenas de download e importação manual de JSON.
Ele possui dois runtimes:

- o **plugin Figma mínimo** aplica tags, salva `pluginData`/`sharedPluginData` e
  registra o frame;
- a **extensão Chrome Figmentor Bridge** lê a API do Figma, executa o mesmo motor
  estrutural, processa assets, usa a sessão WordPress aberta, salva pelo
  Elementor e confirma o rascunho após reload.

O registro técnico e a evidência de aceite estão em
[docs/FASE-02-BRIDGE.md](docs/FASE-02-BRIDGE.md).

## Pipeline

```text
Figma Plugin
  → tags, papéis e frame registrado
  → Figma REST API
  → adapter REST
  → traversal/handlers/styles compartilhados
  → JSON Elementor validado
  → assets WebP/SVG
  → WordPress Media REST API
  → Elementor elementor_ajax/save_builder
  → draft
  → reload e verificação de persistência
```

O motor compartilhado preserva `page-wrapper`, containers, `container-full`,
hierarquia, `isInner`, layout, padding, gap, tipografia, cores, bordas, sombras e
os widgets suportados. A extensão não mantém um mapper simplificado próprio.

## Responsabilidades

| Componente | Responsabilidade |
|---|---|
| Plugin Figma | Aplicar tags/papéis, persistir dados e registrar a seleção |
| `src/core/` e `src/styles/` | Converter a árvore para elementos e settings Elementor |
| Adapter REST | Oferecer ao motor compartilhado uma interface equivalente à Plugin API |
| Extensão Chrome | Orquestrar Figma, assets, WordPress, Elementor e relatório |
| WordPress | Armazenar mídia e manter o post como rascunho |
| Elementor | Salvar o conteúdo com `save_builder` |

## Instalação local

### Pré-requisitos

- Node.js e npm;
- Figma Desktop com permissão de edição no arquivo;
- token pessoal do Figma com `file_content:read` e, para seleção automática,
  `selections:read`;
- Chrome/Chromium;
- WordPress e Elementor abertos em uma sessão autenticada.

### Build e testes

```bash
npm ci
npm run check
```

`npm run check` gera os dois bundles e executa a suíte completa:

- `dist/code.js`: plugin Figma;
- `extension/dist/popup.js`: extensão Chrome.

### Plugin Figma

1. Abra o Figma Desktop.
2. Acesse **Plugins → Development → Import plugin from manifest**.
3. Selecione o `manifest.json` da raiz.
4. Abra o plugin, escolha Página ou Seção e aplique as tags.
5. Selecione a raiz para que o plugin registre o frame.

### Extensão Chrome

1. Abra `chrome://extensions`.
2. Ative o modo desenvolvedor.
3. Clique em **Carregar sem compactação** e selecione `extension/`.
4. Depois de qualquer alteração, rode `npm run build:extension` e clique em
   **Recarregar** no card da extensão.
5. Abra o painel lateral **Figmentor Bridge**.

## Fluxo de uso

1. No plugin Figma, aplique tags e selecione a raiz.
2. Na extensão, informe o token e a URL do arquivo.
3. Clique em **Detectar seleção atual do Figma**.
4. Leia o frame registrado ou indicado pela URL.
5. Revise o documento e avance para Elementor.
6. Mantenha a página de edição do Elementor aberta e autenticada.
7. Escolha **Página** para substituir o conteúdo ou **Seção** para acrescentar
   o conteúdo ao final.
8. Detecte a aba WordPress e confirme a inserção.
9. Revise o relatório de assets. Use **Repetir somente assets falhos** depois de
   corrigir a causa no servidor.
10. Considere o fluxo concluído somente quando a extensão confirmar `draft` e
    persistência após recarregar.

## Modos de saída

### Página

- a raiz usa `page-wrapper`;
- o wrapper não vira elemento Elementor; seus filhos entram em `content`;
- o envelope usa `type: "page"` e `page_settings: {}`;
- o conteúdo existente da página é substituído;
- o post é explicitamente alterado para rascunho.

### Seção

- a raiz usa `container`;
- o envelope usa `type: "container"`;
- o conteúdo atual é lido antes do save;
- os novos elementos são anexados ao final.

## Tags suportadas

| Tag | Saída Elementor | Estado na Fase 02 |
|---|---|---|
| `page-wrapper` | filhos em `content` | Operacional em modo página |
| `container` | Flexbox container | Operacional |
| `container-full` | Container full-width | Operacional |
| `heading` | Heading | Operacional |
| `text-editor` | Text Editor | Operacional |
| `image` | Image com mídia nativa | Operacional com limitações visuais |
| `image-background` | Background nativo do container | Operacional com limitações visuais |
| `image-box` | Image Box | Funcional com limitações |
| `icon-box` | Icon Box | Font Awesome nativo; SVG depende do WordPress |
| `icon-list` | Icon List | Font Awesome nativo; SVG depende do WordPress |
| `button` | Button | Funcional com limitações |
| `accordion` | Accordion | Funcional com limitações |
| `accordeon` | Nested Accordion | Funcional com limitações |
| `image-carousel` | Image Carousel | Mídias nativas; validação visual pendente |
| `container-carousel` | Nested Carousel | Experimental |
| `ignore` | nó omitido | Operacional |

## Assets e metadados

Os campos renderizados usam o schema nativo do Elementor:

```json
{
  "image": { "id": 606, "url": "https://site/.../logo.webp", "size": "full" },
  "background_image": { "id": 605, "url": "https://site/.../hero.webp", "size": "full" }
}
```

`assetRef`, `nodeId` e estado de processamento ficam no sidecar
`document.figmentor`, separados dos settings enviados ao Elementor.

- Raster: convertido para WebP com alvo máximo de 150 KB.
- Vetor personalizado: enviado como SVG real.
- Font Awesome: mantido como `selected_icon` nativo.
- Falha de asset: não aborta o documento; entra no relatório e pode ser repetida.

O WordPress pode bloquear SVG por política de MIME/segurança. O Figmentor não
envia SVG vazio ao Elementor. Enquanto um vetor personalizado estiver pendente ou
falhar no upload, `icon-box` e cada item de `icon-list` usam explicitamente o
placeholder Font Awesome `fas fa-check`, enquanto a falha permanece no relatório
e disponível para retry. O placeholder nunca é silencioso.

## Salvamento e confirmação

A extensão descobre endpoint e nonces na página administrativa. Ela não depende
de globais JavaScript internas do editor. O salvamento exige:

1. sessão e contexto válidos;
2. alteração REST explícita para `draft`;
3. `get_document_config` antes do save;
4. `save_builder` com resposta positiva;
5. status `draft` confirmado;
6. reload e nova leitura do documento;
7. presença dos IDs esperados de elementos e mídias.

## Validação da Fase 02

Validação automatizada: **47 testes aprovados**.

Validação integrada aprovada:

- 19 assets descobertos;
- 8 imagens/backgrounds enviados, mídias 605–612;
- 11 SVGs recusados pelo WordPress e corretamente reportados;
- 6 elementos superiores salvos;
- rascunho confirmado;
- persistência confirmada após reload, com 50 IDs verificados.

## Limitações conhecidas

- crop, composição, tamanho ou posicionamento de algumas imagens ainda requerem
  refinamento;
- SVG depende da permissão de upload do WordPress;
- gradientes e efeitos compostos estão implementados tecnicamente em CSS
  escopado, mas aguardam validação visual no Elementor real;
- múltiplos fills, strokes e shadows usam a matriz nativa/CSS/flag da tarefa
  00.03 e ainda aguardam validação visual;
- responsividade exige frames ou regras aprovadas e não é inferida livremente;
- widgets complexos ainda exigem validação visual caso a caso.

A responsividade por perfil base, sem frame mobile/tablet, está especificada como
tarefa futura em
[`docs/auditoria-exportador/01-12-responsividade-por-politica-base.md`](docs/auditoria-exportador/01-12-responsividade-por-politica-base.md).

## Estrutura do projeto

```text
.
├── manifest.json                 # plugin Figma
├── ui.html                       # UI de tags/registro/exportação local
├── src/
│   ├── index.js                  # entrada do plugin
│   ├── core/                     # contrato, traversal, handlers e seleção
│   ├── styles/                   # estilos Elementor
│   └── utils/
├── dist/code.js                  # bundle do plugin
├── extension/
│   ├── manifest.json             # Manifest V3
│   ├── popup.html / popup.js     # painel e orquestração
│   ├── src/                      # Figma REST, adapter, assets e WordPress
│   └── dist/popup.js             # bundle da extensão
├── tests/                        # testes do plugin e da extensão
└── docs/                         # decisões, auditoria e registro da Fase 02
```

## Desenvolvimento

Veja [CONTRIBUTING.md](CONTRIBUTING.md) e
[ELEMENTOR_WIDGET_MAPPING.md](ELEMENTOR_WIDGET_MAPPING.md). O histórico das
decisões e das tarefas está em [docs/auditoria-exportador](docs/auditoria-exportador/README.md).

## Licença

Projeto privado. Todos os direitos reservados.
