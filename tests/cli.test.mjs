import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
test('inspect validates a brief and produces structured identity without launching renderer',()=>{
 const r=spawnSync(process.execPath,['src/cli.mjs','inspect','briefs/smoke.json'],{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const m=JSON.parse(r.stdout);assert.equal(m.status,'VERIFIED');assert.equal(m.executionStatus,'UNVERIFIED');assert.equal(m.phrases,3);
});
test('CLI rejects invalid command or outside path with structured error',()=>{
 for(const argv of [['build','../outside.json'],['shell','x'],['inspect']]){const r=spawnSync(process.execPath,['src/cli.mjs',...argv],{cwd:root,encoding:'utf8'});assert.notEqual(r.status,0);assert.equal(JSON.parse(r.stdout).status,'FAILED');}
 assert.equal(existsSync(path.join(root,'.runtime/build.lock')),false,'invalid input left a build lease');
});
