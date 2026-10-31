import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID,createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import sharp from 'sharp';
import {safeChild,toSrt,escapeHtml} from './core.mjs';import {canonicalBrief,requireId,readLimited} from './editor-store.mjs';import {hashFile} from './runtime.mjs';import {verifyQaIdentity} from './qa.mjs';
const read=async(root,file)=>JSON.parse(await readLimited(safeChild(root,file)));
const digest=value=>createHash('sha256').update(value).digest('hex');
const snapshot=async(root,file)=>{const content=await readLimited(safeChild(root,file));return {value:JSON.parse(content),sha256:digest(content)};};
const bounded=(s,n)=>typeof s==='string'&&s.trim()&&s.length<=n&&!/[\x00-\x08\x0B-\x1F]/.test(s);
export function validatePack(m){
 if(m?.schemaVersion!==1)throw Error('INVALID_PACK');requireId(m.contentId);requireId(m.projectId);
 if(!Number.isSafeInteger(m.revision)||m.revision<1||m.revision>99999999)throw Error('INVALID_PACK_REVISION');
 if(!Array.isArray(m.sources)||!m.sources.length||m.sources.length>20||!Array.isArray(m.rights)||!m.rights.length||m.rights.length>20)throw Error('INVALID_PACK_SOURCES');
 const ids=new Set();for(const s of m.sources){requireId(s.id);if(ids.has(s.id))throw Error('DUPLICATE_SOURCE');ids.add(s.id);const u=new URL(s.url);if(u.protocol!=='https:'||u.username||u.password||!bounded(s.claim,1500)||!bounded(s.assessment,1000))throw Error('INVALID_PACK_SOURCE');}
 for(const r of m.rights)if(!bounded(r.asset,200)||!bounded(r.basis,1000))throw Error('INVALID_PACK_RIGHTS');
 requireId(m.cover?.sceneId);if(!bounded(m.cover.title,65))throw Error('INVALID_PACK_COVER');
 for(const platform of ['youtube','facebook','tiktok'])if(!bounded(m.copy?.[platform]?.title,100)||!bounded(m.copy[platform].caption,2000))throw Error('INVALID_PACK_COPY');
 return m;
}
async function renderCover(file,{root,video,time,title,config}){
 const frame=execFileSync(path.join(root,config.paths.ffmpeg),['-nostdin','-v','error','-ss',String(time),'-i',video,'-frames:v','1','-f','image2pipe','-vcodec','png','-'],{windowsHide:true,maxBuffer:12*1024*1024});
 const background=await sharp(frame).resize(720,1280,{fit:'contain',background:'#102B43'}).png().toBuffer();
 const label=await sharp({text:{text:escapeHtml(title),font:'Be Vietnam Pro Bold 52',fontfile:path.join(root,config.paths.fontBold),width:568,height:158,align:'left',rgba:true}}).png().toBuffer();
 const panel=Buffer.from('<svg width="640" height="225"><rect width="640" height="225" rx="18" fill="#F9FCFF"/></svg>');
 await sharp(background).composite([{input:panel,left:40,top:115},{input:label,left:76,top:148}]).png().toFile(file);
}
export async function createCreatorPack(root,relative,metadata,{qaFile,cover=renderCover}={}){
 const m=validatePack(structuredClone(metadata));if(typeof relative!=='string'||!relative.startsWith('outputs/'))throw Error('PACK_OUTSIDE_OUTPUTS');
 const out=safeChild(root,relative),video=safeChild(root,relative+'/video.mp4');
 const [receiptSnap,timelineSnap,briefSnap,project,qa]=await Promise.all([snapshot(root,relative+'/receipt.json'),snapshot(root,relative+'/timeline.json'),snapshot(root,relative+'/brief.json'),read(root,'.runtime/studio/projects/'+m.projectId+'/'+String(m.revision).padStart(8,'0')+'.json'),read(root,qaFile)]);
 const receipt=receiptSnap.value,timeline=timelineSnap.value,brief=briefSnap.value;
 const videoHash=await hashFile(video);verifyQaIdentity(receipt,videoHash,(await fs.stat(video)).size);
 if(qa.status!=='VERIFIED'||qa.exportHash!==videoHash)throw Error('QA_EXPORT_MISMATCH');
 if(project.revision!==m.revision||project.brief.id!==m.projectId||JSON.stringify(canonicalBrief(project.brief))!==JSON.stringify(canonicalBrief(brief))||receipt.renderInputs?.brief!==briefSnap.sha256)throw Error('PACK_PROJECT_MISMATCH');
 if(timeline.id!==m.projectId||!Number.isFinite(timeline.duration))throw Error('PACK_TIMELINE_MISMATCH');
 const captionText=await fs.readFile(safeChild(root,relative+'/captions.srt'),'utf8');if(captionText!==toSrt(timeline))throw Error('SRT_CHANGED');
 if(receipt.renderInputs?.timeline!==timelineSnap.sha256||receipt.renderInputs?.captions!==digest(captionText))throw Error('RENDER_INPUTS_CHANGED');
 const scene=timeline.scenes.find(s=>s.id===m.cover.sceneId);if(!scene)throw Error('COVER_SCENE_NOT_FOUND');
 const time=scene.start+Math.min(2,(scene.end-scene.start)*.65);
 const packPath='outputs/creator-packs/'+m.contentId+'-'+randomUUID().slice(0,8),folder=safeChild(root,packPath);await fs.mkdir(path.dirname(folder),{recursive:true});await fs.mkdir(folder);
 const manifest={schemaVersion:1,contentId:m.contentId,publicationStatus:'DRAFT',project:{id:m.projectId,revision:m.revision,inputBriefHash:receipt.briefHash,renderBriefHash:receipt.renderInputs.brief},source:receipt.source,duration:timeline.duration,format:{width:timeline.width,height:timeline.height,fps:timeline.fps},sources:m.sources,rights:m.rights,copy:m.copy,cover:{...m.cover,time},phrases:timeline.phrases.map(p=>({id:p.id,sceneId:p.sceneId,start:p.start,end:p.end,audioHash:p.sha256})),scenes:timeline.scenes.map(s=>({id:s.id,visual:s.visual,lab:s.lab?.kind,start:s.start,end:s.end,shots:s.shots?.map(v=>({id:v.id,phraseId:v.phraseId,start:v.start,end:v.end}))})),qa:{...qa,audioPlayback:qa.audioPlayback??'UNVERIFIED'},files:[],path:packPath};
 const files=['video.mp4','captions.srt','brief.json','timeline.json','receipt.json'];
 const pins={'video.mp4':videoHash,'brief.json':briefSnap.sha256,'timeline.json':timelineSnap.sha256,'captions.srt':digest(captionText),'receipt.json':receiptSnap.sha256};
 try{const snap=await snapshot(root,relative+'/motion-proof.json'),proof=snap.value;if(proof.status!=='VERIFIED'||proof.exportHash!==videoHash)throw Error('MOTION_PROOF_MISMATCH');files.push('motion-proof.json');pins['motion-proof.json']=snap.sha256;for(const frame of proof.qr??[]){if(!/^proof-scene-\d+\.png$/.test(frame.file))throw Error('INVALID_PROOF_FRAME');files.push(frame.file);pins[frame.file]=frame.frameSha256;}}catch(e){if(e.code!=='ENOENT')throw e;}
 for(const name of files){const src=safeChild(root,relative+'/'+name),target=path.join(folder,name),expected=pins[name];await fs.copyFile(src,target,fs.constants.COPYFILE_EXCL);if(await hashFile(target)!==expected)throw Error('PACK_COPY_CHANGED');manifest.files.push({path:name,sha256:expected,bytes:(await fs.stat(target)).size});}
 if(manifest.files.find(f=>f.path==='video.mp4').sha256!==videoHash)throw Error('EXPORT_CHANGED_DURING_PACK');
 const config=cover===renderCover?await read(root,'runtime-config.json'):undefined;
 await cover(path.join(folder,'cover.png'),{root,video:path.join(folder,'video.mp4'),time,title:m.cover.title,config});
 manifest.files.push({path:'cover.png',sha256:await hashFile(path.join(folder,'cover.png')),bytes:(await fs.stat(path.join(folder,'cover.png'))).size});
 const copy='# '+m.copy.youtube.title+'\n\n'+Object.entries(m.copy).map(([p,c])=>'## '+p+'\n\n'+c.title+'\n\n'+c.caption).join('\n\n')+'\n\nBản nháp; chưa đăng. Nguồn và quyền sử dụng trong manifest.json.\n';
 await fs.writeFile(path.join(folder,'posting-copy.md'),copy,{flag:'wx'});manifest.files.push({path:'posting-copy.md',sha256:createHash('sha256').update(copy).digest('hex'),bytes:Buffer.byteLength(copy)});
 const serialized=JSON.stringify(manifest,null,2)+'\n',manifestSha256=digest(serialized);
 await fs.writeFile(path.join(folder,'manifest.json'),serialized,{flag:'wx'});
 await fs.writeFile(path.join(folder,'manifest.sha256'),manifestSha256+'\n',{flag:'wx'});
 return {...manifest,manifestSha256};
}
export async function verifyCreatorPack(root,relative){
 if(typeof relative!=='string'||!relative.startsWith('outputs/creator-packs/'))throw Error('PACK_OUTSIDE_OUTPUTS');
 const folder=safeChild(root,relative),text=await readLimited(safeChild(root,relative+'/manifest.json')),expected=(await fs.readFile(safeChild(root,relative+'/manifest.sha256'),'utf8')).trim();
 if(!/^[a-f0-9]{64}$/.test(expected)||digest(text)!==expected)throw Error('MANIFEST_CHANGED');const m=JSON.parse(text);
 if(m.schemaVersion!==1||m.publicationStatus!=='DRAFT'||!Array.isArray(m.files)||!m.files.length||m.files.length>100)throw Error('INVALID_PACK_MANIFEST');
 const seen=new Set();for(const f of m.files){if(!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(f.path??'')||seen.has(f.path)||!/^[a-f0-9]{64}$/.test(f.sha256??'')||!Number.isSafeInteger(f.bytes)||f.bytes<0)throw Error('INVALID_PACK_FILE');seen.add(f.path);const file=safeChild(root,relative+'/'+f.path);if(await hashFile(file)!==f.sha256||(await fs.stat(file)).size!==f.bytes)throw Error('PACK_FILE_CHANGED');}
 return {status:'VERIFIED',manifestSha256:expected,files:m.files.length,publicationStatus:m.publicationStatus};
}
