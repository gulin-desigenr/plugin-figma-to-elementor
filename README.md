# Figmentor — Figma to Elementor

> Traducao estrutural de layout do Figma para o Elementor, com foco em hierarquia, spacing, tipografia, cores e composicao nativa de containers.

![Status](https://img.shields.io/badge/status-v1.2.0-blue)
![Figma](https://img.shields.io/badge/plataforma-Figma-purple)
![Elementor](https://img.shields.io/badge/destino-Elementor-red)

---

## 📋 Sumário

- [O que faz](#o-que-faz)
- [Como funciona](#como-funciona)
- [Instalação](#-instalação)
- [Tags suportadas](#tags-suportadas)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Estrutura do JSON Exportado](#-estrutura-do-json-exportado)
- [Branches](#-branches)
- [Roadmap](#-roadmap)
- [Contribuição](#-contribuição)
- [Licença](#-licença)

---

## O que faz

O Figmentor permite que você:

1. **Tagueie** elementos no Figma com widgets e containers estruturais do Elementor
2. **Exporte** toda a estrutura como um JSON compatível com Elementor
3. **Importe** o JSON diretamente no Elementor para recriar o layout-base
4. **Baixe** o JSON gerado para importá-lo manualmente no Elementor

### Essencia do produto

O Figmentor nao tenta mais prometer traducao visual completa de uma pagina.

O foco do projeto e:

- traduzir a estrutura do frame em Auto Layout para a estrutura real do Elementor
- preservar hierarquia, ordem, containers, spacing, larguras, alturas e alinhamentos
- preservar tipografia, cores de texto, backgrounds nativos, bordas e sombras quando houver suporte confiavel
- deixar imagens, icones e uploads de assets fora do fluxo principal

### O que e preservado na conversao

| Propriedade | Status |
|---|---|
| Layout (direction, gap, padding) | ✅ |
| Cores de fundo | ✅ |
| Tipografia (tamanho, peso, cor) | ✅ |
| Bordas e border-radius | ✅ |
| Sombras (drop shadow) | ✅ |
| Larguras (fixed/fill) | ✅ |
| Alturas e min-height estruturais | ✅ |
| Imagens e icones reais | Fora do escopo principal |

---

## Como funciona

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Figma      │────▶│  Figmentor   │────▶│  JSON          │
│  Auto Layout│     │  (tagging)   │     │  Elementor     │
└─────────────┘     └──────────────┘     └───────────────┘
```

1. Abra o plugin no Figma
2. Escolha se o trabalho é uma **seção** ou uma **página**
3. Selecione elementos e aplique tags com os botões
4. Selecione o frame principal
5. Clique **"GERAR E BAIXAR JSON"**
6. Importe o `.json` no Elementor
7. Faça o upload manual de imagens e icones, quando necessario
8. Ajuste manualmente imagens e detalhes finais no Elementor, se necessário

### Modos de exportação

**Criar uma seção** exige que o frame principal tenha a tag `container`.
Nesse modo, a tag `page-wrapper` fica oculta. A tag `container-full` continua
disponível para containers internos.

**Criar uma página** exige que o frame principal tenha a tag `page-wrapper`.
O wrapper organiza as seções, mas não é exportado como um elemento Elementor.
O JSON usa `type: "page"` e `page_settings: {}` para preservar as configurações
globais do WordPress, Elementor e Hello Elementor.

### Fluxo recomendado

`Plugin Figma to Elementor -> mapeia a estrutura no Figma -> gera JSON -> upload manual do JSON no Elementor`

### Validação de importação

O fluxo foi validado manualmente no WordPress com os dois formatos de saída:

- JSON de página, gerado pelo modo `Criar uma página`;
- JSON de seção, gerado pelo modo `Criar uma seção`.

Ambos foram importados com sucesso no Elementor. O modo página utiliza
`page_settings: {}` e mantém as configurações gerais do WordPress, Elementor e
Hello Elementor. Imagens e outros assets continuam sendo preenchidos
manualmente após a importação.

---

## 🚀 Instalação

### Modo Desenvolvimento (Figma Desktop)

1. Clone o repositório:
   ```bash
   git clone https://github.com/gulin-desigenr/plugin-figma-to-elementor.git
   ```
2. Abra o **Figma Desktop**
3. Vá em **Menu → Plugins → Development → Import plugin from manifest...**
4. Selecione o arquivo `manifest.json` deste repositório
5. O plugin aparecerá em **Plugins → Development**

### Build e validação local

```bash
npm ci
npm run check
```

O comando `check` gera `dist/code.js` e executa os testes smoke do projeto. O arquivo `dist/code.js` é versionado porque é o bundle carregado pelo `manifest.json`.

## Tags suportadas

### Estrutura principal

| Tag | Descrição | Elementor |
|---|---|---|
| `container` | Seção com largura boxed (1140px) | Container boxed |
| `container-full` | Container filho 100% full-width | Container full |

### Conteudo estrutural

| Tag | Descrição | Elementor |
|---|---|---|
| `heading` | Título — texto com fonte ≥32px é auto-detectado | Heading widget |
| `text-editor` | Bloco de texto — texto com fonte <32px é auto-detectado | Text Editor widget |
| `accordion` | Sanfona com itens expansíveis | Accordion widget |
| `accordeon` | Accordeon com containers aninhados por item | Nested Accordion widget |
| `button` | CTA textual e estrutural | Button widget |

### Fora do escopo principal

As estruturas abaixo continuam disponíveis na UI, mas não fazem parte do fluxo
estrutural principal:

- widgets de imagem
- widgets baseados em icone
- uploads de assets
- collage, hero media e composicao visual dependente de imagem

---

## 📁 Estrutura do Projeto

```
plugin-figma-to-elementor/
├── .github/workflows/ci.yml # Validação automática no GitHub
├── .editorconfig         # Convenções de edição
├── manifest.json        # Manifesto do plugin Figma
├── src/                 # Código modular do backend Figma
├── tests/                # Testes smoke e contratos básicos
├── dist/code.js         # Bundle carregado pelo manifesto
├── ui.html              # Frontend — interface de tagging
├── .gitignore           # Arquivos ignorados pelo Git
├── README.md            # Este arquivo
├── AUDITORIA_TECNICA_EXPORTACAO.md # Base da auditoria do exportador
├── CONTRIBUTING.md      # Guia de contribuição
└── USER GUIDE - Figmentor.md # Guia de uso
```

---

## 📦 Estrutura do JSON Exportado

```json
{
  "version": "0.4",
  "title": "Export V16 Width Fix - Nome do Frame",
  "type": "container",
  "content": [
    {
      "id": "c1a2b3c",
      "elType": "container",
      "isInner": false,
      "settings": {
        "content_width": "boxed",
        "flex_direction": "column",
        "gap": { "column": 20, "row": 20, "unit": "px" },
        "padding": { "top": 40, "right": 20, "bottom": 40, "left": 20, "unit": "px" }
      },
      "elements": [
        {
          "id": "w4d5e6f",
          "elType": "widget",
          "widgetType": "heading",
          "isInner": true,
          "settings": {
            "title": "Meu Título",
            "title_color": "rgba(26,26,26,1)",
            "typography_font_size": { "size": 48, "unit": "px" }
          }
        }
      ]
    }
  ]
}
```

No modo página, o envelope usa `type: "page"`, inclui `page_settings: {}` e
mantém as configurações gerais do site. Elementos exportados recebem IDs
estáveis e `isInner` conforme sua posição na hierarquia.

---

## 🌿 Branches

| Branch | Propósito |
|---|---|
| `main` | Produção — código estável e testado |
| `dev` | Desenvolvimento — integração de features |
| `feature/*` | Features individuais |
| `fix/*` | Correções de bugs |

> **Regra**: nunca commitar direto na `main`. Todo trabalho segue `feature/* → dev → main`.

---

## Roadmap

- [x] v0.1 — Estrutura base e tagging manual
- [x] v0.4 — Correção de propriedades mistas (`figma.mixed`)
- [ ] v0.5 — Refino da traducao estrutural de spacing, sizing e tipografia
- [ ] v0.6 — Fortalecimento da exportação estrutural para layout responsivo
- [ ] v0.7 — Suporte a gradientes e múltiplos fills
- [ ] v1.0 — Melhorias de importação manual e validação do JSON

---

## 🤝 Contribuição

Veja o [CONTRIBUTING.md](CONTRIBUTING.md) para detalhes sobre como contribuir.

---

## 📄 Licença

Projeto privado. Todos os direitos reservados.
