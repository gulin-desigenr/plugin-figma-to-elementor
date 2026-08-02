import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

  assert.match(traversal, /manualTag === 'image-background'/);
});

test('audit baseline is part of the repository', () => {
  const audit = read('AUDITORIA_TECNICA_EXPORTACAO.md');

  assert.match(audit, /Contrato de saída/);
  assert.match(audit, /Fixtures de entrada/);
  assert.match(audit, /Ciclo de desenvolvimento focado/);
});
