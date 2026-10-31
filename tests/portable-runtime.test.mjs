import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

test('readVoices falls back gracefully when runtime-config.json is absent', async () => {
  const { readVoices, canonicalVoice } = await import('../src/studio.mjs');
  const voices = await readVoices(ROOT);
  assert.ok(Array.isArray(voices));
  assert.ok(voices.length > 0);
  assert.ok(voices.some(v => v.name === 'Hải Đăng'));
  assert.equal(canonicalVoice('Hải Đăng', voices), 'Hải Đăng');
});

test('editor server starts in demo mode without machine runtime config', async () => {
  const { startEditor } = await import('../src/editor-server.mjs');
  const server = await startEditor({ root: ROOT, port: 0 });
  try {
    assert.ok(server.url.startsWith('http://127.0.0.1:'));
    const res = await fetch(server.url + '/');
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('<html lang="en">'));
  } finally {
    await server.close();
  }
});