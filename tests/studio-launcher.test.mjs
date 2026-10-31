import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/open-studio.ps1',import.meta.url));
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
test('launcher status is read-only, emits structured ready or stopped without starting a child',()=>{const r=spawnSync('pwsh',['-NoProfile','-NonInteractive','-File',script,'-Status','-NoBrowser'],{encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(r.status,0,r.stderr);const value=JSON.parse(r.stdout.trim());assert.ok(['READY','STOPPED','PORT_BUSY'].includes(value.status));assert.equal(value.launched,false);assert.equal(value.url,'http://127.0.0.1:20130');});
test('foreground launcher sends an absolute server entry even when called from another directory',()=>{
 const shim=fs.mkdtempSync(path.join(os.tmpdir(),'studio-argv-'));
 // Capture the child arguments without starting a server or touching an existing job.
 fs.writeFileSync(path.join(shim,'node.cmd'),'@echo off\r\necho %1\r\nexit /b 0\r\n');
 const entry=fileURLToPath(new URL('../scripts/start-studio.ps1',import.meta.url));
 const r=spawnSync('pwsh',['-NoProfile','-NonInteractive','-File',entry],{cwd:os.tmpdir(),env:{...process.env,PATH:shim+path.delimiter+process.env.PATH},encoding:'utf8',windowsHide:true,timeout:10000});
 assert.equal(r.status,0,r.stderr);const childEntry=r.stdout.trim().replace(/^"|"$/g,'');assert.equal(path.isAbsolute(childEntry),true);assert.equal(path.normalize(childEntry),path.normalize(fileURLToPath(new URL('../src/editor-server.mjs',import.meta.url))));
});
