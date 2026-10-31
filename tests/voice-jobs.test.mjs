import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {JobManager} from '../src/editor-jobs.mjs';
import {voiceWorkbenchRequest} from '../src/voice-workbench.mjs';
test('workbench request limits seed, identity, fingerprint, speech and refuses arbitrary fields',()=>{
 const v={text:'Xin chào',voice:{provider:'vieneu',voiceId:'Hải Đăng'},signature:'sig',takeId:'take-1',seed:123};assert.deepEqual(voiceWorkbenchRequest(v),v);
 for(const patch of [{text:''},{seed:-1},{signature:'x'.repeat(3000)},{file:'C:/secret'},{voice:{provider:'vieneu',voiceId:'x',style:'happy'}}])assert.throws(()=>voiceWorkbenchRequest({...v,...patch}));
});
test('workbench/dubbing UNKNOWN receipts survive reconciliation and reject malformed artifacts',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'voice-job-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const jobs=new JobManager(root);await jobs.init();
 await assert.rejects(jobs.resultArtifacts({kind:'voice-workbench'},{audio:{path:'../evil.wav',sha256:'a'.repeat(64)}}));
 const id='job-test';await fs.mkdir(jobs.dir(id));jobs.records.set(id,{id,revision:0,status:'UNKNOWN',kind:'voice-workbench'});await fs.writeFile(path.join(jobs.dir(id),'process.log'),JSON.stringify({status:'UNKNOWN',error:'VOICE_OUTCOME_UNKNOWN'}));assert.equal((await jobs.reconcile(id)).status,'UNKNOWN');
});
