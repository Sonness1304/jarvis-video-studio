import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {randomUUID,createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {safeChild,audioCacheKey} from './core.mjs';import {preflight,hashFile} from './runtime.mjs';import {runProcess,childEnvironment,acquireBuildLock} from './process.mjs';import {voiceSettings} from './voice-preview.mjs';
import {voiceWorkbenchRequest,synthesizeRows,companionPreview,validatePcmWav} from './voice-workbench.mjs';import {VoiceProfiles} from './voice-profiles.mjs';import {canonicalVoice,readVoices} from './studio.mjs';import {readLimited} from './editor-store.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
export async function previewTake(root,input){
 const request=voiceWorkbenchRequest(input);if(request.voice.provider==='vieneu')canonicalVoice(request.voice.voiceId,await readVoices(root));
 if(request.voice.provider==='profile'&&os.freemem()<4*1024**3)throw Error('VOICE_RAM_GATE_4GIB');
 const release=await acquireBuildLock(root),outRelative='outputs/voice-take-'+randomUUID(),out=safeChild(root,outRelative);await fs.mkdir(out,{recursive:true});let unknown=false;
 const receipt={schemaVersion:1,status:'RUNNING',request,signature:request.signature,takeId:request.takeId,mediaApiRequests:0,mediaApiCostUsd:0,audioUserApproval:'UNVERIFIED',startedAt:new Date().toISOString()};
 const write=()=>fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));await write();
 try{
  const runtime=await preflight(root),{config}=runtime,env=childEnvironment(root,config),options={config,env,outRelative,onSpawn:release.recordChild};
  if(request.voice.provider==='voicestudio')receipt.audio=await companionPreview(root,{voice:request.voice,text:request.text},options);
  else{
   const settings=voiceSettings(request.voice.voiceId,runtime),profile=request.voice.provider==='profile'?await new VoiceProfiles(root).read(request.voice.voiceId,request.voice.revision):null;
   if(profile?.archived)throw Error('PROFILE_ARCHIVED');const identity={...settings,provider:request.voice.provider,profileHash:profile?.sourceHash??null,takeId:request.takeId,seed:request.seed};
   const row={id:'sample',text:request.text,voice:request.voice,seed:request.seed,cacheKey:audioCacheKey(request.text,identity),...(profile?{profile}:{})};
   const result=await synthesizeRows(root,[row],options),a=result.audio.sample;if(await hashFile(safeChild(root,a.file))!==a.sha256)throw Error('VOICE_TAKE_CHANGED');
   await fs.copyFile(safeChild(root,a.file),path.join(out,'sample.wav'));receipt.audio={path:outRelative+'/sample.wav',sha256:a.sha256,...validatePcmWav(await fs.readFile(path.join(out,'sample.wav'))),qc:a.qc};receipt.generated=result.generated;receipt.runtime=identity;
  }
  await runProcess(safeChild(root,config.paths.ffmpeg),['-v','error','-xerror','-i',path.join(out,'sample.wav'),'-map','0:a:0','-f','null','-'],{cwd:root,env,log:path.join(out,'decode.log'),onSpawn:release.recordChild});
  receipt.status='VERIFIED';receipt.duration=receipt.audio.samples/receipt.audio.sampleRate;return receipt;
 }catch(e){unknown=e.code==='VOICE_OUTCOME_UNKNOWN';receipt.status=unknown?'UNKNOWN':'FAILED';receipt.error=e.code??e.message;return receipt;}
 finally{receipt.endedAt=new Date().toISOString();await write();if(!unknown)await release();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const input=JSON.parse(await readLimited(safeChild(ROOT,process.argv[2])));const result=await previewTake(ROOT,input);console.log(JSON.stringify(result));process.exitCode=result.status==='VERIFIED'?0:1;}
 catch(e){console.log(JSON.stringify({status:'FAILED',error:/^[A-Z0-9_]+$/.test(e.message)?e.message:'VOICE_WORKER_FAILED'}));process.exitCode=1;}
}
