import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import {randomUUID,createHash} from 'node:crypto';
import {ComfyClient,imageGraph,clipGraph,validateClipExport,assertResources,validateOutput,submitMeasured,waitForJob} from './gpu.mjs';import {hashFile} from './runtime.mjs';
import {safeChild} from './core.mjs';import {readMedia} from './media.mjs';import {acquireBuildLock,runProcess,childEnvironment} from './process.mjs';import {gpuRuntime,gpuResources} from './gpu-runtime.mjs';
import {createGpuIntent,readGpuIntent,resolveGpuIntent,findGpuPrompt,writeOwnedArtifact} from './gpu-job.mjs';
import {canonicalImageRequest,gpuImageIdentity} from './ai-studio.mjs';
import {canonicalClipRequest,validateClipSource} from './ai-clips.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const save=async receipt=>fs.writeFile(safeChild(root,receipt.receipt),JSON.stringify(receipt,null,2)+'\n');
async function finishImage(receipt,state){
 const output=validateOutput(state.output,receipt.id),file=safeChild(root,receipt.backend.path+'/output/'+output.filename);
 if((await fs.stat(file)).size>16*1024**2)throw Error('GPU_IMAGE_OVERSIZE');
 const payload=await fs.readFile(file);if(payload.length>16*1024**2)throw Error('GPU_OUTPUT_OVERSIZE');
 if(receipt.kind==='clip'){
  const config=JSON.parse(await fs.readFile(safeChild(root,'runtime-config.json'),'utf8'));
  for(const key of ['ffmpeg','ffprobe'])if(await hashFile(safeChild(root,config.paths[key]))!==config.hashes[key])throw Error('CLIP_RUNTIME_CHANGED');
  const clip=receipt.receipt.replace('receipt.json','clip.mp4'),clipFile=safeChild(root,clip);await writeOwnedArtifact(root,clip,payload);
  const env=childEnvironment(root,config),meta=JSON.parse(execFileSync(safeChild(root,config.paths.ffprobe),['-v','error','-show_streams','-show_format','-of','json',clipFile],{env,encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:1024*1024}));
  validateClipExport(meta);const v=meta.streams.find(s=>s.codec_type==='video');
  await runProcess(safeChild(root,config.paths.ffmpeg),['-v','error','-xerror','-i',safeChild(root,clip),'-map','0:v:0','-f','null','-'],{cwd:root,env,log:safeChild(root,receipt.receipt.replace('receipt.json','decode-'+randomUUID()+'.log')),timeoutMs:30000});
  Object.assign(receipt,{status:'VERIFIED',elapsedMs:Date.now()-receipt.startedAtMs,clip:{path:clip,width:v.width,height:v.height,frames:49,fps:24,duration:49/24,sha256:await hashFile(safeChild(root,clip))},visualUserApproval:'UNVERIFIED'});await save(receipt);await resolveGpuIntent(root,receipt.clientId,'VERIFIED');return receipt;
 }
 const {default:sharp}=await import('sharp');
 const decoded=await sharp(payload,{limitInputPixels:4*1024**2}).raw().toBuffer({resolveWithObject:true});
 if(decoded.info.width!==768||decoded.info.height!==1024||(await sharp(payload).metadata()).format!=='png')throw Error('GPU_IMAGE_CONTRACT_FAILED');
 const image=receipt.receipt.replace('receipt.json','image.png');await writeOwnedArtifact(root,image,payload);
 Object.assign(receipt,{status:'VERIFIED',elapsedMs:Date.now()-receipt.startedAtMs,image:{path:image,width:decoded.info.width,height:decoded.info.height,sha256:createHash('sha256').update(payload).digest('hex')},visualUserApproval:'UNVERIFIED'});
 await save(receipt);await resolveGpuIntent(root,receipt.clientId,'VERIFIED');return receipt;
}
async function image(prompt,sourceReceipt,request,identity){
 const graphId=identity?.id??'jarvis-'+randomUUID(),kind=sourceReceipt?'clip':'image',graph=sourceReceipt?clipGraph(prompt,graphId,graphId+'.png'):imageGraph(prompt,graphId,request?.seed);
 const p=await gpuRuntime(root),startResources=await gpuResources(root);assertResources(startResources);
 const models=p.models.filter(m=>kind==='image'?(m.kind??'image')==='image':['clip','encoder'].includes(m.kind));
 for(const m of models){const f=safeChild(root,m.target);if((await fs.stat(f)).size!==m.bytes||await hashFile(f)!==m.sha256)throw Error('GPU_MODEL_CHANGED');}
 let source=null;if(sourceReceipt){const sourceFile=safeChild(root,sourceReceipt);if((await fs.stat(sourceFile)).size>32768)throw Error('IMAGE_RECEIPT_OVERSIZE');source=JSON.parse(await fs.readFile(sourceFile,'utf8'));if(source.status!=='VERIFIED'||!source.image)throw Error('IMAGE_RECEIPT_NOT_VERIFIED');if(request){await validateClipSource(root,request);source.image=request.source.image;}}
 const release=await acquireBuildLock(root);
 try{
  const rel='outputs/'+graphId;await fs.mkdir(safeChild(root,rel));const client=new ComfyClient(p.backend.url),start=performance.now();
  const receipt={schemaVersion:1,status:'RUNNING',kind,id:graphId,clientId:graphId,receipt:rel+'/receipt.json',startedAtMs:Date.now(),graph,models,backend:p.backend,source:{head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8',windowsHide:true}).trim()},startResources,mediaApiRequests:0,mediaApiCostUsd:0};await save(receipt);
  if(request){receipt.request=request;await save(receipt);}let intent=false;
  try{
   if(source){const [asset]=await readMedia(root,{scenes:[{visual:'media',media:{kind:'image',path:source.image.path,sha256:source.image.sha256}}]});await fs.writeFile(safeChild(root,p.backend.path+'/input/'+graphId+'.png'),asset.payload,{flag:'wx'});receipt.inputImage={path:source.image.path,sha256:source.image.sha256};}
   const queue=await client.request('/queue');if((queue.queue_running?.length??0)+(queue.queue_pending?.length??0)>0)throw Error('BACKEND_QUEUE_BUSY');
   const submitted=await submitMeasured({submit:async(g,id)=>{await createGpuIntent(root,{clientId:id,receipt:receipt.receipt,status:'SUBMITTING',backendUrl:p.backend.url});intent=true;return client.submit(g,id);}},graph,graphId,()=>gpuResources(root));
   Object.assign(receipt,submitted);await save(receipt);
   if(submitted.status==='FAILED'){await resolveGpuIntent(root,graphId,'FAILED');return receipt;}
   if(submitted.status!=='SUBMITTED')return receipt;
   const state=await waitForJob(client,receipt.promptId,{deadlineMs:Math.max(1,1800000-(performance.now()-start)),onPoll:async remaining=>{const r=await gpuResources(root,remaining);await fs.appendFile(safeChild(root,rel+'/resources.jsonl'),JSON.stringify(r)+'\n');}});
   if(state.status==='COMPLETED')return await finishImage(receipt,state);
   Object.assign(receipt,state);await save(receipt);if(state.status==='FAILED')await resolveGpuIntent(root,graphId,'FAILED');return receipt;
  }catch(e){receipt.status=intent?'UNKNOWN':'FAILED';receipt.error=e.message;await save(receipt);return receipt;}
 }finally{await release();}
}
async function reconcile(){
 const pending=await readGpuIntent(root),p=await gpuRuntime(root);if(pending.backendUrl!==p.backend.url)throw Error('GPU_BACKEND_URL_CHANGED');
 const receipt=JSON.parse(await fs.readFile(safeChild(root,pending.receipt),'utf8'));if(receipt.clientId!==pending.clientId||receipt.receipt!==pending.receipt)throw Error('GPU_RECEIPT_IDENTITY_CHANGED');
 const client=new ComfyClient(p.backend.url),id=receipt.promptId??await findGpuPrompt(client,pending.clientId);
 if(!id)return {status:'UNKNOWN',error:'SUBMIT_ID_NOT_FOUND_KEEP_INTENT',receipt:pending.receipt};
 receipt.promptId=id;await save(receipt);const state=await client.history(id);
 if(state.status==='COMPLETED'){
  if(receipt.status==='VERIFIED'&&(receipt.image||receipt.clip)){const asset=receipt.image??receipt.clip;if(await hashFile(safeChild(root,asset.path))!==asset.sha256)throw Error('GPU_IMAGE_CHANGED');await resolveGpuIntent(root,receipt.clientId,'VERIFIED');return receipt;}
  return finishImage(receipt,state);
 }
 if(state.status==='FAILED'){receipt.status='FAILED';receipt.error=state.error;await save(receipt);await resolveGpuIntent(root,receipt.clientId,'FAILED');}
 return {...state,promptId:id,receipt:pending.receipt};
}
async function main(){const [command,...args]=process.argv.slice(2);
 if(command==='preflight'&&!args.length){const p=await gpuRuntime(root),r=await gpuResources(root);assertResources(r);return {status:'VERIFIED',backend:p.backend,resources:r};}
 if(command==='status'&&!args.length){const p=await gpuRuntime(root);return {status:'VERIFIED',inferenceStatus:'UNVERIFIED',backend:p.backend,system:await new ComfyClient(p.backend.url).request('/system_stats'),resources:await gpuResources(root)};}
 if(command==='history'&&args.length===1){const p=await gpuRuntime(root);return new ComfyClient(p.backend.url).history(args[0]);}
 if(command==='reconcile'&&!args.length)return reconcile();
 if(command==='image'&&args.length===1)return image(args[0]);
 if(command==='image-request'&&args.length===1){if(!/^\.runtime\/studio\/jobs\/job-[a-f0-9-]{36}\/image-request\.json$/.test(args[0]))throw Error('INVALID_IMAGE_REQUEST_PATH');const file=safeChild(root,args[0]);if((await fs.stat(file)).size>16384)throw Error('IMAGE_REQUEST_OVERSIZE');const payload=JSON.parse(await fs.readFile(file,'utf8'));if(!payload||Object.keys(payload).some(k=>!['request','identity'].includes(k)))throw Error('INVALID_IMAGE_REQUEST');const request=canonicalImageRequest(payload.request),identity=gpuImageIdentity(payload.identity);return image(request.resolvedPrompt,undefined,request,identity);}
 if(command==='clip-request'&&args.length===1){if(!/^\.runtime\/studio\/jobs\/job-[a-f0-9-]{36}\/clip-request\.json$/.test(args[0]))throw Error('INVALID_CLIP_REQUEST_PATH');const file=safeChild(root,args[0]);if((await fs.stat(file)).size>16384)throw Error('CLIP_REQUEST_OVERSIZE');const payload=JSON.parse(await fs.readFile(file,'utf8'));if(!payload||Object.keys(payload).some(k=>!['request','identity'].includes(k)))throw Error('INVALID_CLIP_REQUEST');const request=canonicalClipRequest(payload.request),identity=gpuImageIdentity(payload.identity);return image(request.prompt,request.source.receipt,request,identity);}
 if(command==='clip'&&args.length===2)return image(args[1],args[0]);
 throw Error('USAGE: preflight | status | image PROMPT_TEXT | clip IMAGE_RECEIPT PROMPT_TEXT | history PROMPT_ID | reconcile');
}
main().then(r=>{console.log(JSON.stringify(r));if(['FAILED','UNKNOWN'].includes(r.status))process.exitCode=1;}).catch(e=>{console.log(JSON.stringify({status:'FAILED',error:e.message}));process.exitCode=1;});
