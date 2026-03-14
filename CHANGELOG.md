# Changelog

Todas as mudanças notáveis do projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto segue [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [0.4.0] - 2025-02-15

### Corrigido
- Erro de extração de propriedades mistas (`figma.mixed`) no `cornerRadius` e `strokeWeight`
- Crash ao processar nós com bordas individuais diferentes

---

## [0.3.0] - 2025-02-12

### Adicionado
- Sistema de tagging manual via UI
- Export de JSON com download automático
- Suporte a widgets: `heading`, `text-editor`, `image`, `image-box`, `icon-list`
- Suporte a containers: `container` (boxed 1140px) e `container-full` (100%)
- Detecção automática de layout direction (horizontal/vertical)
- Extração de estilos: background, borders, border-radius, shadows
- Mapeamento de font-weight (Thin a Black)
- Inteligência espacial para detectar direção de layouts sem Auto Layout

---

## [0.1.0] - 2025-02-12

### Adicionado
- Estrutura inicial do plugin
- Manifesto Figma (`manifest.json`)
- Primeiro commit do projeto
