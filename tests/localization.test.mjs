import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

test('UI and templates are localized to English', async () => {
  const indexHtml = await fs.readFile(path.join(ROOT, 'web/index.html'), 'utf8');
  assert.ok(indexHtml.includes('<html lang="en">'), 'html lang must be en');
  assert.ok(indexHtml.includes('Save Project'), 'Save Project button exists');
  assert.ok(indexHtml.includes('Export Video'), 'Export Video button exists');
  assert.ok(indexHtml.includes('Scenes'), 'Scenes tab exists');
  assert.ok(indexHtml.includes('Projects'), 'Projects tab exists');
  assert.ok(!indexHtml.includes('Lưu dự án'), 'Old Vietnamese save button removed');
  assert.ok(!indexHtml.includes('Xuất video'), 'Old Vietnamese export button removed');

  const { catalog } = await import('../src/studio.mjs');
  const template = catalog.templates.find(t => t.id === 'explain-short');
  assert.ok(template, 'explain-short template exists');
  assert.equal(template.name, 'Explain an Idea');
  assert.deepEqual(template.beats, ['The Question', 'The Explanation', 'Takeaway']);

  const demoBriefRaw = await fs.readFile(path.join(ROOT, 'briefs/demo-explainer.json'), 'utf8');
  const demoBrief = JSON.parse(demoBriefRaw);
  assert.equal(demoBrief.id, 'demo-explainer');
  assert.ok(demoBrief.scenes.length >= 3);
});