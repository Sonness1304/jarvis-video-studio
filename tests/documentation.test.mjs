import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

test('documentation, license, and public assets exist and are valid', async () => {
  const license = await fs.readFile(path.join(ROOT, 'LICENSE'), 'utf8');
  assert.ok(license.includes('MIT License'));
  assert.ok(license.includes('Sonness1304'));

  const thirdParty = await fs.readFile(path.join(ROOT, 'THIRD-PARTY.md'), 'utf8');
  assert.ok(thirdParty.includes('GSAP'));
  assert.ok(thirdParty.includes('HyperFrames'));
  assert.ok(thirdParty.includes('Apache-2.0'));

  const readme = await fs.readFile(path.join(ROOT, 'README.md'), 'utf8');
  assert.ok(readme.includes('# Jarvis Video Studio'));
  assert.ok(readme.includes('npm install'));
  assert.ok(readme.includes('npm start'));
  assert.ok(readme.includes('Architecture'));
  assert.ok(readme.includes('License'));

  // Check relative links in README
  for (const match of readme.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    const link = match[2].split('#')[0];
    if (!link || link.startsWith('http://') || link.startsWith('https://') || link.startsWith('mailto:')) continue;
    const resolved = path.resolve(ROOT, link);
    const exists = await fs.stat(resolved).then(() => true, () => false);
    assert.ok(exists, `Link ${link} in README must exist`);
  }

  const svg = await fs.readFile(path.join(ROOT, 'docs/architecture.svg'), 'utf8');
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('</svg>'));

  assert.ok(await fs.stat(path.join(ROOT, 'CONTRIBUTING.md')).then(() => true, () => false));
  assert.ok(await fs.stat(path.join(ROOT, 'SECURITY.md')).then(() => true, () => false));
  assert.ok(await fs.stat(path.join(ROOT, '.github/ISSUE_TEMPLATE/bug_report.md')).then(() => true, () => false));
  assert.ok(await fs.stat(path.join(ROOT, '.github/ISSUE_TEMPLATE/feature_request.md')).then(() => true, () => false));
});