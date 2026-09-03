import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { annotateExportContent, validateExportDocument } from '../src/core/contract.js';
import {
  FIGMENTOR_SELECTION_KEY,
  createSelectionRecord,
  isSupportedRootNode,
  serializeSelectionRecord
} from '../src/core/selection.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('manifest points to an existing Figma runtime', () => {
  const manifest = JSON.parse(read('manifest.json'));

  assert.equal(manifest.main, 'dist/code.js');
  assert.equal(manifest.ui, 'ui.html');
  assert.deepEqual(manifest.editorType, ['figma']);
  assert.ok(fs.existsSync(path.join(projectRoot, manifest.main)));
  assert.ok(fs.existsSync(path.join(projectRoot, manifest.ui)));
});

test('source and bundle expose the Figma plugin entrypoint', () => {
  const source = read('src/index.js');
  const bundle = read('dist/code.js');

  for (const content of [source, bundle]) {
    assert.match(content, /figma\.showUI/);
    assert.match(content, /figma\.ui\.onmessage/);
    assert.match(content, /export-json/);
  }
});

test('UI tags have corresponding backend handling', () => {
  const ui = read('ui.html');
  const handlers = read('src/core/handlers.js');
  const traversal = read('src/core/traverse.js');

  const tags = [
    'page-wrapper',
    'container',
    'container-full',
    'heading',
    'image',
    'image-background',
    'accordion',
    'accordeon',
    'image-box',
    'icon-box',
    'icon-list',
    'text-editor',
    'button',
    'image-carousel',
    'container-carousel'
  ];

  for (const tag of tags) {
    assert.match(ui, new RegExp(`applyTag\\('${tag}'\\)`));
  }

  for (const tag of tags.filter(tag => tag !== 'image-background')) {
    assert.match(handlers, new RegExp(`tag === ['"]${tag}['"]|['"]${tag}['"]`));
  }

  assert.match(handlers, /tag === 'image-background'/);
});

test('UI exposes the approved section and page modes', () => {
  const ui = read('ui.html');
  const source = read('src/index.js');

  assert.match(ui, /selectExportMode\('section'\)/);
  assert.match(ui, /selectExportMode\('page'\)/);
  assert.match(ui, /id="tag-page-wrapper"/);
  assert.match(ui, /exportMode: currentExportMode/);
  assert.match(source, /exportMode === "section"/);
  assert.match(source, /exportMode === "page"/);
  assert.match(source, /page_settings: \{\}/);
});

test('selection connector defines a stable frame registration record', () => {
  const frame = {
    id: '12:34',
    name: '[CONTAINER] Hero',
    type: 'FRAME'
  };

  assert.equal(FIGMENTOR_SELECTION_KEY, 'figmentor-selected-root');
  assert.equal(isSupportedRootNode(frame), true);
  assert.equal(isSupportedRootNode({ ...frame, type: 'TEXT' }), false);
  assert.deepEqual(createSelectionRecord(frame, '2026-08-02T12:00:00.000Z'), {
    version: 1,
    nodeId: '12:34',
    name: '[CONTAINER] Hero',
    type: 'FRAME',
    registeredAt: '2026-08-02T12:00:00.000Z'
  });
  assert.doesNotThrow(() => JSON.parse(serializeSelectionRecord(frame)));
});

test('Figma runtime listens for selection changes', () => {
  const source = read('src/index.js');
  const ui = read('ui.html');

  assert.match(source, /figma\.on\('selectionchange'/);
  assert.match(source, /frame-selection-synced/);
  assert.match(ui, /frame-selection-synced/);
});

test('export contract annotates stable metadata and validates page output', () => {
  const content = annotateExportContent([
    {
      elType: 'container',
      settings: { css_id: 'section' },
      elements: [
        {
          elType: 'widget',
          widgetType: 'heading',
          settings: { title: 'Título', css_id: 'section' }
        }
      ]
    }
  ]);

  const document = {
    version: '0.4',
    type: 'page',
    page_settings: {},
    content
  };
  const validation = validateExportDocument(document, 'page');

  assert.equal(validation.valid, true);
  assert.match(content[0].id, /^c[a-z0-9]{6}$/);
  assert.equal(content[0].isInner, false);
  assert.equal(content[0].elements[0].isInner, true);
  assert.equal(content[0].elements[0].settings.css_id, 'section-2');
});

test('export contract avoids collisions with existing suffixed css ids', () => {
  const content = annotateExportContent([
    { elType: 'widget', widgetType: 'heading', settings: { css_id: 'hero' } },
    { elType: 'widget', widgetType: 'heading', settings: { css_id: 'hero' } },
    { elType: 'widget', widgetType: 'heading', settings: { css_id: 'hero-2' } }
  ]);

  assert.deepEqual(
    content.map(element => element.settings.css_id),
    ['hero', 'hero-2', 'hero-2-2']
  );
});

test('export contract rejects invalid mode envelopes and malformed elements', () => {
  const validation = validateExportDocument({
    version: '0.4',
    type: 'container',
    content: [null]
  }, 'page');

  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(' '), /type deve ser "page"/);
  assert.match(validation.errors.join(' '), /deve ser um objeto/);
  assert.match(validation.errors.join(' '), /page_settings deve ser um objeto/);
});

test('audit baseline is part of the repository', () => {
  const audit = read('AUDITORIA_TECNICA_EXPORTACAO.md');

  assert.match(audit, /Contrato de saída/);
  assert.match(audit, /Fixtures de entrada/);
  assert.match(audit, /Ciclo de desenvolvimento focado/);
});
