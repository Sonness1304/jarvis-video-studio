import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {BatchQueue} from '../src/batch-queue.mjs';import {newBrief} from '../src/studio.mjs';
const project=()=>({revision:1,brief:newBrief({template:'listicle',theme:'editorial',voice:'Hải Đăng',id:'demo'},[{name:'Hải Đăng',aliases:[]}])});
function fakeJobs(){return {records:new Map(),calls:[],async start(kind,data){this.calls.push(data);const r={id:'job-'+this.calls.length,status:'RUNNING',kind,batchId:data.batchId,variantId:data.variantId};this.records.set(r.id,r);return r;}};}
test('batch captures immutable variants and advances serially only after terminal result',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p3-batch-')),jobs=fakeJobs(),q=new BatchQueue(root,jobs);await q.init();const p=project();
 const batch=await q.enqueue(p,[{format:'portrait',theme:'editorial'},{format:'landscape',theme:'dark-cinema'}]);p.brief.title='lateredit';assert.equal(jobs.calls.length,1);assert.notEqual(jobs.calls[0].brief.title,'lateredit');await q.pump();assert.equal(jobs.calls.length,1);
 jobs.records.get('job-1').status='VERIFIED';await q.pump();assert.equal(jobs.calls.length,2);assert.equal(jobs.calls[1].brief.format,'landscape');
 jobs.records.get('job-2').status='VERIFIED';await q.pump();assert.equal((await q.list()).find(b=>b.id===batch.id).status,'VERIFIED');q.close();
});
test('restart pauses batches and binds spawned job identity before attempting any resubmit',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p3-restart-')),jobs=fakeJobs(),q=new BatchQueue(root,jobs);await q.init();const b=await q.enqueue(project(),[{format:'portrait',theme:'editorial'},{format:'square',theme:'paper-story'}]);q.close();
 const folder=path.join(root,'.runtime/studio/batches',b.id),names=(await fs.readdir(folder)).filter(n=>/^\d{8}\.json$/.test(n)).sort();const latest=JSON.parse(await fs.readFile(path.join(folder,names.at(-1)),'utf8'));latest.entries[0].status='QUEUED';latest.entries[0].jobId=null;await fs.writeFile(path.join(folder,names.at(-1)),JSON.stringify(latest));
 jobs.records.get('job-1').status='UNKNOWN';const restarted=new BatchQueue(root,jobs);await restarted.init();assert.equal((await restarted.list())[0].status,'PAUSED');await assert.rejects(restarted.resume(b.id),/JOB_UNKNOWN/);assert.equal(jobs.calls.length,1);
 jobs.records.get('job-1').status='VERIFIED';await restarted.resume(b.id);assert.equal(jobs.calls.length,2);assert.equal(jobs.calls.filter(c=>c.variantId==='v0').length,1);restarted.close();
});
test('duplicate or excessive variants rejected before any worker job',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p3-batchlimit-')),jobs=fakeJobs(),q=new BatchQueue(root,jobs);await q.init();const v={format:'portrait',theme:'editorial'};
 await assert.rejects(q.enqueue(project(),[v,v]),/INVALID_VARIANTS/);await assert.rejects(q.enqueue(project(),Array(13).fill(v)),/INVALID_VARIANTS/);assert.equal(jobs.calls.length,0);q.close();
});
test('failure stops pending work until explicit resume and never retries failed variant',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p3-failed-')),jobs=fakeJobs(),q=new BatchQueue(root,jobs);await q.init();const variants=[{format:'portrait',theme:'editorial'},{format:'square',theme:'paper-story'}];const b=await q.enqueue(project(),variants);
 jobs.records.get('job-1').status='FAILED';await q.pump();assert.equal((await q.list())[0].status,'FAILED');assert.equal(jobs.calls.length,1);await assert.rejects(q.enqueue(project(),variants),/BATCH_BUSY/);
 await q.resume(b.id);assert.equal(jobs.calls.length,2);jobs.records.get('job-2').status='VERIFIED';await q.pump();assert.equal((await q.list())[0].status,'PARTIAL');q.close();
});

test('brand applied after enqueue never changes either queued variant snapshot',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'p5-brand-snapshot-')),jobs=fakeJobs(),q=new BatchQueue(root,jobs);await q.init();try{const p=project();p.brief.branding={label:'Trước hàng đợi'};await q.enqueue(p,[{format:'portrait',theme:'editorial'},{format:'landscape',theme:'editorial'}]);p.brief.branding.label='Sau hàng đợi';jobs.records.get('job-1').status='VERIFIED';await q.pump();assert.equal(jobs.calls[0].brief.branding.label,'Trước hàng đợi');assert.equal(jobs.calls[1].brief.branding.label,'Trước hàng đợi');}finally{q.close();}});
