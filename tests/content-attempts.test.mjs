import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {ContentAttempts} from '../src/content-attempts.mjs';import {contentModels} from '../src/content-ai.mjs';
import {createHash} from 'node:crypto';
const input={projectId:'content-test',projectRevision:1,draftHash:'a'.repeat(64),contentBrief:{subject:'Chủ đề',audience:'',goal:'',targetSeconds:30,structure:'explain',sourceNotes:''},sceneCount:3,model:contentModels.sonnet};
const setup=async options=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'p75-attempt-')),store=new ContentAttempts(root,{launch:async()=>{},ownerProbe:async()=> 'unknown',...options});await store.init();return {root,store};};
test('concurrent admission is exclusive, durable and restart never launches a second inference',async()=>{
 let launches=0;const {root,store}=await setup({launch:async()=>{launches++;}});const both=await Promise.allSettled([store.start(input),store.start(input)]);assert.equal(both.filter(r=>r.status==='fulfilled').length,1);assert.equal(launches,1);
 const attempt=both.find(r=>r.status==='fulfilled').value;assert.match(attempt.id,/^content-[a-f0-9-]{36}$/);await assert.rejects(store.read(attempt.id,'foreign'),/PROJECT/);
 const restarted=new ContentAttempts(root,{launch:async()=>{throw Error('REPLAY');},ownerProbe:async()=> 'unknown'});await restarted.init();assert.equal((await restarted.list('content-test')).length,1);assert.equal((await restarted.reconcile(attempt.id,'content-test')).status,'UNKNOWN');await assert.rejects(restarted.start(input),/CONTENT_BUSY/);
});
test('hash-pinned result survives restart; forged nonce or changed result cannot publish',async()=>{
 const {root,store}=await setup();const a=await store.start(input),request=await store.request(a.id);const candidate={schemaVersion:1,title:'Bài',scenes:['hook','explain','conclusion'].map(role=>({role,title:'Ý',narration:['Lời kể'],layout:'kinetic',content:{},reason:'',needsInput:[]}))};
 await store.publish(a.id,{nonce:request.nonce,requestHash:request.requestHash,status:'VERIFIED',candidate,usage:{input:10,output:20,cached:null},actualModel:'claude-sonnet-4-6',elapsedMs:100});
 assert.equal((await store.read(a.id,input.projectId)).candidate.title,'Bài');const s=new ContentAttempts(root,{launch:async()=>{throw Error('REPLAY');}});await s.init();assert.equal((await s.read(a.id,input.projectId)).status,'VERIFIED');
 await assert.rejects(store.publish(a.id,{nonce:'forged',status:'VERIFIED',candidate}),/OWNER/);
 const result=path.join(root,'.runtime/studio/content-attempts',a.id,'result.json');await fs.appendFile(result,' ');await assert.rejects(store.read(a.id,input.projectId),/HASH/);
});
test('caps preserve history; Opus needs eligible owned Sonnet failure with no live owner',async()=>{
 const {store}=await setup({projectCap:1});const a=await store.start(input),r=await store.request(a.id);await store.publish(a.id,{nonce:r.nonce,requestHash:r.requestHash,status:'FAILED',error:'CONTENT_HTTP_429',fallbackEligible:false});
 await assert.rejects(store.start(input),/CONTENT_CAP/);assert.equal((await store.list(input.projectId)).length,1);
 const other=await setup();await assert.rejects(other.store.start({...input,model:contentModels.opus}),/FALLBACK/);
});

test('global cap and unresolved owner never delete history or resubmit a request',async()=>{
 const {store}=await setup({globalCap:1});const a=await store.start(input);assert.equal((await store.reconcile(a.id,input.projectId)).status,'UNKNOWN');
 await assert.rejects(store.start({...input,projectId:'another-project'}),/CONTENT_CAP/);assert.equal((await store.list(input.projectId)).length,1);
});

test('eligible Opus fallback requires prior owned failure and a proven dead owner',async()=>{
 const {store}=await setup({ownerProbe:async()=> 'dead'}),a=await store.start(input),r=await store.request(a.id);
 await store.publish(a.id,{nonce:r.nonce,requestHash:r.requestHash,status:'FAILED',error:'CONTENT_CONNECT_FAILED',fallbackEligible:true});
 const fallback=await store.start({...input,model:contentModels.opus,fallbackFrom:a.id});assert.equal(fallback.model,contentModels.opus);
});

test('connector integrity hashes raw helper bytes, not a JSON-encoded Buffer',async()=>{
 const {root,store}=await setup();const loader=path.join(root,'fixture-helper.ps1'),bytes=Buffer.from('# fixture only; never execute\r\n');await fs.writeFile(loader,bytes);
 await fs.writeFile(path.join(root,'content-connector.json'),JSON.stringify({schemaVersion:1,endpoint:'http://127.0.0.1:20128/v1',savedKeyLoader:loader,loaderSha256:createHash('sha256').update(bytes).digest('hex')}));
 await assert.doesNotReject(store.verifyConnector());await fs.appendFile(loader,'changed');await assert.rejects(store.verifyConnector(),/CONTENT_LOADER_CHANGED/);
});

test('explicit request may follow UNKNOWN only after proven dead owner, old outcome stays unknown',async()=>{
 const {store}=await setup({ownerProbe:async()=> 'dead'}),a=await store.start(input),r=await store.request(a.id);await store.publish(a.id,{nonce:r.nonce,requestHash:r.requestHash,status:'UNKNOWN',error:'CONTENT_TIMEOUT',usage:null});
 const next=await store.start(input);assert.notEqual(next.id,a.id);assert.equal((await store.read(a.id,input.projectId)).status,'UNKNOWN');
});

test('restart archives dead admission lease and preserves live or unprovable identity',async()=>{
 const {root,store}=await setup({leaseProbe:async()=> 'dead'});await fs.writeFile(path.join(root,'.runtime/studio/content-attempts/admission.lease'),JSON.stringify({pid:123,start:'fixture',nonce:'11111111-1111-1111-1111-111111111111'}));assert.ok((await store.start(input)).id);
 const other=await setup({leaseProbe:async()=> 'unknown'}),lease=path.join(other.root,'.runtime/studio/content-attempts/admission.lease');const value=JSON.stringify({pid:456,start:'fixture',nonce:'22222222-2222-2222-2222-222222222222'});await fs.writeFile(lease,value);await assert.rejects(other.store.start(input),/CONTENT_BUSY/);assert.equal(await fs.readFile(lease,'utf8'),value);
});
