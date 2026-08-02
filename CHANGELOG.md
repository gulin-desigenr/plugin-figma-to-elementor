# Changelog

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
