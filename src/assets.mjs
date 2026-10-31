import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';import {execFileSync} from 'node:child_process';import sharp from 'sharp';
import {safeChild} from './core.mjs';import {hashFile} from './runtime.mjs';import {atomicJson} from './editor-atomic.mjs';import {readLimited} from './editor-store.mjs';import {acquireBuildLock,childEnvironment,runProcess} from './process.mjs';
export function assetDecodeArgs(file,kind){if(!['video','music'].includes(kind))throw Error('INVALID_ASSET_KIND');return ['-i',file,'-map',kind==='video'?'0:v:0':'0:a:0','-f','null','-'];}
export function validateUploadMetadata(v){if(!v||typeof v.name!=='string'||!v.name.trim()||v.name.length>128||/[\x00-\x1F]/.test(v.name))throw Error('INVALID_ASSET_NAME');if(typeof v.rights!=='string'||!v.rights.trim()||v.rights.length>240||/[\x00-\x1F]/.test(v.rights))throw Error('RIGHTS_REQUIRED');return {name:v.name,rights:v.rights};}
export function sniffMedia(b){if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||b[0]===255&&b[1]===216&&b[2]===255||b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return 'image';if(b.toString('ascii',4,8)==='ftyp')return 'video';if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WAVE')return 'music';if(b.toString('ascii',0,3)==='ID3'||b[0]===255&&(b[1]&224)===224)return 'music';throw Error('UNSUPPORTED_MEDIA');}
export async function mediaRuntime(root){const c=JSON.parse(await fs.readFile(safeChild(root,'runtime-config.json'),'utf8'));for(const k of ['ffmpeg','ffprobe'])if(await hashFile(safeChild(root,c.paths[k]))!==c.hashes[k])throw Error('MEDIA_RUNTIME_CHANGED');return {config:c,env:childEnvironment(root,c)};}
export function probeMedia(root,file,{config,env},kind){const prefix=['-v','error','-protocol_whitelist','file,pipe'];if(kind==='video')prefix.push('-f','mov','-enable_drefs','0','-use_absolute_path','0');else prefix.push('-f',kind==='mp3'?'mp3':'wav');const r=JSON.parse(execFileSync(safeChild(root,config.paths.ffprobe),[...prefix,'-show_streams','-show_format','-of','json',file],{cwd:root,env,windowsHide:true,encoding:'utf8',timeout:10000,maxBuffer:1024*1024}));return r;}
export const dubbingImportLimits={bytes:512*1024**2,videoSeconds:600,musicSeconds:600};
export async function importAsset(root,stream,metadata,{scope}={}){
 const limits=scope==='dubbing'?dubbingImportLimits:{bytes:64*1024**2,videoSeconds:60,musicSeconds:180};
 const source=validateUploadMetadata(metadata),id='asset-'+randomUUID(),relative='outputs/'+id,out=safeChild(root,relative);await fs.mkdir(out,{recursive:true});const original=safeChild(root,relative+'/original.bin'),h=await fs.open(original,'wx');let size=0,first=Buffer.alloc(0);
 try{for await(const part of stream){const b=Buffer.from(part);size+=b.length;if(size>limits.bytes)throw Error('ASSET_TOO_LARGE');if(first.length<32)first=Buffer.concat([first,b.subarray(0,32-first.length)]);await h.writeFile(b);}await h.sync();}finally{await h.close();}
 const kind=sniffMedia(first);if(scope==='dubbing'&&!['video','music'].includes(kind))throw Error('DUB_VIDEO_OR_MUSIC_REQUIRED');const release=await acquireBuildLock(root);try{
  const runtime=await mediaRuntime(root),{config,env}=runtime;const run=async(label,args)=>runProcess(safeChild(root,config.paths.ffmpeg),['-nostdin','-v','error','-xerror','-protocol_whitelist','file,pipe',...args],{cwd:root,env,log:path.join(out,label+'.log'),timeoutMs:scope==='dubbing'?1200000:120000,onSpawn:release.recordChild});
  let file,duration,width,height,poster;
  if(kind==='image'){
   const input=sharp(original,{limitInputPixels:16*1024**2}),meta=await input.metadata();if(!['png','jpeg','webp'].includes(meta.format)||(meta.pages??1)>1)throw Error('IMAGE_FORMAT_UNSUPPORTED');
   const result=await input.rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});
   file=relative+'/media.png';let image=sharp(result.data);if(result.info.width<256||result.info.height<256)image=image.extend({left:0,right:Math.max(0,256-result.info.width),top:0,bottom:Math.max(0,256-result.info.height),background:'#F5F2EA'});await image.png().toFile(safeChild(root,file));const m=await sharp(safeChild(root,file)).metadata();width=m.width;height=m.height;
  }else{
   const meta=probeMedia(root,original,runtime,kind==='music'?(first.toString('ascii',0,4)==='RIFF'?'wav':'mp3'):kind),dur=Number(meta.format?.duration),s=meta.streams?.find(s=>s.codec_type===(kind==='video'?'video':'audio'));
   if(!s||!Number.isFinite(dur)||dur<=0||dur>(kind==='video'?limits.videoSeconds:limits.musicSeconds))throw Error('MEDIA_DURATION_LIMIT');
   if(kind==='video'){
    if(!Number.isInteger(s.width)||!Number.isInteger(s.height)||s.width*s.height>16*1024**2)throw Error('VIDEO_DIMENSIONS_LIMIT');file=relative+'/media.mp4';
    await run('normalize',['-f','mov','-enable_drefs','0','-use_absolute_path','0','-i',original,'-map','0:v:0','-an','-vf',"scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30,format=yuv420p",'-c:v','libx264','-threads','2','-preset','fast','-crf','21','-movflags','+faststart',safeChild(root,file)]);
    const normalized=probeMedia(root,safeChild(root,file),runtime,'video');duration=Number(normalized.format.duration);const v=normalized.streams.find(s=>s.codec_type==='video');width=v.width;height=v.height;
    poster=relative+'/poster.png';await run('poster',['-f','mov','-enable_drefs','0','-use_absolute_path','0','-i',safeChild(root,file),'-frames:v','1',safeChild(root,poster)]);
   }else{
    file=relative+'/music.wav';const demuxer=first.toString('ascii',0,4)==='RIFF'?'wav':'mp3';await run('normalize',['-f',demuxer,'-i',original,'-map','0:a:0','-vn','-ar','48000','-ac',scope==='dubbing'?'2':'1','-c:a','pcm_s16le',safeChild(root,file)]);duration=Number(probeMedia(root,safeChild(root,file),runtime,'music').format.duration);
   }
   await run('decode',assetDecodeArgs(safeChild(root,file),kind));
  }
  const bytes=(await fs.stat(safeChild(root,file))).size;if(bytes>limits.bytes)throw Error('ASSET_TOO_LARGE');const record={schemaVersion:1,id,status:'VERIFIED',kind,...source,sourceBytes:size,sourceHash:await hashFile(original),path:file,sha256:await hashFile(safeChild(root,file)),bytes,duration,width,height,createdAt:new Date().toISOString(),mediaApiRequests:0};
  if(poster)record.poster={path:poster,sha256:await hashFile(safeChild(root,poster))};await fs.mkdir(safeChild(root,'.runtime/studio/assets'),{recursive:true});await atomicJson(root,safeChild(root,'.runtime/studio/assets/'+id+'.json'),record);return record;
 }finally{await release();}
}
export async function readAsset(root,id){if(!/^asset-[a-z0-9-]{1,48}$/.test(id??''))throw Error('INVALID_ASSET_ID');const r=JSON.parse(await readLimited(safeChild(root,'.runtime/studio/assets/'+id+'.json')));if(r.id!==id||r.status!=='VERIFIED'||!['image','video','music'].includes(r.kind)||r.path!=='outputs/'+id+'/'+({image:'media.png',video:'media.mp4',music:'music.wav'}[r.kind]))throw Error('ASSET_MANIFEST_INVALID');return r;}
export async function listAssets(root){const dir=safeChild(root,'.runtime/studio/assets');await fs.mkdir(dir,{recursive:true});const files=(await fs.readdir(dir)).filter(n=>/^asset-[a-z0-9-]+\.json$/.test(n)).slice(-200);return Promise.all(files.map(f=>readAsset(root,f.slice(0,-5))));}
export async function validateMusic(root,music){if(!music)return null;const a=await readAsset(root,music.assetId);if(a.kind!=='music'||a.path!==music.path||a.sha256!==music.sha256||await hashFile(safeChild(root,a.path))!==a.sha256)throw Error('MUSIC_CHANGED');return a;}
