import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {audioCacheKey,safeChild} from './core.mjs';import {hashFile} from './runtime.mjs';import {readLimited} from './editor-store.mjs';import {canonicalVoice,readVoices} from './studio.mjs';
import {phraseVoice,voiceSignature,pronounce,validateVoice} from '../web/voice-model.mjs';import {runProcess} from './process.mjs';import {VoiceStudioClient} from './voicestudio-client.mjs';import {VoiceProfiles} from './voice-profiles.mjs';
export function voiceWorkbenchRequest(v){
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['text','voice','signature','takeId','seed'].includes(k))||typeof v.text!=='string'||!v.text.trim()||v.text.length>240||/[\x00-\x1f]/.test(v.text)||typeof v.signature!=='string'||!v.signature||v.signature.length>2048||!/^take-[a-z0-9-]{1,48}$/.test(v.takeId??'')||!Number.isSafeInteger(v.seed)||v.seed<0||v.seed>4294967295)throw Error('VOICE_REQUEST_INVALID');validateVoice(v.voice);return structuredClone(v);
}
export function validatePcmWav(w){
 const fail=()=>{throw Error('VOICE_PCM_INVALID');};if(!Buffer.isBuffer(w)||w.length<44||w.length>20*1024**2||w.toString('ascii',0,4)!=='RIFF'||w.toString('ascii',8,12)!=='WAVE'||w.readUInt32LE(4)+8!==w.length)fail();let fmt,data;for(let i=12;i+8<=w.length;){const n=w.readUInt32LE(i+4);if(i+8+n>w.length)fail();if(w.toString('ascii',i,i+4)==='fmt ')fmt=w.subarray(i+8,i+8+n);if(w.toString('ascii',i,i+4)==='data')data=w.subarray(i+8,i+8+n);i+=8+n+(n%2);}
 if(!fmt||fmt.length<16||fmt.readUInt16LE(0)!==1||fmt.readUInt16LE(2)!==1||fmt.readUInt32LE(4)!==48000||fmt.readUInt16LE(14)!==16||!data?.length||data.length%2||data.length/2>90*48000)fail();return {samples:data.length/2,sampleRate:48000};
}
async function readJob(root,id){const dir=safeChild(root,'.runtime/studio/jobs/'+id),name=(await fs.readdir(dir)).filter(n=>/^\d{8}\.json$/.test(n)).sort().at(-1);return JSON.parse(await readLimited(path.join(dir,name)));}
export async function resolveVoiceRequests(root,brief,runtime,lookup=id=>readJob(root,id)){
 const voices=await readVoices(root).catch(e=>{if(e.code==='ENOENT')return null;throw e;}),rows=[];
 for(const s of brief.scenes)for(const p of s.phrases){const voice=validateVoice(phraseVoice(brief,s)),text=pronounce(p.text,brief.voiceWorkbench?.dictionary,p.speechText),signature=voiceSignature(brief,s,p),selected=brief.voiceWorkbench?.selections?.[p.id];
  const dictionaryHash=createHash('sha256').update(JSON.stringify(brief.voiceWorkbench?.dictionary??[])).digest('hex');const row={id:p.id,text,voice,signature,cacheKey:audioCacheKey(text,{...runtime,workbench:2,voice,signature,dictionaryHash})};
  if(selected){if(selected.signature!==signature)throw Error('VOICE_TAKE_STALE');const job=await lookup(selected.jobId),a=job.result?.audio;if(job.status!=='VERIFIED'||job.kind!=='voice-workbench'||job.result?.signature!==signature||!a||!/^outputs\/[a-zA-Z0-9_-]+\/sample.wav$/.test(a.path??''))throw Error('VOICE_TAKE_STALE');if(await hashFile(safeChild(root,a.path))!==a.sha256)throw Error('VOICE_TAKE_CHANGED');Object.assign(a,validatePcmWav(await fs.readFile(safeChild(root,a.path))));row.selected=a;
  }else if(voice.provider==='voicestudio')throw Error('VOICE_SELECT_TAKE_BEFORE_EXPORT');
  if(voice.provider==='vieneu'&&voices)canonicalVoice(voice.voiceId,voices);if(voice.provider==='profile')row.profile=await new VoiceProfiles(root).read(voice.voiceId,voice.revision);rows.push(row);
 }return rows;
}
export async function synthesizeRows(root,rows,{config,env,outRelative,onSpawn=()=>{}}){
 const out=safeChild(root,outRelative),request={voice:rows[0]?.voice.voiceId,phrases:[],resultFile:outRelative+'/tts-result.json'};
 for(const row of rows){if(row.selected){request.phrases.push({...row,source:{file:row.selected.path,sha256:row.selected.sha256}});continue;}
  if(row.voice.provider==='voicestudio')throw Error('VOICE_SELECT_TAKE_BEFORE_EXPORT');
  request.phrases.push({...row,voice:row.voice.voiceId,...(row.profile?{profile:row.profile}:{})});
 }
 await fs.writeFile(path.join(out,'tts-request.json'),JSON.stringify(request));await runProcess(safeChild(root,config.paths.python),['src/tts.py','synthesize',outRelative+'/tts-request.json'],{cwd:root,env,log:path.join(out,'tts.log'),onSpawn});return JSON.parse(await readLimited(safeChild(root,request.resultFile)));
}
export async function normalizeVoiceAudio(root,bytes,{config,env,outRelative,onSpawn=()=>{}}){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>20*1024**2)throw Error('VOICE_RESPONSE_SIZE');const out=safeChild(root,outRelative);await fs.writeFile(path.join(out,'source.wav'),bytes,{flag:'wx'});
 const probe=JSON.parse(execFileSync(safeChild(root,config.paths.ffprobe),['-v','error','-protocol_whitelist','file,pipe','-f','wav','-show_format','-of','json',path.join(out,'source.wav')],{cwd:root,env,windowsHide:true,encoding:'utf8',timeout:10000,maxBuffer:32768}));if(!Number.isFinite(Number(probe.format?.duration))||Number(probe.format.duration)<=0||Number(probe.format.duration)>90)throw Error('VOICE_DURATION_INVALID');
 await runProcess(safeChild(root,config.paths.python),['src/voice_qc.py',outRelative+'/source.wav',outRelative+'/qc.json'],{cwd:root,env,log:path.join(out,'qc.log'),timeoutMs:30000,onSpawn});
 await runProcess(safeChild(root,config.paths.ffmpeg),['-nostdin','-v','error','-xerror','-protocol_whitelist','file,pipe','-f','wav','-i',path.join(out,'source.wav'),'-t','90.001','-map','0:a:0','-ar','48000','-ac','1','-c:a','pcm_s16le',path.join(out,'sample.wav')],{cwd:root,env,log:path.join(out,'normalize.log'),timeoutMs:120000,onSpawn});const wav=await fs.readFile(path.join(out,'sample.wav')),meta=validatePcmWav(wav);
 return {path:outRelative+'/sample.wav',sha256:createHash('sha256').update(wav).digest('hex'),...meta,sourceSha256:createHash('sha256').update(bytes).digest('hex'),qc:JSON.parse(await readLimited(path.join(out,'qc.json')))};
}
export async function companionPreview(root,row,options){const client=new VoiceStudioClient();const status=await client.status();if(!status.ready||!status.models.some(m=>m.id===row.voice.engine&&m.kind==='tts'&&!m.alias&&m.weightsReady)||!status.voices.some(v=>v.voice_id===row.voice.voiceId))throw Error('VOICE_ID_UNAVAILABLE_OR_MODEL_NOT_INSTALLED');const bytes=await client.speech({engine:row.voice.engine,voiceId:row.voice.voiceId,text:row.text});return normalizeVoiceAudio(root,bytes,options);}
