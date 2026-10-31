import {styleLibrary} from '../web/style-library-model.mjs';
import {validateVoiceWorkbench} from '../web/voice-model.mjs';
import {validateBoard,compileBoard} from '../web/whiteboard-model.mjs';
import {validateContent,validateShots,timedShots} from './storyboard.mjs';
import {validateLab} from './motion-lab.mjs';
import {createHash} from 'node:crypto';
import {lstatSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {formatProfile} from './formats.mjs';
import {validateImageMotion} from '../web/image-motion.mjs';
import {validateContentBrief,validateRole} from '../web/content-model.mjs';
import {validateCaptionSettings,validatePhraseOverrides,effectiveCaptionText,effectiveSpeechText} from '../web/captions.mjs';
const fail=code=>{throw new Error(code);};
const id=v=>typeof v==='string'&&/^[a-z][a-z0-9_-]{0,47}$/.test(v);
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v);
export function validateBrief(b){
 if(!b||b.schemaVersion!==1||!id(b.id)||!text(b.title,80)||!['explain','story','product','social'].includes(b.preset)||!text(b.voice,64)||!/^#[a-f0-9]{6}$/i.test(b.accent))fail('INVALID_BRIEF');
 if(b.theme!==undefined&&!styleLibrary.some(s=>s.id===b.theme))fail('INVALID_THEME');
 formatProfile(b.format);
 if(b.contentBrief!==undefined)validateContentBrief(b.contentBrief);
 if(b.transition!==undefined&&!['cut','fade','slide'].includes(b.transition))fail('INVALID_TRANSITION');
 if(b.branding!==undefined){if(!b.branding||typeof b.branding!=='object'||Object.keys(b.branding).some(k=>!['label','subline','footer'].includes(k)))fail('INVALID_BRANDING');for(const [k,max] of [['label',40],['subline',40],['footer',80]])if(b.branding[k]!==undefined&&(typeof b.branding[k]!=='string'||b.branding[k].length>max||/[\x00-\x1F]/.test(b.branding[k])))fail('INVALID_BRANDING');}
 if(b.captions!==undefined)validateCaptionSettings(b.captions);
 if(b.music!==undefined){const m=b.music;if(!m||!/^asset-[a-z0-9-]{1,48}$/.test(m.assetId??'')||m.path!=='outputs/'+m.assetId+'/music.wav'||!/^[a-f0-9]{64}$/.test(m.sha256??'')||!Number.isFinite(m.gainDb)||m.gainDb< -36||m.gainDb>0||!Number.isFinite(m.duckDb)||m.duckDb< -30||m.duckDb>0)fail('INVALID_MUSIC');}
 if(!Array.isArray(b.scenes)||b.scenes.length<1||b.scenes.length>20)fail('INVALID_SCENES');
 const seen=new Set();let count=0;
 for(const s of b.scenes){
  if(s.role!==undefined)validateRole(s.role);
  if(!id(s.id)||seen.has(s.id)||!text(s.title,70)||!['whiteboard','motion-lab','script','voice','timeline','render','edit','output','media','kinetic','steps','spotlight','quote','compare','metric','diagram','product-card','story-card'].includes(s.visual))fail('INVALID_SCENE');seen.add(s.id);
  if(s.visual==='motion-lab'){validateLab(s.lab);if(s.shots)fail('INVALID_LAB_SHOTS');}else if(s.lab!==undefined)fail('INVALID_LAB');
  if(s.hold!==undefined&&(!Number.isFinite(s.hold)||s.hold<0||s.hold>10))fail('INVALID_HOLD');
  if(s.content!==undefined)validateContent(s.content);
  if(s.visual==='media'){const m=s.media;if(!m||!/^[a-f0-9]{64}$/.test(m.sha256??'')||!['image','video'].includes(m.kind)||m.fit!==undefined&&!['cover','contain'].includes(m.fit))fail('INVALID_MEDIA');
   if(m.kind==='image'&&(typeof m.path!=='string'||!/^outputs\/[a-zA-Z0-9_./-]+\.png$/.test(m.path)))fail('INVALID_MEDIA');
   if(m.kind==='video'&&(!/^outputs\/asset-[a-z0-9-]{1,48}\/media\.mp4$/.test(m.path??'')||!Number.isFinite(m.start)||!Number.isFinite(m.end)||m.start<0||m.end<=m.start||m.end>60))fail('INVALID_MEDIA');}
  if(s.media?.motion!==undefined){if(s.visual!=='media'||s.media.kind!=='image')fail('INVALID_IMAGE_MOTION');validateImageMotion(s.media.motion);}
  if(!Array.isArray(s.phrases)||!s.phrases.length||s.phrases.length>30)fail('INVALID_PHRASES');
  for(const p of s.phrases){if(!id(p.id)||seen.has(p.id)||!text(p.text,240))fail('INVALID_PHRASE');validatePhraseOverrides(p);seen.add(p.id);count++;}
 }
 for(const scene of b.scenes){validateShots(scene,seen);if(scene.visual==='whiteboard'){if(scene.shots||scene.media)fail('INVALID_BOARD_SCENE');validateBoard(scene.board,scene.phrases);}else if(scene.board!==undefined)fail('INVALID_BOARD_SCENE');}if(b.scenes.reduce((n,s)=>n+(s.shots?.length??0),0)>40)fail('INVALID_SHOTS');
 if(count>100)fail('TOO_MANY_PHRASES');if(b.voiceWorkbench!==undefined)validateVoiceWorkbench(b.voiceWorkbench,b.scenes);return b;
}
export function safeChild(root,relative){
 if(typeof relative!=='string'||!relative||path.isAbsolute(relative)||path.win32.isAbsolute(relative))fail('INVALID_PATH');
 const base=realpathSync(root),target=path.resolve(base,relative),rel=path.relative(base,target);
 if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))fail('PATH_OUTSIDE_ROOT');
 let cursor=base;
 for(const part of rel.split(path.sep)){
  cursor=path.join(cursor,part);
  // lstat sees dangling or non-traversable junctions that existsSync hides.
  let entry;try{entry=lstatSync(cursor);}catch(error){if(error.code==='ENOENT')break;throw error;}
  if(entry.isSymbolicLink())fail('SYMLINK_PATH');
 }
 return target;
}
export function buildTimeline(b,audio){
 validateBrief(b);let time=0.6;const phrases=[],scenes=[];
 for(const scene of b.scenes){const start=time;
  for(const p of scene.phrases){const a=audio[p.id];if(!a||!Number.isInteger(a.samples)||a.samples<=0||!Number.isInteger(a.sampleRate)||a.sampleRate<=0)fail('INVALID_AUDIO');
   const duration=a.samples/a.sampleRate;if(duration>90)fail('PHRASE_TOO_LONG');
   const end=time+duration;phrases.push({...p,...a,sceneId:scene.id,start:time,end,startFrame:Math.round(time*30),endFrame:Math.round(end*30)});time=end+0.18;
  }
  time+=0.42+(scene.hold??0);scenes.push({...scene,start,end:time,startFrame:Math.round(start*30),endFrame:Math.round(time*30)});
 }
 time+=0.8;const frames=Math.round(time*30);if(time>180)fail('VIDEO_TOO_LONG');
 for(const [i,scene] of scenes.entries())if(scene.shots)scene.shots=timedShots(scene,phrases,{start:i===0?0:scene.start,end:i===scenes.length-1?frames/30:scene.end});
 const f=formatProfile(b.format);return {schemaVersion:1,id:b.id,title:b.title,preset:b.preset,template:b.template,theme:b.theme??'editorial',accent:b.accent,voice:b.voice,format:f.id,transition:b.transition??'cut',branding:b.branding,captions:b.captions,music:b.music,width:f.width,height:f.height,fps:30,duration:frames/30,frames,phrases,scenes};
}
export const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=t=>{let ms=Math.round(t*1000);const h=Math.floor(ms/3600000);ms%=3600000;const m=Math.floor(ms/60000);ms%=60000;const s=Math.floor(ms/1000);return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0');};
const caption=s=>String(s).replace(/<[^>]*>/g,'').replace(/\r/g,'').replaceAll('-->','→').split('\n').filter(s=>s.trim()).join('\n').trim();
export function toSrt(t){return t.phrases.map((p,i)=>`${i+1}\n${stamp(p.start)} --> ${stamp(p.end)}\n${caption(effectiveCaptionText(p))}\n`).join('\n');}
export const audioCacheKey=(txt,config)=>createHash('sha256').update(JSON.stringify({text:txt.normalize('NFC'),config:Object.fromEntries(Object.entries(config).sort(([a],[b])=>a.localeCompare(b)))})).digest('hex');
export const buildSpeechPhrases=(brief,voiceRuntime)=>brief.scenes.flatMap(s=>s.phrases).map(p=>({...p,text:effectiveSpeechText(p),cacheKey:audioCacheKey(effectiveSpeechText(p),voiceRuntime)}));
export function validateExport(m,duration,profile=formatProfile()){
 const video=m?.streams?.find(s=>s.codec_type==='video'),audio=m?.streams?.find(s=>s.codec_type==='audio');
 const near=s=>Number.isFinite(Number(s))&&Math.abs(Number(s)-duration)<=0.12;
 if(!video||video.codec_name!=='h264'||video.width!==profile.width||video.height!==profile.height||video.r_frame_rate!=='30/1'||!near(video.duration)||!audio||audio.codec_name!=='aac'||!near(audio.duration)||!near(m.format?.duration))fail('EXPORT_CONTRACT_FAILED');
 return true;
}
export function qaFrames(t){
 const result=new Set([0,t.frames-1]);for(let f=0;f<t.frames;f+=60)result.add(f);
 for(const s of t.scenes)for(const f of [s.startFrame,s.endFrame])for(let d=-2;d<=2;d++)result.add(Math.max(0,Math.min(t.frames-1,f+d)));
 for(const s of t.scenes.filter(s=>s.visual==='whiteboard'))for(const a of compileBoard(s.board,t.phrases.filter(p=>p.sceneId===s.id),s.end).actions)for(const time of [a.time,a.time+a.duration])for(const d of [-1,0,1])result.add(Math.max(0,Math.min(t.frames-1,Math.round(time*30)+d)));
 for(const p of t.phrases)result.add(Math.floor((p.startFrame+p.endFrame)/2));
 return [...result].sort((a,b)=>a-b);
}
