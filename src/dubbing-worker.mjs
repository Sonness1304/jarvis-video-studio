import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {safeChild} from './core.mjs';import {readAsset,mediaRuntime,probeMedia} from './assets.mjs';import {hashFile} from './runtime.mjs';import {readLimited} from './editor-store.mjs';import {acquireBuildLock,runProcess} from './process.mjs';import {runLocalAsr} from './local-asr.mjs';import {validatePcmWav} from './voice-workbench.mjs';import {validateDubbing,slotPlan,toDubbingSrt,dubbingSignature} from '../web/dubbing-model.mjs';
import {runLocalSpeakers} from './dubbing-speakers.mjs';
import {fitAudioSlot} from './dubbing-fit.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const asrExtractArgs=(original,duration,videoStart)=>['-copyts','-f','mov','-enable_drefs','0','-use_absolute_path','0','-i',original,'-map','0:a:0','-vn','-af',`asetpts=PTS-${videoStart}/TB,aresample=16000:async=1:first_pts=0,apad`,'-t',String(duration),'-ar','16000','-ac','1','-c:a','pcm_s16le'];
export function dubbingMasterArgs(dialogue,background,gain,duration){
 if(!Number.isFinite(duration)||duration<=0||duration>600||!Number.isFinite(gain)||gain<0||gain>1)throw Error('DUB_BACKGROUND_INVALID');
 const args=['-i',dialogue];if(background)args.push('-i',background,'-filter_complex',`[0:a]aformat=channel_layouts=stereo,asplit=2[voice][key];[1:a]volume=${gain}[bed];[bed][key]sidechaincompress=threshold=0.03:ratio=4:attack=20:release=250[ducked];[voice][ducked]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.3:LRA=11[out]`,'-map','[out]');else args.push('-af','loudnorm=I=-16:TP=-1.3:LRA=11');
 return [...args,'-t',String(duration),'-ar','48000','-ac','2','-c:a','pcm_s16le'];
}
export async function runDubbing(root,input){
 if(!input||!['transcribe','speakers','export'].includes(input.action))throw Error('DUB_REQUEST_INVALID');const doc=validateDubbing(input.doc);if(input.action==='transcribe'&&os.freemem()<4*1024**3)throw Error('VOICE_RAM_GATE_4GIB');
 if(input.action==='export'&&doc.schemaVersion===2&&doc.background.mode==='unselected')throw Error('DUB_BACKGROUND_SELECTION_REQUIRED');
 const release=await acquireBuildLock(root),relative='outputs/dub-'+randomUUID(),out=safeChild(root,relative);await fs.mkdir(out);let unknown=false;
 const receipt={schemaVersion:1,status:'RUNNING',action:input.action,documentId:doc.id,documentRevision:input.revision,sourceHash:doc.sourceHash,mediaApiRequests:0,mediaApiCostUsd:0,audioUserApproval:'UNVERIFIED',availableRamStart:os.freemem(),startedAt:new Date().toISOString()};
 try{
  const asset=await readAsset(root,doc.sourceAssetId),original=safeChild(root,'outputs/'+asset.id+'/original.bin');if(asset.kind!=='video'||asset.sourceHash!==doc.sourceHash||await hashFile(original)!==doc.sourceHash||await hashFile(safeChild(root,asset.path))!==asset.sha256)throw Error('DUB_SOURCE_CHANGED');
  const runtime=await mediaRuntime(root),{config,env}=runtime;const run=(name,args)=>runProcess(safeChild(root,config.paths.ffmpeg),['-nostdin','-v','error','-xerror','-protocol_whitelist','file,pipe',...args],{cwd:root,env,log:path.join(out,name+'.log'),onSpawn:release.recordChild,timeoutMs:120000});
  const sourceMeta=probeMedia(root,original,runtime,'video'),normalized=probeMedia(root,safeChild(root,asset.path),runtime,'video'),srcDuration=Number(sourceMeta.format.duration),dstDuration=Number(normalized.format.duration),srcStart=Number(sourceMeta.streams.find(s=>s.codec_type==='video')?.start_time??sourceMeta.format.start_time??0);
  if(!sourceMeta.streams.some(s=>s.codec_type==='audio')||!Number.isFinite(srcStart)||!Number.isFinite(srcDuration)||Math.abs(srcDuration-dstDuration)>1/30+.001||Math.abs(dstDuration-doc.duration)>.001)throw Error('DUB_SOURCE_TIMING');receipt.sourceStartOffset=srcStart;receipt.normalizedVideoSha256=asset.sha256;receipt.duration=doc.duration;
  if(['transcribe','speakers'].includes(input.action)){
   await run('extract',[...asrExtractArgs(original,doc.duration,srcStart),path.join(out,'source.wav')]);const extracted=probeMedia(root,path.join(out,'source.wav'),runtime,'wav');if(Math.abs(Number(extracted.format.duration)-doc.duration)>1/16000)throw Error('DUB_EXTRACT_TIMING');
   if(input.action==='speakers'){Object.assign(receipt,await runLocalSpeakers(root,{out,doc,onSpawn:release.recordChild}));}else{const result=await runLocalAsr(root,{out,engine:input.engine,language:input.language,duration:doc.duration,onSpawn:release.recordChild,env});receipt.asr={...result};delete receipt.asr.segments;
   receipt.segments=result.segments.map((s,i)=>({id:'segment-'+(i+1),start:Number(s.start),end:Number(s.end),sourceText:String(s.text??'').trim(),targetText:''}));validateDubbing({...doc,segments:receipt.segments});receipt.engine=input.engine;}
  }else{
   if(!doc.segments.length)throw Error('DUB_NO_SEGMENTS');const tracks=[];for(const [i,s] of doc.segments.entries()){
    if(!s.targetText.trim()||!s.selection||s.selection.signature!==dubbingSignature(doc,s))throw Error('DUB_TAKE_STALE');const dir=safeChild(root,'.runtime/studio/jobs/'+s.selection.jobId),name=(await fs.readdir(dir)).filter(n=>/^\d{8}\.json$/.test(n)).sort().at(-1),job=JSON.parse(await readLimited(path.join(dir,name))),a=job.result?.audio;
    if(job.kind!=='voice-workbench'||job.status!=='VERIFIED'||job.result.signature!==s.selection.signature||!a||!/^outputs\/[a-zA-Z0-9_-]+\/sample.wav$/.test(a.path)||await hashFile(safeChild(root,a.path))!==a.sha256)throw Error('DUB_TAKE_CHANGED');
    const wav=validatePcmWav(await fs.readFile(safeChild(root,a.path))),file=relative+'/segment-'+i+'.wav';const fit=await fitAudioSlot({input:safeChild(root,a.path),output:safeChild(root,file),start:s.start,end:s.end,duration:wav.samples/wav.sampleRate,approved:s.fitApproved,run:(name,args)=>run('segment-'+i+'-'+name,args)});tracks.push({...fit,end:s.end,file,sourceSha256:a.sha256});
   }
   const mix={duration:doc.duration,tracks,output:relative+'/dialogue.wav'};await fs.writeFile(path.join(out,'mix-request.json'),JSON.stringify(mix));await runProcess(safeChild(root,config.paths.python),['src/dubbing_audio.py',relative+'/mix-request.json'],{cwd:root,env,log:path.join(out,'mix.log'),onSpawn:release.recordChild});
   let background=null;receipt.background=doc.background??{mode:'voice-only',legacy:true};
   if(doc.background?.mode==='separate'){background=await readAsset(root,doc.background.assetId);if(background.kind!=='music'||background.duration+1/48000<doc.duration||await hashFile(safeChild(root,background.path))!==background.sha256)throw Error('DUB_BACKGROUND_CHANGED_OR_SHORT');receipt.background={...doc.background,sha256:background.sha256};}
   await run('master',[...dubbingMasterArgs(path.join(out,'dialogue.wav'),background?safeChild(root,background.path):null,doc.background?.gain??0,doc.duration),path.join(out,'sample.wav')]);
   await run('mux',['-i',safeChild(root,asset.path),'-i',path.join(out,'sample.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',String(doc.duration),'-movflags','+faststart',path.join(out,'video.mp4')]);
   await run('decode',['-i',path.join(out,'video.mp4'),'-map','0:v:0','-map','0:a:0','-f','null','-']);await fs.writeFile(path.join(out,'captions.srt'),toDubbingSrt(doc));await fs.writeFile(path.join(out,'source.srt'),toDubbingSrt(doc,true));
   receipt.audio={path:relative+'/sample.wav',sha256:await hashFile(path.join(out,'sample.wav'))};receipt.artifacts={video:{path:relative+'/video.mp4',sha256:await hashFile(path.join(out,'video.mp4'))},captions:{path:relative+'/captions.srt',sha256:await hashFile(path.join(out,'captions.srt'))}};receipt.tracks=tracks;
  }
  receipt.status='VERIFIED';return receipt;
 }catch(e){unknown=e.code==='VOICE_OUTCOME_UNKNOWN';receipt.status=unknown?'UNKNOWN':'FAILED';receipt.error=e.code??e.message;return receipt;}
 finally{receipt.endedAt=new Date().toISOString();await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));if(!unknown)await release();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const r=await runDubbing(ROOT,JSON.parse(await readLimited(safeChild(ROOT,process.argv[2]),2*1024*1024)));console.log(JSON.stringify(r));process.exitCode=r.status==='VERIFIED'?0:1;}catch(e){console.log(JSON.stringify({status:'FAILED',error:/^[A-Z0-9_]+$/.test(e.message)?e.message:'DUB_WORKER_FAILED'}));process.exitCode=1;}}
