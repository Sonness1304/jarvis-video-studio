import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {randomUUID,randomBytes} from 'node:crypto';import {spawn} from 'node:child_process';
import {safeChild} from './core.mjs';import {canonicalBrief,readLimited} from './editor-store.mjs';import {atomicJson} from './editor-atomic.mjs';import {VoiceStudioClient} from './voicestudio-client.mjs';import {VoiceProfiles,validateProfileInput} from './voice-profiles.mjs';import {readAsset,mediaRuntime} from './assets.mjs';import {hashFile} from './runtime.mjs';import {runProcess,acquireBuildLock,childEnvironment} from './process.mjs';import {pronounce,phraseVoice,voiceSignature,validateVoice,topicHints} from '../web/voice-model.mjs';
const object=(v,allowed)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw Error('VOICE_REQUEST_INVALID');};
export function voiceRoutes({root,store,jobs}){
 const profiles=new VoiceProfiles(root),client=new VoiceStudioClient({timeoutMs:10000});
 return async({req,res,route,body,json})=>{
  if(!route.startsWith('/api/voice-workbench/'))return false;
  const action=route.slice('/api/voice-workbench/'.length),post=req.method==='POST',input=post?await body(req):null;
  if(action==='status'&&!post){let companion;try{companion=await client.status();}catch(e){companion={ready:false,status:e.code??'VOICE_UNAVAILABLE',voices:[],models:[]};}json(res,200,{companion,freeRamGiB:os.freemem()/1024**3,profiles:await profiles.list()});return true;}
  if(action==='open'&&post){object(input,[]);const config=JSON.parse(await fs.readFile(safeChild(root,'runtime-config.json'),'utf8'));const child=spawn('C:/Program Files/PowerShell/7/pwsh.exe',['-NoProfile','-File',safeChild(root,'scripts/start-voicestudio.ps1')],{cwd:root,env:childEnvironment(root,config),windowsHide:true,stdio:'ignore'});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();json(res,202,{status:'OPEN_REQUESTED'});return true;}
  if(action==='preferences'){
   const dir=safeChild(root,'.runtime/studio/voice-preferences');await fs.mkdir(dir,{recursive:true});const names=(await fs.readdir(dir)).filter(n=>/^\d+-[a-f0-9-]+\.json$/.test(n)).sort();const pref=names.length?JSON.parse(await readLimited(path.join(dir,names.at(-1)))):{};
   if(post){object(input,['topic','voice']);if(!Object.hasOwn(topicHints,input.topic))throw Error('VOICE_TOPIC_INVALID');validateVoice(input.voice);pref[input.topic]=input.voice;await atomicJson(root,path.join(dir,Date.now()+'-'+randomUUID()+'.json'),pref);}json(res,200,pref);return true;
  }
  if(action==='preview'&&post){
   object(input,['projectId','expectedRevision','brief','sceneId','phraseId']);const p=await store.read(input.projectId);if(p.revision!==input.expectedRevision)throw Error('REVISION_CONFLICT');const b=canonicalBrief(input.brief);if(b.id!==p.brief.id)throw Error('VOICE_TARGET_INVALID');const s=b.scenes.find(s=>s.id===input.sceneId),phrase=s?.phrases.find(p=>p.id===input.phraseId);if(!phrase)throw Error('VOICE_TARGET_INVALID');
   const request={text:pronounce(phrase.text,b.voiceWorkbench?.dictionary,phrase.speechText),voice:phraseVoice(b,s),signature:voiceSignature(b,s,phrase),takeId:'take-'+randomUUID(),seed:randomBytes(4).readUInt32LE()};json(res,202,await jobs.start('voice-workbench',{projectId:b.id,projectRevision:p.revision,request}));return true;
  }
  if(action==='profiles'&&!post){json(res,200,await profiles.list());return true;}
  if(action==='profiles'&&post){
   object(input,['assetId','start','end','name','rights','transcript']);if(!Number.isFinite(input.start)||!Number.isFinite(input.end)||input.start<0||input.end-input.start<3||input.end-input.start>8)throw Error('PROFILE_SEGMENT_INVALID');validateProfileInput({name:input.name,rights:input.rights,transcript:input.transcript,duration:input.end-input.start});
   const result=await jobs.exclusive(async()=>{const a=await readAsset(root,input.assetId);if(a.kind!=='music'||input.end>a.duration||await hashFile(safeChild(root,a.path))!==a.sha256)throw Error('PROFILE_SOURCE_INVALID');const release=await acquireBuildLock(root);try{
    const runtime=await mediaRuntime(root),relative='outputs/voice-reference-'+randomUUID(),out=safeChild(root,relative);await fs.mkdir(out);await runProcess(safeChild(root,runtime.config.paths.ffmpeg),['-nostdin','-v','error','-xerror','-ss',String(input.start),'-i',safeChild(root,a.path),'-t',String(input.end-input.start),'-ar','48000','-ac','1','-c:a','pcm_s16le',path.join(out,'reference.wav')],{cwd:root,env:runtime.env,log:path.join(out,'extract.log'),onSpawn:release.recordChild});
    await runProcess(safeChild(root,runtime.config.paths.python),['-c',"import sys;sys.path.insert(0,'src');from voice_clone import validate_reference;from audio import read_pcm;a,sr=read_pcm(sys.argv[1]);validate_reference(a,sr,sys.argv[2])",relative+'/reference.wav',input.rights],{cwd:root,env:runtime.env,log:path.join(out,'validate.log'),onSpawn:release.recordChild});
    return profiles.create({name:input.name,rights:input.rights,transcript:input.transcript,duration:input.end-input.start},await fs.readFile(path.join(out,'reference.wav')));
   }finally{await release();}});json(res,201,result);return true;
  }
  const archive=/^profiles\/(profile-[a-f0-9-]{36})\/archive$/.exec(action);if(archive&&post){object(input,['expectedRevision']);json(res,200,await profiles.archive(archive[1],input.expectedRevision));return true;}
  return false;
 };
}
