import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {validateBrief,buildTimeline,buildSpeechPhrases,toSrt,validateExport,safeChild} from '../src/core.mjs';
import {preflight,hashFile} from '../src/runtime.mjs';
import {readVoices,canonicalVoice} from '../src/studio.mjs';
import {voiceSettings} from '../src/voice-preview.mjs';
import {acquireBuildLock,runProcess,childEnvironment,strictDecodeArgs} from '../src/process.mjs';
import {renderPilotHtml} from './chuyen-lech-scenes.mjs';
import {renderReleaseHtml,createReleaseSfx,releaseCaptionCues} from './chuyen-lech-launch-scenes.mjs';
import {renderCameraHtml} from './chuyen-lech-camera-scenes.mjs';
import {renderCameraStoryHtml,createCameraSoundbed} from './chuyen-lech-camera-story.mjs';
import {readMedia} from '../src/media.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export function validatePilotBrief(kind,brief){
 if(!['atm','gravity','parcel'].includes(kind)||brief.id!=='chuyen-lech-'+kind)throw Error('PILOT_ID_MISMATCH');
 validateBrief(brief);
 if(brief.format!=='portrait'||brief.scenes.length!==6||brief.scenes.some(s=>s.visual!=='story-card'||s.phrases.length!==1||s.media||s.lab||s.shots)||brief.music)throw Error('PILOT_SCOPE_MISMATCH');
 return brief;
}
export function validateReleaseBrief(kind,brief){
 if(!['atm','gravity','parcel','shadow','undo'].includes(kind)||brief.id!=='chuyen-lech-'+kind+'-launch')throw Error('RELEASE_ID_MISMATCH');
 validateBrief(brief);
 if(brief.format!=='portrait'||brief.scenes.length!==6||brief.scenes.some(s=>s.visual!=='story-card'||s.phrases.length!==1||s.media||s.lab||s.shots)||brief.music)throw Error('RELEASE_SCOPE_MISMATCH');
 return brief;
}
export function validateCameraBrief(brief){
 validateBrief(brief);
 if(brief.id!=='chuyen-lech-camera-animatic'||brief.format!=='portrait'||brief.scenes.length!==3||brief.music||brief.scenes.some(s=>s.visual!=='media'||s.media?.kind!=='image'||s.shots))throw Error('CAMERA_ANIMATIC_SCOPE');
 return brief;
}
export function validateCameraStoryBrief(brief){
 validateBrief(brief);
 if(brief.id!=='chuyen-lech-camera-story'||brief.format!=='portrait'||brief.scenes.length!==16||brief.music||brief.scenes.some(s=>s.visual!=='media'||s.media?.kind!=='image'||s.shots))throw Error('CAMERA_STORY_SCOPE');
 return brief;
}
async function build(kind,file,edition='pilot'){
 const launch=edition==='release';
 const camera=edition==='camera';
 const story=edition==='story';
 const input=JSON.parse(await fs.readFile(safeChild(root,file),'utf8'));
 const brief=story?validateCameraStoryBrief(input):camera?validateCameraBrief(input):(launch?validateReleaseBrief:validatePilotBrief)(kind,input);
 const media=camera||story?await readMedia(root,brief):[];
 const runtime=await preflight(root),{config,models,installed,fingerprint}=runtime;
 brief.voice=canonicalVoice(brief.voice,await readVoices(root));
 const release=await acquireBuildLock(root);
 try{
  const relative='outputs/'+brief.id+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8),out=safeChild(root,relative);
  await fs.mkdir(out,{recursive:true});
  const source={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8',windowsHide:true}).trim()};
  const receipt={schemaVersion:1,status:'RUNNING',attempt:path.basename(out),source,kind,renderer:story?'camera-motion-comic':camera?'camera-animatic':launch?'chuyen-lech-launch':'chuyen-lech-prototype',startedAt:new Date().toISOString(),runtime:config.versions,runtimeFingerprint:fingerprint,mediaApiRequests:0,mediaApiCostUsd:0,modelTokenUsage:null,stages:[],artifacts:{},aestheticUserApproval:'UNVERIFIED'};
  const write=async(name,v)=>fs.writeFile(path.join(out,name),JSON.stringify(v,null,2));
  const save=()=>write('receipt.json',receipt);await save();
  const run=async(id,exe,args)=>{const start=Date.now();try{await runProcess(exe,args,{cwd:root,env:childEnvironment(root,config),log:path.join(out,id+'.log'),onSpawn:release.recordChild});receipt.stages.push({id,status:'VERIFIED',elapsedMs:Date.now()-start});await save();}catch(e){receipt.stages.push({id,status:'FAILED',error:e.message});throw e;}};
  try{
   const vr=voiceSettings(brief.voice,{config,models,installed}),phrases=buildSpeechPhrases(brief,vr);
   await write('brief.json',brief);await write('tts-request.json',{voice:brief.voice,phrases,resultFile:relative+'/tts-result.json'});
   await run('tts',path.join(root,config.paths.python),['src/tts.py','synthesize',relative+'/tts-request.json']);
   const speech=JSON.parse(await fs.readFile(path.join(out,'tts-result.json'),'utf8')),timeline=buildTimeline(brief,speech.audio);
   if(camera&&timeline.duration>18)throw Error('CAMERA_ANIMATIC_TOO_LONG');
   if(story&&(timeline.duration<90||timeline.duration>125))throw Error('CAMERA_STORY_DURATION');
   if(launch){timeline.width=1080;timeline.height=1920;}
   timeline.mixFile=relative+'/mix.wav';timeline.source=source;timeline.voiceRuntime=vr;
   await write('timeline.json',timeline);await fs.writeFile(path.join(out,'captions.srt'),toSrt(launch?{...timeline,phrases:releaseCaptionCues(timeline.phrases,kind==='atm')}:timeline));
   await run('mix',path.join(root,config.paths.python),['src/tts.py','mix',relative+'/timeline.json']);
   if(launch||story){
    await fs.writeFile(path.join(out,'sfx.wav'),story?createCameraSoundbed(timeline):createReleaseSfx(kind,timeline));
    receipt.soundDesign={kind:'original-procedural-tones',sha256:await hashFile(path.join(out,'sfx.wav')),music:false};await save();
    await run('loudness',path.join(root,config.paths.ffmpeg),['-v','info','-i',path.join(out,'mix.wav'),'-i',path.join(out,'sfx.wav'),'-filter_complex','[0:a]aformat=channel_layouts=stereo[v];[v][1:a]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-16:TP=-1.3:LRA=11:print_format=json','-ar','48000','-ac','2','-c:a','pcm_s16le',path.join(out,'master.wav')]);
   }else await run('loudness',path.join(root,config.paths.ffmpeg),['-v','info','-i',path.join(out,'mix.wav'),'-af','aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-1.3:LRA=11:print_format=json','-ar','48000','-ac','2','-c:a','pcm_s16le',path.join(out,'master.wav')]);
   await fs.mkdir(path.join(out,'assets'));
   for(const [key,name]of[['fontRegular','regular.ttf'],['fontBold','bold.ttf'],['fontBlack','black.ttf'],['gsap','gsap.min.js'],['fontLicense','OFL.txt']])await fs.copyFile(path.join(root,config.paths[key]),path.join(out,'assets',name));
   for(const asset of media)await fs.writeFile(path.join(out,'assets',asset.name),asset.payload);
   await fs.writeFile(path.join(out,'index.html'),story?renderCameraStoryHtml(timeline):camera?renderCameraHtml(timeline):(launch?renderReleaseHtml:renderPilotHtml)(kind,timeline));
   const renderer=path.join(root,config.paths.renderer);
   await run('lint',process.execPath,[renderer,'lint',out]);await run('check',process.execPath,[renderer,'check',out]);
   await run('render',process.execPath,[renderer,'render',out,'--output',path.join(out,'video.mp4'),'--fps','30','--workers','1','--quality','high','--no-browser-gpu','--low-memory-mode']);
   const meta=JSON.parse(execFileSync(path.join(root,config.paths.ffprobe),['-v','error','-show_streams','-show_format','-of','json',path.join(out,'video.mp4')],{encoding:'utf8',windowsHide:true}));
   validateExport(meta,timeline.duration,timeline);await run('decode',path.join(root,config.paths.ffmpeg),strictDecodeArgs(path.join(out,'video.mp4')));await write('ffprobe.json',meta);
   receipt.renderInputs={brief:await hashFile(path.join(out,'brief.json')),timeline:await hashFile(path.join(out,'timeline.json')),captions:await hashFile(path.join(out,'captions.srt')),composition:await hashFile(path.join(out,'index.html'))};
   if(launch||story){receipt.renderInputs.master=await hashFile(path.join(out,'master.wav'));receipt.renderInputs.sfx=receipt.soundDesign.sha256;}
   receipt.artifacts.video={path:relative+'/video.mp4',sha256:await hashFile(path.join(out,'video.mp4')),bytes:(await fs.stat(path.join(out,'video.mp4'))).size};
   receipt.status='VERIFIED';receipt.duration=timeline.duration;receipt.generatedPhrases=speech.generated;await save();return receipt;
  }catch(e){receipt.status='FAILED';receipt.error=e.message;await save();throw Error(e.message+' OUTPUT='+relative);}
 }finally{await release();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [kind,file,...extra]=process.argv.slice(2);
 if(!file||extra.length>1||(extra.length===1&&!['--release','--camera','--story'].includes(extra[0]))||(['--camera','--story'].includes(extra[0])&&kind!=='camera')){console.log(JSON.stringify({status:'FAILED',error:'USAGE kind briefs/file.json [--release|--camera|--story]'}));process.exitCode=2;}
 else build(kind,file,extra[0]==='--story'?'story':extra[0]==='--camera'?'camera':extra.length?'release':'pilot').then(r=>console.log(JSON.stringify(r))).catch(e=>{console.log(JSON.stringify({status:'FAILED',error:e.message}));process.exitCode=1;});
}
