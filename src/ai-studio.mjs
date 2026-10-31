import fs from 'node:fs/promises';import {safeChild} from './core.mjs';import {hashFile} from './runtime.mjs';import {gpuResources} from './gpu-runtime.mjs';import {ComfyClient,assertResources} from './gpu.mjs';import {readLimited} from './editor-store.mjs';import {imageRequest} from '../web/image-request.mjs';import sharp from 'sharp';
export function canonicalImageRequest(v){const {prompt,style,seed}=v??{};const value=imageRequest({prompt,style,seed});if(JSON.stringify(value)!==JSON.stringify(v))throw Error('IMAGE_SNAPSHOT_CHANGED');return value;}
export function gpuImageIdentity(v){if(!v||Object.keys(v).some(k=>!['id','clientId','receipt'].includes(k))||!/^jarvis-[a-f0-9-]{36}$/.test(v.id??'')||v.clientId!==v.id||v.receipt!=='outputs/'+v.id+'/receipt.json')throw Error('INVALID_IMAGE_IDENTITY');return v;}
export function validateImageOwnership(record,r){const identity=gpuImageIdentity(record.gpuIdentity);if(r?.id!==identity.id||r.clientId!==identity.clientId||r.receipt!==identity.receipt)throw Error('IMAGE_JOB_IDENTITY_CHANGED');const request=canonicalImageRequest(record.imageRequest);if(r.graph?.['2']?.inputs?.text!==request.resolvedPrompt||r.graph?.['5']?.inputs?.seed!==request.seed||JSON.stringify(r.request)!==JSON.stringify(request))throw Error('IMAGE_SNAPSHOT_CHANGED');}
export async function validateImageResult(root,record,r){
 const request=canonicalImageRequest(record.imageRequest);
 validateImageOwnership(record,r);
 if(r?.status!=='VERIFIED'||r.kind!=='image'||!/^jarvis-[a-f0-9-]{36}$/.test(r.id??'')||r.clientId!==r.id||r.receipt!=='outputs/'+r.id+'/receipt.json'||r.image?.path!=='outputs/'+r.id+'/image.png'||!/^[a-f0-9]{64}$/.test(r.image?.sha256??''))throw Error('INVALID_IMAGE_ARTIFACT');
 if(r.graph?.['2']?.inputs?.text!==request.resolvedPrompt||r.graph?.['5']?.inputs?.seed!==request.seed||JSON.stringify(r.request)!==JSON.stringify(request))throw Error('IMAGE_SNAPSHOT_CHANGED');
 const file=safeChild(root,r.image.path);if((await fs.stat(file)).size>16*1024**2||await hashFile(file)!==r.image.sha256)throw Error('IMAGE_ARTIFACT_CHANGED');
 const decoded=await sharp(file,{limitInputPixels:4*1024**2}).raw().toBuffer({resolveWithObject:true});if(decoded.info.width!==768||decoded.info.height!==1024||(await sharp(file).metadata()).format!=='png')throw Error('IMAGE_CONTRACT_FAILED');
 const receipt=safeChild(root,r.receipt),stored=JSON.parse(await readLimited(receipt,32768));if(JSON.stringify(stored)!==JSON.stringify(r))throw Error('IMAGE_RECEIPT_CHANGED');
 return {receipt:{path:r.receipt,sha256:await hashFile(receipt)}};
}
export async function aiStatus(root,{kind='image',resources=()=>gpuResources(root),probe=async url=>{const client=new ComfyClient(url);await client.request('/system_stats',{timeoutMs:1500});return client.request('/queue',{timeoutMs:1500});}}={}){
 const reasons=[];let measured=null,model=null,backend='OFFLINE';
 try{measured=await resources();try{assertResources(measured);}catch(e){reasons.push(e.message);}}catch{reasons.push('RESOURCES_UNAVAILABLE');}
 try{const p=JSON.parse(await readLimited(safeChild(root,'gpu-provenance.json'))),required=kind==='clip'?['ltx-2b','ltx-t5']:['sdxl-base'];model=p.models.find(m=>m.id===required[0]);try{for(const id of required){const m=p.models.find(m=>m.id===id);if(!m||(await fs.stat(safeChild(root,m.target))).size!==m.bytes)throw Error();}}catch{reasons.push('MODEL_MISSING_OR_CHANGED');}
  try{const queue=await probe(p.backend.url);backend='READY';if(!Array.isArray(queue.queue_running)||!Array.isArray(queue.queue_pending))throw Error();if(queue.queue_running.length+queue.queue_pending.length)reasons.push('BACKEND_QUEUE_BUSY');}catch{backend='OFFLINE';reasons.push('BACKEND_OFFLINE');}
 }catch{reasons.push('BACKEND_NOT_CONFIGURED');}
 for(const [file,reason] of [['.runtime/gpu-job.json','GPU_JOB_PENDING'],['.runtime/build.lock','BUILD_ALREADY_LOCKED']])try{await fs.stat(safeChild(root,file));reasons.push(reason);}catch(e){if(e.code!=='ENOENT')reasons.push('STATE_UNAVAILABLE');}
 return {ready:reasons.length===0,backend,reasons,resources:measured,model:model?{id:model.id,bytes:model.bytes,license:model.license}:null,profile:kind==='clip'?{width:320,height:512,frames:49,fps:24,seed:20261013,batch:1}:{width:768,height:1024,steps:20,batch:1},inferenceStatus:'UNVERIFIED',integrityStatus:'CHECKED_AT_GENERATION',at:new Date().toISOString()};
}
