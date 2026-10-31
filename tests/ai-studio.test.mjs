import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import sharp from 'sharp';import {createHash} from 'node:crypto';
import {imageRequest,imageTarget,imageTargetCurrent,imageReadinessReason} from '../web/image-request.mjs';import {imageGraph} from '../src/gpu.mjs';import {validateImageResult,aiStatus} from '../src/ai-studio.mjs';import {JobManager} from '../src/editor-jobs.mjs';
test('image readiness reports the requested three-GiB trial without changing VRAM threshold',()=>{
 assert.equal(imageReadinessReason('INSUFFICIENT_RAM'),'Cần ít nhất 3 GiB RAM trống');
 assert.equal(imageReadinessReason('INSUFFICIENT_VRAM'),'Cần ít nhất 6 GiB VRAM trống');
});
test('image input is strict data with bounded prompt, style and unsigned seed',()=>{
 const r=imageRequest({prompt:'  robot studio  ',style:'line',seed:42});assert.equal(r.prompt,'robot studio');assert.match(r.resolvedPrompt,/robot studio/);assert.match(r.resolvedPrompt,/line/);assert.equal(imageGraph(r.resolvedPrompt,'jarvis-test',r.seed)['5'].inputs.seed,42);
 for(const input of [{prompt:'',style:'original',seed:1},{prompt:'x'.repeat(3001),style:'original',seed:1},{prompt:'x\0',style:'original',seed:1},{prompt:'x',style:'none',seed:1},{prompt:'x',style:'original',seed:-1},{prompt:'x',style:'original',seed:NaN},{prompt:'x',style:'original',seed:2**32},{prompt:'x',style:'original',seed:1,command:'anything'}])assert.throws(()=>imageRequest(input),/INVALID_IMAGE_REQUEST/);
 for(const seed of [-1,NaN,1.2,2**32])assert.throws(()=>imageGraph('robot','jarvis-test',seed),/INVALID_IMAGE_REQUEST/);
});
test('verified PNG acceptance ties image path, graph and request to the job snapshot',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p7-image-')),id='jarvis-11111111-1111-1111-1111-111111111111',dir=path.join(root,'outputs',id);await fs.mkdir(dir,{recursive:true});
 const buffer=await sharp({create:{width:768,height:1024,channels:3,background:'#315fdb'}}).png().toBuffer();await fs.writeFile(path.join(dir,'image.png'),buffer);
 const request=imageRequest({prompt:'robot',style:'original',seed:42});const r={status:'VERIFIED',kind:'image',id,clientId:id,receipt:'outputs/'+id+'/receipt.json',graph:imageGraph(request.resolvedPrompt,id,42),image:{path:'outputs/'+id+'/image.png',sha256:createHash('sha256').update(buffer).digest('hex')},request};await fs.writeFile(path.join(dir,'receipt.json'),JSON.stringify(r));
 const record={kind:'image',imageRequest:request,gpuIdentity:{id,clientId:id,receipt:r.receipt}};const sealed=await validateImageResult(root,record,r);assert.ok(sealed.receipt.sha256);
 await assert.rejects(validateImageResult(root,{...record,imageRequest:{...request,seed:43}},r),/IMAGE_SNAPSHOT_CHANGED/);
 await assert.rejects(validateImageResult(root,record,{...r,image:{...r.image,path:'outputs/other/image.png'}}),/INVALID_IMAGE_ARTIFACT/);
 await fs.appendFile(path.join(dir,'image.png'),'changed');await assert.rejects(validateImageResult(root,record,r),/IMAGE_ARTIFACT_CHANGED/);
});
test('terminal GPU receipt recovers without stdout, including FAILED, and rejects a foreign attempt',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p7-owned-')),id='jarvis-22222222-2222-2222-2222-222222222222',foreign='jarvis-33333333-3333-3333-3333-333333333333',job='job-owned',dir=path.join(root,'outputs',id);await fs.mkdir(dir,{recursive:true});await fs.mkdir(path.join(root,'.runtime/studio/jobs',job),{recursive:true});
 const request=imageRequest({prompt:'robot',style:'original',seed:42}),identity={id,clientId:id,receipt:'outputs/'+id+'/receipt.json'},r={...identity,status:'FAILED',kind:'image',graph:imageGraph(request.resolvedPrompt,id,42),request,error:'BACKEND_EXECUTION_FAILED'};await fs.writeFile(path.join(dir,'receipt.json'),JSON.stringify(r));
 const jobs=new JobManager(root);await jobs.init();jobs.records.set(job,{id:job,revision:0,status:'UNKNOWN',kind:'image',imageRequest:request,gpuIdentity:identity});const recovered=await jobs.reconcile(job);assert.equal(recovered.status,'FAILED');assert.equal(recovered.error,'BACKEND_EXECUTION_FAILED');
 await assert.rejects(validateImageResult(root,{kind:'image',imageRequest:request,gpuIdentity:identity},{...r,status:'VERIFIED',id:foreign,clientId:foreign,receipt:'outputs/'+foreign+'/receipt.json',image:{path:'outputs/'+foreign+'/image.png',sha256:'a'.repeat(64)}}),/IMAGE_JOB_IDENTITY_CHANGED/);
});
test('foreign GPU identity with matching settings is rejected before any artifact access',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p7-foreign-')),a='jarvis-44444444-4444-4444-4444-444444444444',b='jarvis-55555555-5555-5555-5555-555555555555',request=imageRequest({prompt:'robot',style:'original',seed:42});
 await assert.rejects(validateImageResult(root,{kind:'image',imageRequest:request,gpuIdentity:{id:a,clientId:a,receipt:'outputs/'+a+'/receipt.json'}},{status:'VERIFIED',kind:'image',id:b,clientId:b,receipt:'outputs/'+b+'/receipt.json',request,graph:imageGraph(request.resolvedPrompt,b,42),image:{path:'outputs/'+b+'/image.png',sha256:'a'.repeat(64)}}),/IMAGE_JOB_IDENTITY_CHANGED/);
});
test('readiness distinguishes missing model, offline backend and insufficient resources without submission',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p7-ready-'));await fs.writeFile(path.join(root,'gpu-provenance.json'),JSON.stringify({backend:{url:'http://127.0.0.1:8188'},models:[{id:'sdxl-base',target:'model.safetensors',bytes:4}]}));
 const status=await aiStatus(root,{resources:async()=>({ram:1,vram:7*1024**3,disk:40*1024**3}),probe:async()=>{throw Error('offline')}});assert.equal(status.ready,false);assert.ok(status.reasons.includes('INSUFFICIENT_RAM'));assert.ok(status.reasons.includes('BACKEND_OFFLINE'));assert.ok(status.reasons.includes('MODEL_MISSING_OR_CHANGED'));assert.equal(status.inferenceStatus,'UNVERIFIED');
});
test('GPU UNKNOWN is retained and recovery only adopts the same durable receipt',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p7-recovery-')),id='job-unknown',folder=path.join(root,'.runtime/studio/jobs',id);await fs.mkdir(folder,{recursive:true});const jobs=new JobManager(root);await jobs.init();jobs.records.set(id,{id,revision:0,status:'UNKNOWN',kind:'image',imageRequest:imageRequest({prompt:'robot',style:'original',seed:1})});await fs.writeFile(path.join(folder,'process.log'),JSON.stringify({status:'UNKNOWN',error:'SUBMIT_UNCERTAIN'})+'\n');
 assert.equal((await jobs.reconcile(id)).status,'UNKNOWN');await assert.rejects(jobs.start('voice',{voice:'Hải Đăng'}),/JOB_UNKNOWN/);
});

