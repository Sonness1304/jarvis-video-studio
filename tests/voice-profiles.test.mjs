import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {VoiceProfiles,validateProfileInput} from '../src/voice-profiles.mjs';
test('profile rejects missing rights, wrong identity and invalid duration before storing reference',()=>{
 for(const v of [{name:'My voice'},{name:'My voice',rights:'Có quyền',transcript:'Xin chào',duration:2},{name:'My voice',rights:'Có quyền',transcript:'Xin chào',duration:9}])assert.throws(()=>validateProfileInput(v),/PROFILE/);
});
test('profile revisions are immutable, archive preserves referenced audio and read verifies hashes',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'profiles-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const store=new VoiceProfiles(root);const wav=Buffer.from('synthetic normalized audio');
 const p=await store.create({name:'Mẫu riêng',rights:'Giọng của tôi',transcript:'Xin chào',duration:5},wav);assert.equal(p.revision,1);assert.equal((await store.read(p.id,1)).sourceHash,p.sourceHash);
 await store.archive(p.id,1);assert.equal((await store.list())[0].archived,true);assert.equal((await store.read(p.id,1)).archived,false);await assert.rejects(store.archive(p.id,1),/REVISION_CONFLICT/);
 await fs.writeFile(path.join(root,p.reference.path),'changed');await assert.rejects(store.read(p.id,1),/PROFILE_AUDIO_CHANGED/);
});
