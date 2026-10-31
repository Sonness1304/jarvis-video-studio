#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

function which(cmd) {
  try {
    const isWin = process.platform === 'win32';
    const checkCmd = isWin ? `where ${cmd}` : `which ${cmd}`;
    const out = execSync(checkCmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
    return out.trim().split(/\r?\n/)[0];
  } catch {
    return null;
  }
}

async function main() {
  console.log('--- Jarvis Video Studio: Environment Setup & Detection ---');
  console.log('Operating System:', process.platform, process.arch);
  console.log('Node.js:', process.version);

  const ffmpeg = which('ffmpeg');
  const ffprobe = which('ffprobe');
  const python = which('python3') || which('python');
  const chrome = which('chrome') || which('google-chrome') || which('msedge');

  console.log('FFmpeg:', ffmpeg ? `FOUND (${ffmpeg})` : 'NOT FOUND (Required for local video rendering)');
  console.log('FFprobe:', ffprobe ? `FOUND (${ffprobe})` : 'NOT FOUND (Required for audio/video probe)');
  console.log('Python:', python ? `FOUND (${python})` : 'NOT FOUND (Required for local VieNeu TTS)');
  console.log('Browser/Chrome:', chrome ? `FOUND (${chrome})` : 'NOT FOUND (Required for HyperFrames rendering)');

  const configPath = path.join(ROOT, 'runtime-config.json');
  let exists = false;
  try {
    await fs.stat(configPath);
    exists = true;
  } catch {}

  if (!exists) {
    const examplePath = path.join(ROOT, 'runtime-config.example.json');
    try {
      const example = JSON.parse(await fs.readFile(examplePath, 'utf8'));
      if (ffmpeg) example.paths.ffmpeg = ffmpeg;
      if (ffprobe) example.paths.ffprobe = ffprobe;
      if (python) example.paths.python = python;
      if (chrome) example.paths.chrome = chrome;
      await fs.writeFile(configPath, JSON.stringify(example, null, 2) + '\n', 'utf8');
      console.log('Created runtime-config.json with detected system paths.');
    } catch (e) {
      console.log('Could not generate runtime-config.json:', e.message);
    }
  } else {
    console.log('runtime-config.json already exists. Keeping current settings.');
  }

  console.log('\nSetup complete. You can run:');
  console.log('  npm start        # Launches the local web studio at http://127.0.0.1:20130');
  console.log('  npm test         # Runs all unit & integration tests');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});