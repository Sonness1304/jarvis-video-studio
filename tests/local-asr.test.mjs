import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {runLocalAsr} from '../src/local-asr.mjs';
import {dubbingRoutes} from '../src/dubbing-routes.mjs';import {DubbingStore} from '../src/voice-dubbing.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'local-asr-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const app=path.join(root,'app'),local=path.join(root,'local'),runtime=path.join(root,'runtime'),out=path.join(root,'outputs','dub-test');
 await fs.mkdir(path.join(app,'VoiceStudio'),{recursive:true});await fs.mkdir(path.join(runtime,'project/.venv/Scripts'),{recursive:true});await fs.mkdir(out,{recursive:true});
 await fs.writeFile(path.join(app,'VoiceStudio/runtime-location.json'),JSON.stringify({root:runtime}));await fs.writeFile(path.join(runtime,'project/.venv/Scripts/python.exe'),'pinned-python');
 await fs.writeFile(path.join(root,'voicestudio-runtime.lock.json'),JSON.stringify({asr:{pythonSha256:sha('pinned-python'),modelRevision:'a'.repeat(40)}}));await fs.writeFile(path.join(out,'source.wav'),'audio');return {root,out,appData:app,localAppData:local,freeMemory:()=>5*1024**3};
}
test('local ASR uses owned installed interpreter with isolated offline env and validates bound result',async t=>{
 const f=await fixture(t);let pid;const result=await runLocalAsr(f.root,{out:f.out,engine:'faster-whisper',language:'vi',duration:6,onSpawn:p=>pid=p,env:{PATH:process.env.PATH,API_KEY:'never'}},{...f,run:async(exe,args,options)=>{
  assert.match(exe,/python\.exe$/);assert.deepEqual(args.slice(0,3),['-I','-X','utf8']);assert.match(args[3],/local_asr\.py$/);assert.equal(options.env.API_KEY,undefined);assert.equal(options.env.HF_HUB_OFFLINE,'1');assert.equal(options.timeoutMs,600000);
  const request=JSON.parse(await fs.readFile(args[4],'utf8'));assert.equal(request.audioSha256,sha('audio'));assert.equal(request.duration,6);options.onSpawn(123);
  await fs.writeFile(path.join(f.out,'asr-result.json'),JSON.stringify({schemaVersion:1,status:'VERIFIED',nonce:request.nonce,audioSha256:request.audioSha256,engine:'faster-whisper',modelRevision:'a'.repeat(40),device:'cpu',computeType:'int8',segments:[{start:0,end:2,text:'Xin chào'}]}));
 }});assert.equal(pid,123);assert.equal(result.segments[0].text,'Xin chào');
});
test('ASR refuses invalid engine/language, insufficient RAM and changed interpreter before spawn',async t=>{
 const f=await fixture(t),request={out:f.out,engine:'faster-whisper',language:'vi',duration:6};let called=false;const deps={...f,run:async()=>{called=true;}};
 for(const change of [{engine:'remote'},{language:'vi;command'},{duration:601}])await assert.rejects(runLocalAsr(f.root,{...request,...change},deps),/ASR_REQUEST_INVALID/);
 await assert.rejects(runLocalAsr(f.root,request,{...deps,freeMemory:()=>1}),/VOICE_RAM_GATE_4GIB/);
 await fs.writeFile(path.join(f.root,'runtime/project/.venv/Scripts/python.exe'),'changed');await assert.rejects(runLocalAsr(f.root,request,deps),/VOICE_ASR_RUNTIME_CHANGED/);assert.equal(called,false);
});
test('local child timeout keeps outcome UNKNOWN rather than allowing a duplicate',async t=>{
 const f=await fixture(t);await assert.rejects(runLocalAsr(f.root,{out:f.out,engine:'faster-whisper',language:'vi',duration:6},{...f,run:async(exe,args,options)=>{options.onSpawn(456);throw Error('PROCESS_TIMEOUT');}}),e=>e.code==='VOICE_OUTCOME_UNKNOWN');
});
test('completed child cannot substitute a stale result with another nonce',async t=>{
 const f=await fixture(t);await assert.rejects(runLocalAsr(f.root,{out:f.out,engine:'faster-whisper',language:'vi',duration:6},{...f,run:async()=>{await fs.writeFile(path.join(f.out,'asr-result.json'),JSON.stringify({nonce:'wrong'}));}}),/VOICE_ASR_RESULT_INVALID/);
});
test('transcribe route rejects foreign engines before admitting a heavy job',async t=>{
 const f=await fixture(t),store=new DubbingStore(f.root),record=await store.create({id:'asset-test',sourceHash:'a'.repeat(64),duration:6});let called=false;
 const route=dubbingRoutes({root:f.root,jobs:{start:async()=>{called=true;}}});
 await assert.rejects(route({req:{method:'POST'},res:{},route:'/api/dubbing/'+record.doc.id+'/transcribe',body:async()=>({expectedRevision:1,engine:'remote-engine',language:'vi'}),json(){}}),/DUB_ASR_REQUEST_INVALID/);assert.equal(called,false);
});

test('consumer ASR lock takes precedence over a missing external VoiceStudio and fails closed on changed local Python',async t=>{
 const f=await fixture(t);await fs.mkdir(path.join(f.root,'.venv-asr/Scripts'),{recursive:true});await fs.writeFile(path.join(f.root,'.venv-asr/Scripts/python.exe'),'local-python');
 await fs.writeFile(path.join(f.root,'asr-runtime.lock.json'),JSON.stringify({schemaVersion:1,pythonPath:'.venv-asr/Scripts/python.exe',pythonSha256:sha('local-python'),modelRevision:'a'.repeat(40)}));
 await fs.unlink(path.join(f.appData,'VoiceStudio/runtime-location.json'));let called=false;
 const deps={...f,run:async(exe,args)=>{called=true;assert.equal(exe,path.join(f.root,'.venv-asr/Scripts/python.exe'));const r=JSON.parse(await fs.readFile(args[4],'utf8'));assert.equal(r.runtimeLock,'asr-runtime.lock.json');await fs.writeFile(path.join(f.out,'asr-result.json'),JSON.stringify({schemaVersion:1,status:'VERIFIED',nonce:r.nonce,audioSha256:r.audioSha256,engine:'faster-whisper',modelRevision:'a'.repeat(40),device:'cpu',computeType:'int8',segments:[]}));}};
 await runLocalAsr(f.root,{out:f.out,engine:'faster-whisper',language:'en',duration:6},deps);assert.equal(called,true);called=false;await fs.writeFile(path.join(f.root,'.venv-asr/Scripts/python.exe'),'changed');
 await assert.rejects(runLocalAsr(f.root,{out:f.out,engine:'faster-whisper',language:'en',duration:6},deps),/VOICE_ASR_RUNTIME_CHANGED/);assert.equal(called,false);
});
