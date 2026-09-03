# Changelog

## [Unreleased] — Fase 02 aprovada em 2026-08-03

### Fixed

- Corrigido crash do editor Elementor ao abrir `icon-list` com SVG personalizado
  recusado pelo WordPress.
- Impedido o envio de `selected_icon` com `library: "svg"` e mídia vazia.
- Adicionado placeholder explícito `fas fa-check` para SVG pendente ou falho,
  mantendo a falha no relatório e o retry disponível.
- Adicionada validação semântica para rejeitar ícones SVG sem `id` e `url`.
- Adicionada validação semântica para rejeitar mídia nativa (imagem e background) sem `id` e `url`.
- Adicionados testes de regressão para `icon-list`, SVG falho e placeholder.

### Added

- Added the Chrome Manifest V3 extension `Figmentor Bridge` (version 0.2.1).
- Added Figma REST selection/registered-frame reading and a REST node adapter.
- Added reuse of the plugin traversal, handlers and style engine inside the extension bundle.
- Added raster discovery, WebP conversion with a 150 KB target, real SVG export and WordPress media upload.
- Added native Elementor media fields plus a separate `document.figmentor` metadata sidecar.
- Added asset failure reporting and retry-only-failed processing.
- Added WordPress/Elementor tab probing using the authenticated browser session.
- Added `elementor_ajax`/`save_builder` persistence, explicit draft transition and post-reload verification.
- Added semantic validation and regression coverage for the complete bridge workflow.

### Changed

- Changed the product architecture from a standalone JSON exporter to a minimal Figma plugin plus Chrome orchestration extension.
- Changed page insertion to replace the current page and section insertion to append after existing elements.
- Changed image, background, carousel and icon settings to use native Elementor media objects.
- Kept Font Awesome native while treating custom vectors as SVG assets.

### Validation

- `npm run check` passes with 37 tests.
- A real Figma → WordPress → Elementor page flow saved 6 top-level elements as a draft.
- Persistence was confirmed after reload with 50 element IDs verified.
- 8 of 19 assets were uploaded as WordPress media IDs 605–612.
- 11 SVG uploads were rejected by the test WordPress and remained visible in the retryable report.
- The user approved the Fase 02 result with image fidelity and WordPress SVG policy recorded as follow-up limitations.

## [1.2.0] — 2026-08-02

### Added

- Added the initial export-mode screen with `Criar uma seção` and `Criar uma página`.
- Added explicit `container` and `page` output envelopes.
- Added `page_settings: {}` for page exports so WordPress, Elementor and Hello Elementor defaults remain in control.
- Added structural export validation before JSON download.
- Added stable element IDs and `isInner` metadata.
- Added deterministic uniqueness handling for `css_id` values.
- Added regression tests for both export modes and contract validation.
- Documented successful manual WordPress/Elementor imports for page and section JSON files.

### Changed

- The page wrapper remains a manual Figma tag and is flattened into page content instead of being emitted as an Elementor element.
- The section mode requires a root `container` tag and hides the page-wrapper control.
- `container-full` now correctly emits full-width container settings.
- Updated the README, user guide and export contract documentation.

### Fixed

- Prevented export failures caused by collisions between existing and generated suffixed `css_id` values.

### Validation

- `npm run check` passes with 8 tests.
- UI script syntax validation passes.
- Section and page exports were verified structurally and imported successfully into WordPress/Elementor.
