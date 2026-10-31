import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';
import {resolveVoiceRequests,validatePcmWav} from '../src/voice-workbench.mjs';import {voiceSignature} from '../web/voice-model.mjs';
const b={schemaVersion:1,id:'test',title:'Test',preset:'story',voice:'Hải Đăng',accent:'#3569cc',scenes:[{id:'scene',title:'Cảnh',visual:'script',phrases:[{id:'phrase',text:'Xin chào'}]}]};
const wav=()=>{const w=Buffer.alloc(44+4800*2);w.write('RIFF');w.writeUInt32LE(w.length-8,4);w.write('WAVEfmt ',8);w.writeUInt32LE(16,16);w.writeUInt16LE(1,20);w.writeUInt16LE(1,22);w.writeUInt32LE(48000,24);w.writeUInt32LE(96000,28);w.writeUInt16LE(2,32);w.writeUInt16LE(16,34);w.write('data',36);w.writeUInt32LE(w.length-44,40);return w;};
test('selected take binds signature and artifact hash, stale cannot fall through into new inference',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'voice-render-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const audio=wav(),relative='outputs/test/sample.wav';await fs.mkdir(path.join(root,'outputs/test'),{recursive:true});await fs.writeFile(path.join(root,relative),audio);
 const signature=voiceSignature(b,b.scenes[0],b.scenes[0].phrases[0]);b.voiceWorkbench={schemaVersion:1,selections:{phrase:{jobId:'job-test',signature}}};
 const result={status:'VERIFIED',kind:'voice-workbench',request:{signature},result:{signature,audio:{path:relative,sha256:createHash('sha256').update(audio).digest('hex')}}};
 const rows=await resolveVoiceRequests(root,b,{},async()=>result);assert.equal(rows[0].selected.path,relative);b.scenes[0].phrases[0].text='Nội dung mới';await assert.rejects(resolveVoiceRequests(root,b,{},async()=>result),/VOICE_TAKE_STALE/);b.scenes[0].phrases[0].text='Xin chào';await fs.writeFile(path.join(root,relative),'changed');await assert.rejects(resolveVoiceRequests(root,b,{},async()=>result),/VOICE_TAKE_CHANGED/);
});
test('PCM inspector enforces48kmonoPCM16, RIFF length and duration',()=>{
 const w=wav();assert.equal(validatePcmWav(w).samples,4800);const stereo=Buffer.from(w);stereo.writeUInt16LE(2,22);assert.throws(()=>validatePcmWav(stereo),/VOICE_PCM/);assert.throws(()=>validatePcmWav(w.subarray(0,100)),/VOICE_PCM/);
});
