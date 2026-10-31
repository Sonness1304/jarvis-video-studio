import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TESTS_DIR = path.join(ROOT, 'tests');

// Tests that strictly require pre-installed native machine tools (local FFmpeg, local python venv, GPU, or C# desktop apps)
const NATIVE_ONLY_TESTS = new Set([
  'cache-native.test.mjs',
  'decode-native.test.mjs',
  'dubbing-native.test.mjs',
  'dubbing-v2-native.test.mjs',
  'gpu.test.mjs',
  'process.test.mjs',
  'stability-a1.test.mjs',
  'studio-launcher.test.mjs',
  'voicestudio.test.mjs',
  'desktop-build.test.mjs'
]);

async function main() {
  const allFiles = await readdir(TESTS_DIR);
  const testFiles = allFiles
    .filter(f => f.endsWith('.test.mjs'))
    .filter(f => process.env.RUN_ALL_TESTS === '1' || !NATIVE_ONLY_TESTS.has(f))
    .map(f => path.join('tests', f));

  console.log(`Running ${testFiles.length} test suites (mode: ${process.env.RUN_ALL_TESTS === '1' ? 'all' : 'portable & CI'})...`);

  const child = spawn(process.execPath, ['--test', ...testFiles], {
    cwd: ROOT,
    stdio: 'inherit'
  });

  child.on('exit', code => {
    process.exit(code ?? 0);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});