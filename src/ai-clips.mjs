import fs from 'node:fs/promises';import {createReadStream} from 'node:fs';import {execFileSync} from 'node:child_process';
import {clipRequest} from '../web/clip-request.mjs';import {safeChild} from './core.mjs';import {readLimited} from './editor-store.mjs';import {hashFile} from './runtime.mjs';import {readMedia} from './media.mjs';import {gpuImageIdentity} from './ai-studio.mjs';import {clipGraph,validateClipExport} from './gpu.mjs';import {mediaRuntime,probeMedia,importAsset,readAsset} from './assets.mjs';
export function canonicalClipRequest(v){
 try{const {prompt,source}=v,r=clipRequest({imageId:source.id,prompt}),copy={prompt:r.prompt,source:{id:r.imageId,receipt:'outputs/'+r.imageId+'/receipt.json',receiptSha256:source.receiptSha256,image:{path:'outputs/'+r.imageId+'/image.png',sha256:source.image.sha256}}};if(!/^[a-f0-9]{64}$/.test(copy.source.receiptSha256)||!/^[a-f0-9]{64}$/.test(copy.source.image.sha256)||JSON.stringify(copy)!==JSON.stringify(v))throw Error();return copy;}catch{throw Error('INVALID_CLIP_SNAPSHOT');}
}
export async function resolveClipRequest(root,input){
 const r=clipRequest(input),receipt='outputs/'+r.imageId+'/receipt.json',file=safeChild(root,receipt),source=JSON.parse(await readLimited(file,32768));
 if(source.status!=='VERIFIED'||source.kind!=='image'||source.id!==r.imageId||source.clientId!==r.imageId||source.receipt!==receipt||source.image?.path!=='outputs/'+r.imageId+'/image.png'||!/^[a-f0-9]{64}$/.test(source.image?.sha256??''))throw Error('CLIP_SOURCE_NOT_VERIFIED');
 const image={path:source.image.path,sha256:source.image.sha256};await readMedia(root,{scenes:[{visual:'media',media:{kind:'image',...image}}]});
 return canonicalClipRequest({prompt:r.prompt,source:{id:r.imageId,receipt,receiptSha256:await hashFile(file),image}});
}
export async function validateClipSource(root,v){const request=canonicalClipRequest(v),current=await resolveClipRequest(root,{imageId:request.source.id,prompt:request.prompt});if(JSON.stringify(current)!==JSON.stringify(request))throw Error('CLIP_SOURCE_CHANGED');return request;}
export function validateClipOwnership(record,r){
 const identity=gpuImageIdentity(record.gpuIdentity),request=canonicalClipRequest(record.clipRequest);
 if(r?.id!==identity.id||r.clientId!==identity.clientId||r.receipt!==identity.receipt||r.kind!=='clip')throw Error('CLIP_IDENTITY_CHANGED');
 if(JSON.stringify(r.request)!==JSON.stringify(request)||JSON.stringify(r.graph)!==JSON.stringify(clipGraph(request.prompt,identity.id,identity.id+'.png')))throw Error('CLIP_SNAPSHOT_CHANGED');
 if(r.status==='VERIFIED'&&JSON.stringify(r.inputImage)!==JSON.stringify(request.source.image))throw Error('CLIP_SOURCE_CHANGED');return true;
}
export async function validateClipResult(root,record,r){
 validateClipOwnership(record,r);const c=r.clip;
 if(r.status!=='VERIFIED'||c?.path!=='outputs/'+r.id+'/clip.mp4'||!/^[a-f0-9]{64}$/.test(c?.sha256??'')||c.width!==320||c.height!==512||c.frames!==49||c.fps!==24||c.duration!==49/24)throw Error('INVALID_CLIP_ARTIFACT');
 const file=safeChild(root,c.path);if((await fs.stat(file)).size>16*1024**2||await hashFile(file)!==c.sha256)throw Error('CLIP_ARTIFACT_CHANGED');
 const runtime=await mediaRuntime(root),meta=probeMedia(root,file,runtime,'video');validateClipExport(meta);
 execFileSync(safeChild(root,runtime.config.paths.ffmpeg),['-nostdin','-v','error','-xerror','-protocol_whitelist','file,pipe','-f','mov','-enable_drefs','0','-use_absolute_path','0','-i',file,'-map','0:v:0','-f','null','-'],{cwd:root,env:runtime.env,windowsHide:true,timeout:30000,maxBuffer:1024**2});
 const receipt=safeChild(root,r.receipt);if(JSON.stringify(JSON.parse(await readLimited(receipt,32768)))!==JSON.stringify(r))throw Error('CLIP_RECEIPT_CHANGED');return {receipt:{path:r.receipt,sha256:await hashFile(receipt)}};
}
export async function importVerifiedClip(root,record){
 if(record.kind!=='clip'||record.status!=='VERIFIED'||!record.sealed?.receipt||await hashFile(safeChild(root,record.sealed.receipt.path))!==record.sealed.receipt.sha256)throw Error('CLIP_NOT_SEALED');
 await validateClipResult(root,record,record.result);const clip=record.result.clip,name='AI clip '+record.id,existing=await findImportedClip(root,record);if(existing)return existing;
 return importAsset(root,createReadStream(safeChild(root,clip.path)),{name,rights:'Tạo local từ ảnh '+record.clipRequest.source.id+'; SDXL/LTX licenses riêng.'});
}
export async function findImportedClip(root,record){
 const clip=record.result.clip,name='AI clip '+record.id;
 const ids=record.clipAssetId?[record.clipAssetId]:(await fs.readdir(safeChild(root,'.runtime/studio/assets')).catch(e=>{if(e.code==='ENOENT')return [];throw e;})).filter(n=>/^asset-[a-z0-9-]+\.json$/.test(n)).map(n=>n.slice(0,-5));
 for(const id of ids){const a=await readAsset(root,id);if(a.kind==='video'&&a.name===name&&a.sourceHash===clip.sha256){if(await hashFile(safeChild(root,a.path))!==a.sha256||await hashFile(safeChild(root,'outputs/'+a.id+'/original.bin'))!==clip.sha256)throw Error('CLIP_NORMALIZED_ASSET_CHANGED');return a;}}
 return null;
}
