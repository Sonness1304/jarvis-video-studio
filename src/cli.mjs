import fs from 'node:fs/promises';import {existsSync,createReadStream} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash,randomUUID} from 'node:crypto';import os from 'node:os';import {execFileSync} from 'node:child_process';
import {validateBrief,buildTimeline,toSrt,buildSpeechPhrases,safeChild,validateExport} from './core.mjs';
import {runProcess,childEnvironment,acquireBuildLock,recoverBuildLock,strictDecodeArgs} from './process.mjs';
import {preflight} from './runtime.mjs';
import {readVoices,canonicalVoice} from './studio.mjs';
import {voiceSettings} from './voice-preview.mjs';
import {resolveVoiceRequests,synthesizeRows} from './voice-workbench.mjs';
import {readMedia} from './media.mjs';
import {validateMusic} from './assets.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const hashFile=async file=>{const h=createHash('sha256');for await(const data of createReadStream(file))h.update(data);return h.digest('hex');};
const readJson=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const writeJson=async(file,value)=>fs.writeFile(file,JSON.stringify(value,null,2));
function sourceIdentity(){try{return {head:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8',windowsHide:true}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{cwd:ROOT,encoding:'utf8',windowsHide:true}).trim()};}catch{return {head:null,dirty:true};}}
async function build(briefFile){
 validateBrief(await readJson(safeChild(ROOT,briefFile)));
 await readMedia(ROOT,await readJson(safeChild(ROOT,briefFile)));
 await validateMusic(ROOT,(await readJson(safeChild(ROOT,briefFile))).music);
 const release=await acquireBuildLock(ROOT);try{return await buildLocked(briefFile,release.recordChild);}finally{await release();}
}
async function buildLocked(briefFile,onSpawn){
 const brief=validateBrief(await readJson(safeChild(ROOT,briefFile)));
 brief.voice=canonicalVoice(brief.voice,await readVoices(ROOT));
 const {config,models,installed,fingerprint}=await preflight(ROOT);const env=childEnvironment(ROOT,config);
 const attempt=brief.id+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
 const relative='outputs/'+attempt,out=safeChild(ROOT,relative);await fs.mkdir(out,{recursive:true});
 const started=Date.now();const receipt={schemaVersion:1,status:'RUNNING',attempt,briefHash:await hashFile(safeChild(ROOT,briefFile)),source:sourceIdentity(),startedAt:new Date(started).toISOString(),mediaApiRequests:0,mediaApiCostUsd:0,modelTokenUsage:null,availableRamStart:os.freemem(),runtime:config.versions,runtimeFingerprint:fingerprint,installedPython:installed,artifacts:{},stages:[]};await writeJson(path.join(out,'receipt.json'),receipt);
 const run=async(label,exe,args,cwd=ROOT)=>{const start=Date.now();try{await runProcess(exe,args,{cwd,env,log:path.join(out,label+'.log'),onSpawn});receipt.stages.push({id:label,status:'VERIFIED',elapsedMs:Date.now()-start});}catch(error){receipt.stages.push({id:label,status:'FAILED',elapsedMs:Date.now()-start,error:error.message});throw error;}await writeJson(path.join(out,'receipt.json'),receipt);};
 try{
  const media=await readMedia(ROOT,brief),staged=new Map();for(const [i,s] of brief.scenes.entries())if(s.visual==='media'&&s.media.kind==='video'){
   const asset=media.find(a=>a.name==='media-'+i+'.mp4'),file=path.join(out,'source-'+i+'.mp4');await fs.copyFile(asset.file,file);if(await hashFile(file)!==asset.sha256)throw Error('MEDIA_HASH_CHANGED');staged.set(i,file);
  }
  const music=await validateMusic(ROOT,brief.music);if(music){await fs.copyFile(safeChild(ROOT,music.path),path.join(out,'background.wav'));if(await hashFile(path.join(out,'background.wav'))!==music.sha256)throw Error('MUSIC_CHANGED');}
  const voiceRuntime=voiceSettings(brief.voice,{config,models,installed});
  const phrases=buildSpeechPhrases(brief,voiceRuntime);
  await writeJson(path.join(out,'brief.json'),brief);await writeJson(path.join(out,'tts-request.json'),{voice:brief.voice,phrases,resultFile:relative+'/tts-result.json'});
  if(brief.voiceWorkbench){const rows=await resolveVoiceRequests(ROOT,brief,voiceRuntime);await synthesizeRows(ROOT,rows,{config,env,outRelative:relative,onSpawn});}
  else await run('tts',path.join(ROOT,config.paths.python),['src/tts.py','synthesize',relative+'/tts-request.json']);
  const speech=await readJson(path.join(out,'tts-result.json'));const timeline=buildTimeline(brief,speech.audio);timeline.mixFile=relative+'/mix.wav';timeline.source=receipt.source;timeline.voiceRuntime=voiceRuntime;
  if(music)timeline.music={...brief.music,path:relative+'/background.wav'};
  for(const [i,s] of timeline.scenes.entries())if(s.visual==='media'&&s.media.kind==='video'){
   const duration=(i===timeline.scenes.length-1?timeline.duration:s.end)-(i===0?0:s.start),target=path.join(out,'scene-'+i+'.mp4'),window=s.media.end-s.media.start;
   await run('media-'+i,path.join(ROOT,config.paths.ffmpeg),['-nostdin','-v','error','-xerror','-protocol_whitelist','file,pipe','-ss',String(s.media.start),'-i',staged.get(i),'-an','-vf',`trim=duration=${window},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${duration},fps=30,format=yuv420p`,'-t',String(duration),'-c:v','libx264','-threads','2','-preset','fast','-crf','21','-movflags','+faststart',target]);
   s.media={...s.media,path:relative+'/scene-'+i+'.mp4',sha256:await hashFile(target),start:0,end:duration};
  }
  await writeJson(path.join(out,'timeline.json'),timeline);await fs.writeFile(path.join(out,'captions.srt'),toSrt(timeline));
  await run('mix',path.join(ROOT,config.paths.python),['src/tts.py','mix',relative+'/timeline.json']);
  await run('loudness',path.join(ROOT,config.paths.ffmpeg),['-v','info','-i',path.join(out,'mix.wav'),'-af','aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-1.3:LRA=11:print_format=json','-ar','48000','-ac','2','-c:a','pcm_s16le',path.join(out,'master.wav')]);
  const {writeComposition}=await import('./composition.mjs');await writeComposition(out,timeline,config,ROOT);
  const renderer=path.join(ROOT,config.paths.renderer);
  await run('lint',process.execPath,[renderer,'lint',out]);await run('check',process.execPath,[renderer,'check',out]);
  await run('render',process.execPath,[renderer,'render',out,'--output',path.join(out,'video.mp4'),'--fps','30','--workers','1','--quality','high','--no-browser-gpu','--low-memory-mode']);
  const ffprobe=path.join(ROOT,config.paths.ffprobe),ffmpeg=path.join(ROOT,config.paths.ffmpeg);
  const metadata=JSON.parse(execFileSync(ffprobe,['-v','error','-show_streams','-show_format','-of','json',path.join(out,'video.mp4')],{env,encoding:'utf8',windowsHide:true,maxBuffer:1024*1024}));validateExport(metadata,timeline.duration,timeline);
  await run('decode',ffmpeg,strictDecodeArgs(path.join(out,'video.mp4')));
  await writeJson(path.join(out,'ffprobe.json'),metadata);
  receipt.renderInputs={brief:await hashFile(path.join(out,'brief.json')),timeline:await hashFile(path.join(out,'timeline.json')),captions:await hashFile(path.join(out,'captions.srt')),composition:await hashFile(path.join(out,'index.html'))};
  receipt.status='VERIFIED';receipt.duration=timeline.duration;receipt.generatedPhrases=speech.generated;receipt.cachedPhrases=phrases.length-speech.generated;receipt.elapsedMs=Date.now()-started;receipt.availableRamEnd=os.freemem();receipt.artifacts.video={path:relative+'/video.mp4',sha256:await hashFile(path.join(out,'video.mp4')),bytes:(await fs.stat(path.join(out,'video.mp4'))).size};receipt.aestheticUserApproval='UNVERIFIED';
  await writeJson(path.join(out,'receipt.json'),receipt);return receipt;
 }catch(error){receipt.status='FAILED';receipt.error=error.message;receipt.elapsedMs=Date.now()-started;await writeJson(path.join(out,'receipt.json'),receipt);throw Error(error.message+' ATTEMPT='+attempt);}
}
async function main(){const [command,file,...extra]=process.argv.slice(2);if(command==='recover-lock'&&!file&&!extra.length)return recoverBuildLock(ROOT);if(extra.length||!file||!['inspect','build','qa'].includes(command))throw Error('USAGE: inspect|build BRIEF_JSON, qa OUTPUT_FOLDER, recover-lock');
 if(command==='inspect'){const b=validateBrief(await readJson(safeChild(ROOT,file)));return {status:'VERIFIED',executionStatus:'UNVERIFIED',id:b.id,title:b.title,scenes:b.scenes.length,phrases:b.scenes.reduce((n,s)=>n+s.phrases.length,0),root:ROOT};}
 if(command==='qa'){const {qaExport}=await import('./qa.mjs');return await qaExport(ROOT,file,await preflight(ROOT));}
 return await build(file);
}
main().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.log(JSON.stringify({status:'FAILED',error:e.message}));process.exitCode=1;});
