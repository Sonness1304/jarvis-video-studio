import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import sharp from 'sharp';import {createHash} from 'node:crypto';
import {clipRequest} from '../web/clip-request.mjs';import {resolveClipRequest,canonicalClipRequest,validateClipOwnership,validateClipResult} from '../src/ai-clips.mjs';import {clipGraph} from '../src/gpu.mjs';import {JobManager} from '../src/editor-jobs.mjs';import {aiStatus} from '../src/ai-studio.mjs';
import * as clipsModule from '../src/ai-clips.mjs';import {listAssets} from '../src/assets.mjs';
const imageId='jarvis-11111111-1111-4111-8111-111111111111',gpuId='jarvis-22222222-2222-4222-8222-222222222222',identity={id:gpuId,clientId:gpuId,receipt:'outputs/'+gpuId+'/receipt.json'};
async function source(){const root=await fs.mkdtemp(path.join(os.tmpdir(),'p72-source-')),dir=path.join(root,'outputs',imageId);await fs.mkdir(dir,{recursive:true});const buffer=await sharp({create:{width:768,height:1024,channels:3,background:'#315fdb'}}).png().toBuffer(),image={path:'outputs/'+imageId+'/image.png',sha256:createHash('sha256').update(buffer).digest('hex')};await fs.writeFile(path.join(root,image.path),buffer);await fs.writeFile(path.join(dir,'receipt.json'),JSON.stringify({id:imageId,clientId:imageId,receipt:'outputs/'+imageId+'/receipt.json',status:'VERIFIED',kind:'image',image}));return {root,image};}
test('clip request rejects arbitrary paths, URLs, unknown controls and oversized motion text',()=>{
 assert.deepEqual(clipRequest({imageId,prompt:'  a robot waves  '}),{imageId,prompt:'a robot waves'});
 for(const v of [{imageId:'../bad',prompt:'move'},{imageId,prompt:''},{imageId,prompt:'x\n'},{imageId,prompt:'x'.repeat(3001)},{imageId,prompt:'move',url:'https://example.com'}])assert.throws(()=>clipRequest(v),/INVALID_CLIP_REQUEST/);
});
test('clip source pins verified receipt and decoded PNG; changed pixels or receipt invalidate snapshot',async()=>{
 const {root,image}=await source(),r=await resolveClipRequest(root,{imageId,prompt:'robot waves'});assert.equal(r.source.image.sha256,image.sha256);assert.equal(canonicalClipRequest(r).prompt,'robot waves');
 assert.throws(()=>canonicalClipRequest({...r,source:{...r.source,receipt:'../bad'}}),/INVALID_CLIP_SNAPSHOT/);
 await fs.appendFile(path.join(root,r.source.receipt),' ');const changed=await resolveClipRequest(root,{imageId,prompt:r.prompt});assert.notEqual(changed.source.receiptSha256,r.source.receiptSha256);
 await fs.writeFile(path.join(root,image.path),'changed');await assert.rejects(resolveClipRequest(root,{imageId,prompt:r.prompt}),/MEDIA_HASH_CHANGED/);
});
test('clip ownership rejects foreign attempt, modified graph or source even when prompt matches',async()=>{
 const {root}=await source(),request=await resolveClipRequest(root,{imageId,prompt:'robot waves'}),record={kind:'clip',clipRequest:request,gpuIdentity:identity},r={...identity,status:'VERIFIED',kind:'clip',request,graph:clipGraph(request.prompt,gpuId,gpuId+'.png'),inputImage:request.source.image};
 assert.equal(validateClipOwnership(record,r),true);
 for(const bad of [{...r,id:imageId},{...r,graph:clipGraph('foreign',gpuId,gpuId+'.png')},{...r,inputImage:{...r.inputImage,sha256:'a'.repeat(64)}}])assert.throws(()=>validateClipOwnership(record,bad),/CLIP_.*CHANGED/);
 await assert.rejects(validateClipResult(root,record,{...r,id:imageId}),/CLIP_IDENTITY_CHANGED/);
});
test('clip UNKNOWN recovery accepts only owned FAILED receipt without retry or requiring source to survive',async()=>{
 const {root}=await source(),request=await resolveClipRequest(root,{imageId,prompt:'robot waves'}),jobs=new JobManager(root);await jobs.init();const id='job-clip-unknown';await fs.mkdir(jobs.dir(id));jobs.records.set(id,{id,revision:0,status:'UNKNOWN',kind:'clip',clipRequest:request,gpuIdentity:identity});await fs.mkdir(path.join(root,'outputs',gpuId));
 await fs.writeFile(path.join(root,identity.receipt),JSON.stringify({...identity,kind:'clip',status:'FAILED',request,graph:clipGraph(request.prompt,gpuId,gpuId+'.png'),error:'BACKEND_EXECUTION_FAILED'}));
 assert.equal((await jobs.reconcile(id)).status,'FAILED');assert.equal((await jobs.list())[0].error,'BACKEND_EXECUTION_FAILED');
});
test('clip child uses durable typed envelope and UNKNOWN blocks all other heavy jobs after reload',async()=>{
 const {root}=await source(),request=await resolveClipRequest(root,{imageId,prompt:'robot; $(literal)'});await fs.mkdir(path.join(root,'src'));await fs.writeFile(path.join(root,'runtime-config.json'),JSON.stringify({paths:{}}));await fs.writeFile(path.join(root,'src/gpu-cli.mjs'),"import fs from 'node:fs';const p=JSON.parse(fs.readFileSync(process.argv[3]));if(process.argv[2]!=='clip-request'||p.request.prompt!=='robot; $(literal)'||p.identity.id!==p.identity.clientId)throw Error('BAD_ENVELOPE');console.log(JSON.stringify({status:'UNKNOWN',error:'SUBMIT_UNCERTAIN'}));process.exitCode=1;");
 const jobs=new JobManager(root);await jobs.init();const first=await jobs.start('clip',{clipRequest:request,projectId:'one',projectRevision:2,sceneId:'scene'});assert.ok(first.gpuIdentity);for(let i=0;i<80&&(await jobs.list())[0].status==='RUNNING';i++)await new Promise(r=>setTimeout(r,25));assert.equal((await jobs.list())[0].status,'UNKNOWN');const reloaded=new JobManager(root);await reloaded.init();await assert.rejects(reloaded.start('voice',{voice:'Hải Đăng'}),/JOB_UNKNOWN/);assert.equal((await reloaded.reconcile(first.id)).status,'UNKNOWN');
});
test('clip readiness requires both LTX and T5 without pretending SDXL availability is enough',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p72-ready-'));await fs.writeFile(path.join(root,'gpu-provenance.json'),JSON.stringify({backend:{url:'http://127.0.0.1:8188'},models:[{id:'ltx-2b',target:'ltx',bytes:4},{id:'ltx-t5',target:'t5',bytes:4}]}));await fs.writeFile(path.join(root,'ltx'),'test');const deps={kind:'clip',resources:async()=>({ram:5*1024**3,vram:7*1024**3,disk:40*1024**3}),probe:async()=>({queue_running:[],queue_pending:[]})};const missing=await aiStatus(root,deps);assert.equal(missing.ready,false);await fs.writeFile(path.join(root,'t5'),'test');const ready=await aiStatus(root,deps);assert.equal(ready.ready,true);assert.equal(ready.profile.frames,49);assert.equal(ready.profile.width,320);
});
test('crash recovery finds normalized clip beyond gallery cap and refuses changed file reuse',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p72-dedupe-')),dir=path.join(root,'.runtime/studio/assets');await fs.mkdir(dir,{recursive:true});const id='asset-0000',raw=Buffer.from('raw-clip-fixture'),normalized=Buffer.from('normalized-clip-fixture'),digest=b=>createHash('sha256').update(b).digest('hex'),job={id:'job-recovery',result:{clip:{sha256:digest(raw)}}};
 for(let i=0;i<=200;i++){const aid='asset-'+String(i).padStart(4,'0'),asset={id:aid,status:'VERIFIED',kind:'video',path:'outputs/'+aid+'/media.mp4',name:i===0?'AI clip '+job.id:'other',sourceHash:digest(raw),sha256:digest(normalized)};await fs.writeFile(path.join(dir,aid+'.json'),JSON.stringify(asset));}
 await fs.mkdir(path.join(root,'outputs',id),{recursive:true});await fs.writeFile(path.join(root,'outputs',id,'original.bin'),raw);await fs.writeFile(path.join(root,'outputs',id,'media.mp4'),normalized);
 assert.equal((await listAssets(root)).some(a=>a.id===id),false);assert.equal((await clipsModule.findImportedClip(root,job))?.id,id);await fs.writeFile(path.join(root,'outputs',id,'media.mp4'),'tampered');await assert.rejects(clipsModule.findImportedClip(root,job),/CLIP_NORMALIZED_ASSET_CHANGED/);
});
