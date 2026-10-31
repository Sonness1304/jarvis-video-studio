import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {JobManager} from '../src/editor-jobs.mjs';
test('interrupted durable job is UNKNOWN after restart and does not resubmit',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p2-jobs-'));const dir=path.join(root,'.runtime/studio/jobs/job-test');await fs.mkdir(dir,{recursive:true});
 await fs.writeFile(path.join(dir,'00000001.json'),JSON.stringify({id:'job-test',revision:1,status:'RUNNING',kind:'export',pid:12345}));
 const jobs=new JobManager(root);await jobs.init();assert.equal((await jobs.list())[0].status,'UNKNOWN');
 await assert.rejects(jobs.start('voice',{voice:'Hải Đăng'}),/JOB_UNKNOWN/);await assert.rejects(jobs.start('shell',{command:'anything'}),/INVALID_JOB_KIND/);
});
test('corrupt durable job keeps UNKNOWN without preventing read-only app startup',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p2-badjob-'));const dir=path.join(root,'.runtime/studio/jobs/job-bad');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'00000002.json'),'{');
 const jobs=new JobManager(root);await jobs.init();assert.equal((await jobs.list())[0].status,'UNKNOWN');await assert.rejects(jobs.start('voice',{voice:'Hải Đăng'}),/JOB_UNKNOWN/);
});
test('simultaneous heavy starts admit one job and missing CLI transitions FAILED',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p2-jobrace-'));await fs.writeFile(path.join(root,'runtime-config.json'),JSON.stringify({paths:{chrome:'none',ffmpeg:'none',ffprobe:'none'}}));
 const jobs=new JobManager(root);await jobs.init();const result=await Promise.allSettled([jobs.start('voice',{voice:'Hải Đăng'}),jobs.start('voice',{voice:'Hải Đăng'})]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.match(result.find(r=>r.status==='rejected').reason.message,/JOB_BUSY/);
 for(let i=0;i<40&&(await jobs.list())[0].status==='RUNNING';i++)await new Promise(r=>setTimeout(r,50));
 assert.equal((await jobs.list())[0].status,'FAILED');
});

test('unknown translation acknowledgement requires consent, stopped process and matching terminal identity, never resubmits',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'dub-unknown-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const jobs=new JobManager(root);await jobs.init();const id='job-unknown',doc={id:'dub-11111111-1111-4111-8111-111111111111',sourceHash:'a'.repeat(64)},result={status:'UNKNOWN',action:'translate',documentId:doc.id,documentRevision:3,sourceHash:doc.sourceHash};const record={id,revision:0,kind:'dubbing',status:'UNKNOWN',pid:2147483647,request:{action:'translate',doc,revision:3}};await fs.mkdir(jobs.dir(id));jobs.records.set(id,record);await fs.writeFile(path.join(jobs.dir(id),'process.log'),JSON.stringify(result));
 await assert.rejects(jobs.acknowledgeTranslationUnknown(id,false),/ACK_REQUIRED/);jobs.records.set(id,{...record,pid:process.pid});await assert.rejects(jobs.acknowledgeTranslationUnknown(id,true),/PROCESS_STILL_RUNNING/);jobs.records.set(id,record);await fs.writeFile(path.join(jobs.dir(id),'process.log'),JSON.stringify({...result,documentId:'other'}));await assert.rejects(jobs.acknowledgeTranslationUnknown(id,true),/IDENTITY/);await fs.writeFile(path.join(jobs.dir(id),'process.log'),JSON.stringify(result));const r=await jobs.acknowledgeTranslationUnknown(id,true);assert.equal(r.status,'FAILED');assert.equal(r.result.status,'UNKNOWN');assert.equal(r.providerOutcome,'UNVERIFIED');assert.ok(r.acknowledgedAt);assert.doesNotThrow(()=>jobs.exclusive(async()=>{}));
});
