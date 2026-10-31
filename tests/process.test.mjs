import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import * as processes from '../src/process.mjs';
import {spawnSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
const {runProcess,childEnvironment,acquireBuildLock}=processes;
const recoverBuildLock=(...args)=>{if(!processes.recoverBuildLock)throw Error('RECOVERY_UNAVAILABLE');return processes.recoverBuildLock(...args);};
test('child environment strips credentials and force-local telemetry-free media routes',()=>{
 process.env.JARVIS_GATEWAY_KEY='synthetic';process.env.GEMINI_API_KEY='synthetic';process.env.NODE_OPTIONS='--synthetic';process.env.PYTHONPATH='synthetic-injection';process.env.PYTHONHOME='synthetic-home';
 try{const env=childEnvironment('C:/example',{paths:{chrome:'C:/browser.exe',ffmpeg:'ffmpeg',ffprobe:'probe'}});assert.equal(env.JARVIS_GATEWAY_KEY,undefined);assert.equal(env.GEMINI_API_KEY,undefined);assert.equal(env.NODE_OPTIONS,undefined);assert.equal(env.PYTHONPATH,undefined);assert.equal(env.PYTHONHOME,undefined);assert.equal(env.HF_HUB_OFFLINE,'1');assert.equal(env.HYPERFRAMES_NO_TELEMETRY,'1');}finally{delete process.env.JARVIS_GATEWAY_KEY;delete process.env.GEMINI_API_KEY;delete process.env.NODE_OPTIONS;delete process.env.PYTHONPATH;delete process.env.PYTHONHOME;}
});
test('process argv is literal and failure cannot be reported VERIFIED',async()=>{
 const d=await fs.mkdtemp(path.join(os.tmpdir(),'jarvis-video-process-'));
 await runProcess(process.execPath,['-e','console.log(process.argv[1])','a; & echo bad'],{cwd:d,env:{...process.env},log:path.join(d,'ok.log')});assert.equal((await fs.readFile(path.join(d,'ok.log'),'utf8')).trim(),'a; & echo bad');
 await assert.rejects(runProcess(process.execPath,['-e','process.exit(7)'],{cwd:d,env:{...process.env},log:path.join(d,'fail.log')}),/PROCESS_FAILED_7/);
});
test('only one heavy build owns a root lock and releases it on normal completion',async()=>{
 const d=await fs.mkdtemp(path.join(os.tmpdir(),'jarvis-video-lock-'));const release=await acquireBuildLock(d);
 await assert.rejects(acquireBuildLock(d),/BUILD_ALREADY_LOCKED/);await release();const again=await acquireBuildLock(d);await again();
});
test('unresolved GPU job blocks every heavy pipeline even after submitter exits',async()=>{
 const d=await fs.mkdtemp(path.join(os.tmpdir(),'video-pending-gpu-'));await fs.mkdir(path.join(d,'.runtime'));
 await fs.writeFile(path.join(d,'.runtime/gpu-job.json'),JSON.stringify({clientId:'jarvis-test',status:'UNKNOWN'}));
 await assert.rejects(acquireBuildLock(d),/GPU_JOB_PENDING/);
 assert.ok(await fs.stat(path.join(d,'.runtime/gpu-job.json')));
});
test('log open failure rejects normally before spawning child',async()=>{
 const d=await fs.mkdtemp(path.join(os.tmpdir(),'jarvis-video-badlog-'));const marker=path.join(d,'should-not-exist');
 await assert.rejects(runProcess(process.execPath,['-e','require("fs").writeFileSync(process.argv[1],"spawned")',marker],{cwd:d,env:{...process.env},log:d}));
 await assert.rejects(fs.stat(marker));
});
test('recovery refuses live owner/related child/changed owner and archives only a dead verified lease',async()=>{
 const d=await fs.mkdtemp(path.join(os.tmpdir(),'jarvis-video-recover-'));const release=await acquireBuildLock(d);const original=await fs.readFile(path.join(d,'.runtime','build.lock'),'utf8');
 await assert.rejects(recoverBuildLock(d,{isAlive:()=>true,relatedProcesses:()=>false}),/OWNER_ALIVE/);
 await assert.rejects(recoverBuildLock(d,{isAlive:()=>false,relatedProcesses:()=>true}),/RELATED_PROCESSES/);
 assert.equal(await fs.readFile(path.join(d,'.runtime','build.lock'),'utf8'),original);
 const result=await recoverBuildLock(d,{isAlive:()=>false,relatedProcesses:()=>false});assert.equal(result.status,'VERIFIED');assert.equal(await fs.readFile(path.join(d,'.runtime',result.archive),'utf8'),original);
 const again=await acquireBuildLock(d);await again();
 // The old owner's release must not delete a replacement or archived lease.
 await assert.rejects(release());
});
test('native Windows recovery archives a completed fixture owner lease without deleting processes',async()=>{
 const d=await fs.mkdtemp(path.join(os.tmpdir(),'jarvis-video-native-recover-'));await fs.mkdir(path.join(d,'.runtime'));
 const owner=spawnSync(process.execPath,['-e','console.log(process.pid)'],{encoding:'utf8',windowsHide:true});assert.equal(owner.status,0);
 const lease={pid:Number(owner.stdout.trim()),nonce:randomUUID(),startedAt:new Date().toISOString(),children:[]};await fs.writeFile(path.join(d,'.runtime','build.lock'),JSON.stringify(lease));
 const result=await processes.recoverBuildLock(d);assert.equal(result.status,'VERIFIED');assert.equal(result.deletedProcesses,0);await assert.rejects(fs.access(path.join(d,'.runtime','build.lock')));assert.equal(JSON.parse(await fs.readFile(path.join(d,'.runtime',result.archive),'utf8')).nonce,lease.nonce);
});
