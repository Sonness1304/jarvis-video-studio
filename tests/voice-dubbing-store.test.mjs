import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {DubbingStore} from '../src/voice-dubbing.mjs';
test('dubbing documents use CAS and source identity remains immutable across transcript edits',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'dub-store-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const store=new DubbingStore(root),p=await store.create({id:'asset-test',sourceHash:'a'.repeat(64),duration:10});assert.equal(p.revision,1);assert.equal((await store.read(p.doc.id)).doc.sourceAssetId,'asset-test');
 const doc={...p.doc,segments:[{id:'segment-1',start:0,end:2,sourceText:'Chào',targetText:'Xin chào'}]};assert.equal((await store.save(p.doc.id,1,doc)).revision,2);await assert.rejects(store.save(p.doc.id,1,doc),/REVISION_CONFLICT/);await assert.rejects(store.save(p.doc.id,2,{...doc,sourceHash:'b'.repeat(64)}),/DUB_SOURCE_CHANGED/);
});