test('image process UNKNOWN is durable across server restart and excludes other heavy work',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p7-process-'));await fs.mkdir(path.join(root,'src'));await fs.writeFile(path.join(root,'runtime-config.json'),JSON.stringify({paths:{}}));
 await fs.writeFile(path.join(root,'src/gpu-cli.mjs'),"console.log(JSON.stringify({status:'UNKNOWN',error:'SUBMIT_UNCERTAIN'}));process.exitCode=1;");
 const jobs=new JobManager(root);await jobs.init();const started=await jobs.start('image',{imageRequest:imageRequest({prompt:'literal $(no shell) ; <svg>',style:'line',seed:1}),projectId:'test',projectRevision:2,sceneId:'scene'});
 for(let i=0;i<80&&(await jobs.list())[0].status==='RUNNING';i++)await new Promise(r=>setTimeout(r,25));assert.equal((await jobs.list())[0].status,'UNKNOWN');
 const reloaded=new JobManager(root);await reloaded.init();assert.equal((await reloaded.list())[0].status,'UNKNOWN');await assert.rejects(reloaded.start('voice',{voice:'Hải Đăng'}),/JOB_UNKNOWN/);assert.equal((await reloaded.reconcile(started.id)).status,'UNKNOWN');
});
test('image attachment target survives only the same project revision, selected scene and edit generation',()=>{
 const s={project:{brief:{id:'one'},revision:2},draft:{scenes:[{id:'a'},{id:'b'}]},selected:0,editGeneration:4},c=imageTarget(s);assert.ok(imageTargetCurrent(c,s));
 for(const n of [{...s,selected:1},{...s,editGeneration:5},{...s,project:{brief:{id:'two'},revision:2}},{...s,project:{...s.project,revision:3}},{...s,draft:{scenes:[{id:'b'},{id:'a'}]}}])assert.equal(imageTargetCurrent(c,n),false);
 assert.equal(imageTargetCurrent(c,{...s,draft:null}),false);
});
test('image child crash after a durable GPU intent stays UNKNOWN rather than admitting duplicate work',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p7-crash-'));await fs.mkdir(path.join(root,'src'));await fs.writeFile(path.join(root,'runtime-config.json'),JSON.stringify({paths:{}}));await fs.writeFile(path.join(root,'src/gpu-cli.mjs'),"import fs from 'node:fs';fs.writeFileSync('.runtime/gpu-job.json','{}');process.exitCode=1;");
 const jobs=new JobManager(root);await jobs.init();await jobs.start('image',{imageRequest:imageRequest({prompt:'robot',style:'original',seed:1})});for(let i=0;i<80&&(await jobs.list())[0].status==='RUNNING';i++)await new Promise(r=>setTimeout(r,25));assert.equal((await jobs.list())[0].status,'UNKNOWN');
});
test('typed image child consumes its owned request envelope and seals a decoded result',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p7-success-'));await fs.mkdir(path.join(root,'src'));await fs.writeFile(path.join(root,'runtime-config.json'),JSON.stringify({paths:{}}));await sharp({create:{width:768,height:1024,channels:3,background:'#315fdb'}}).png().toFile(path.join(root,'fixture.png'));
 await fs.writeFile(path.join(root,'src/gpu-cli.mjs'),`import fs from 'node:fs';import {createHash} from 'node:crypto';const x=JSON.parse(fs.readFileSync(process.argv[3])),dir='outputs/'+x.identity.id;fs.mkdirSync(dir,{recursive:true});fs.copyFileSync('fixture.png',dir+'/image.png');const r={...x.identity,status:'VERIFIED',kind:'image',request:x.request,graph:{'2':{inputs:{text:x.request.resolvedPrompt}},'5':{inputs:{seed:x.request.seed}}},image:{path:dir+'/image.png',sha256:createHash('sha256').update(fs.readFileSync(dir+'/image.png')).digest('hex')}};fs.writeFileSync(x.identity.receipt,JSON.stringify(r));console.log(JSON.stringify(r));`);
 const jobs=new JobManager(root);await jobs.init();const started=await jobs.start('image',{imageRequest:imageRequest({prompt:'robot',style:'photo',seed:42})});for(let i=0;i<80&&(await jobs.list())[0].status==='RUNNING';i++)await new Promise(r=>setTimeout(r,25));const terminal=(await jobs.list())[0];assert.equal(terminal.status,'VERIFIED',terminal.error);assert.equal(terminal.result.id,started.gpuIdentity.id);assert.ok(terminal.sealed.receipt.sha256);
 const reloaded=new JobManager(root);await reloaded.init();assert.equal((await reloaded.list())[0].status,'VERIFIED');
});
