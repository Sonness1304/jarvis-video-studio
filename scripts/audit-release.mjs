import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

const SENSITIVE_PATTERNS = [
  /C:[/\\]Users[/\\]luong/i,
  new RegExp(['night','lorris'].join(''), 'i'),
  /ghp_[a-zA-Z0-9]{30,}/,
  /sk-[a-zA-Z0-9]{20,}/,
  /xox[baprs]-[a-zA-Z0-9]{10,}/,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/
];

async function walk(dir) {
  let files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    if (entry.isDirectory()) {
      files = files.concat(await walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function audit() {
  console.log('--- Running Pre-Publication Audit on Jarvis Video Studio ---');
  const files = await walk(ROOT);
  console.log(`Scanning ${files.length} project files...`);

  let violations = 0;
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const stat = await fs.stat(file);

    // 1. File size check (< 10MB)
    if (stat.size > 10 * 1024 * 1024) {
      console.error(`VIOLATION: File too large (>10MB): ${rel} (${stat.size} bytes)`);
      violations++;
    }

    // 2. Sensitive content check for text files
    const isBinary = /\.(png|jpg|jpeg|gif|ico|webp|ttf|woff|woff2|dll|exe|mp4|wav)$/i.test(file);
    if (!isBinary) {
      const content = await fs.readFile(file, 'utf8');
      for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(content)) {
          console.error(`VIOLATION: Matched sensitive pattern ${pattern} in ${rel}`);
          violations++;
        }
      }
    }
  }

  if (violations === 0) {
    console.log('AUDIT PASSED: 0 sensitive leaks or oversized binaries found.');
    return true;
  } else {
    console.error(`AUDIT FAILED: ${violations} violations found.`);
    process.exit(1);
  }
}

audit().catch(err => {
  console.error(err);
  process.exit(1);
});