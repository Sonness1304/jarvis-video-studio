import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';import {spawn} from 'node:child_process';
import {safeChild} from './core.mjs';import {canonicalBrief,briefHash,readLimited} from './editor-store.mjs';import {childEnvironment} from './process.mjs';
import {hashFile} from './runtime.mjs';
import {atomicJson} from './editor-atomic.mjs';
import {canonicalImageRequest,validateImageResult,gpuImageIdentity,validateImageOwnership} from './ai-studio.mjs';
import {canonicalClipRequest,validateClipResult,validateClipOwnership} from './ai-clips.mjs';
import {voiceWorkbenchRequest} from './voice-workbench.mjs';
import {validateDubbing,validateTranslationCandidate} from '../web/dubbing-model.mjs';
export class JobManager{
 constructor(root){this.root=root;this.records=new Map();this.chains=new Map();}
 dir(id){if(!/^job-[a-z0-9-]{1,48}$/.test(id))throw Error('INVALID_JOB_ID');return safeChild(this.root,'.runtime/studio/jobs/'+id);}
 async init(){const dir=safeChild(this.root,'.runtime/studio/jobs');await fs.mkdir(dir,{recursive:true});
  for(const id of (await fs.readdir(dir)).filter(n=>/^job-[a-z0-9-]{1,48}$/.test(n))){
   const folder=this.dir(id),names=(await fs.readdir(folder)).filter(n=>/^\d{8}\.json$/.test(n)).sort();if(!names.length)continue;
   let r;try{r=JSON.parse(await readLimited(safeChild(this.root,path.relative(this.root,path.join(folder,names.at(-1)))),2*1024*1024));}catch(e){if(!(e instanceof SyntaxError))throw e;r={id,revision:Number(names.at(-1).slice(0,8)),status:'UNKNOWN',kind:'unknown',error:'JOB_RECORD_CORRUPT_CHECK_PROCESS_AND_LEASE'};}this.records.set(id,r);
   if(r.status==='RUNNING')await this.update(id,{status:'UNKNOWN',error:'SERVER_RESTART_CHECK_LEASE_BEFORE_RETRY'});
  }
 }
 async update(id,patch){const previous=this.chains.get(id)??Promise.resolve();const next=previous.then(async()=>{
  const old=this.records.get(id);if(!old)throw Error('JOB_NOT_FOUND');const record={...old,...patch,revision:old.revision+1,updatedAt:new Date().toISOString()};
  await atomicJson(this.root,path.join(this.dir(id),String(record.revision).padStart(8,'0')+'.json'),record);this.records.set(id,record);this.onChange?.();return record;
 });this.chains.set(id,next.catch(()=>{}));return next;}
 async list(){return [...this.records.values()].reverse();}
 async resultArtifacts(record,result){
  if(record.kind==='dubbing'){
   if(result.action!==record.request.action||result.documentId!==record.request.doc.id||result.documentRevision!==record.request.revision||result.sourceHash!==record.request.doc.sourceHash)throw Error('DUB_RESULT_IDENTITY');
   if(result.action==='translate'){validateTranslationCandidate(record.request.doc,result.candidate);return {};}
   if(result.action==='speakers'){validateDubbing({...record.request.doc,schemaVersion:2,background:record.request.doc.background??{mode:'unselected'},speakers:result.speakers,segments:result.segments});return {};}
   if(result.action==='transcribe'){if(!Array.isArray(result.segments))throw Error('DUB_ASR_SEGMENTS_INVALID');validateDubbing({...record.request.doc,segments:result.segments});return {};}
   const sealed={};for(const [key,name] of [['video','video.mp4'],['captions','captions.srt']]){const a=result.artifacts?.[key];if(!a||!/^outputs\/dub-[a-f0-9-]{36}\//.test(a.path??'')||!a.path.endsWith('/'+name)||!/^[a-f0-9]{64}$/.test(a.sha256??'')||await hashFile(safeChild(this.root,a.path))!==a.sha256)throw Error('INVALID_JOB_ARTIFACT');sealed[key]=a;}return sealed;
  }
  if(record.kind==='clip')return validateClipResult(this.root,record,result);
  if(record.kind==='image')return validateImageResult(this.root,record,result);
  const file=['voice','voice-workbench'].includes(record.kind)?result.audio:result.artifacts?.video;
  if(!file||!/^outputs\/[a-zA-Z0-9_-]+\/(video\.mp4|sample\.wav)$/.test(file.path??'')||!/^[a-f0-9]{64}$/.test(file.sha256??''))throw Error('INVALID_JOB_ARTIFACT');
  if(await hashFile(safeChild(this.root,file.path))!==file.sha256)throw Error('JOB_ARTIFACT_CHANGED');
  const sealed={};if(record.kind==='export'){
   if(result.briefHash!==record.briefHash||file.path!=='outputs/'+result.attempt+'/video.mp4')throw Error('JOB_SNAPSHOT_CHANGED');
   for(const [key,name] of [['captions','captions.srt'],['timeline','timeline.json'],['receipt','receipt.json']]){const relative='outputs/'+result.attempt+'/'+name;const target=safeChild(this.root,relative);await readLimited(target);sealed[key]={path:relative,sha256:await hashFile(target)};}
  }return sealed;
 }
 async reconcile(id){const record=this.records.get(id);if(!record)throw Error('JOB_NOT_FOUND');if(record.status!=='UNKNOWN')throw Error('JOB_NOT_UNKNOWN');
  if(['image','clip'].includes(record.kind)){
   if(record.pid){try{process.kill(record.pid,0);return record;}catch(e){if(e.code!=='ESRCH')return record;}}
   if(!record.gpuIdentity)return record;const identity=gpuImageIdentity(record.gpuIdentity);let terminal;try{terminal=JSON.parse(await readLimited(safeChild(this.root,identity.receipt),32768));}catch(e){if(e.code==='ENOENT'||e instanceof SyntaxError)return record;throw e;}
   (record.kind==='clip'?validateClipOwnership:validateImageOwnership)(record,terminal);if(terminal.status==='VERIFIED'){const sealed=await this.resultArtifacts(record,terminal);return this.update(id,{status:'VERIFIED',result:terminal,sealed,reconciledAt:new Date().toISOString()});}
   if(terminal.status==='FAILED')return this.update(id,{status:'FAILED',result:terminal,error:String(terminal.error??'GPU_JOB_FAILED').slice(0,140),reconciledAt:new Date().toISOString()});return record;
  }
  const file=safeChild(this.root,path.relative(this.root,path.join(this.dir(id),'process.log')));
  let result;try{const lines=(await readLimited(file,4*1024*1024)).trim().split(/\r?\n/);result=JSON.parse(lines.at(-1));}catch{return record;}
  if(result?.status==='VERIFIED'){const sealed=await this.resultArtifacts(record,result);return this.update(id,{status:'VERIFIED',result,sealed,reconciledAt:new Date().toISOString()});}
  if(result?.status==='FAILED')return this.update(id,{status:'FAILED',error:String(result.error??'JOB_FAILED').slice(0,140),reconciledAt:new Date().toISOString()});
  return record;
 }
 async acknowledgeTranslationUnknown(id,acknowledge){
  if(acknowledge!==true)throw Error('DUB_UNKNOWN_ACK_REQUIRED');
  let record=this.records.get(id);if(!record||record.status!=='UNKNOWN'||record.kind!=='dubbing'||record.request?.action!=='translate')throw Error('DUB_NOT_UNKNOWN_TRANSLATION');
  if(!record.workerExited&&record.pid){try{process.kill(record.pid,0);throw Error('DUB_PROCESS_STILL_RUNNING');}catch(e){if(e.code!=='ESRCH')throw e;}}
  if(!record.workerExited&&!record.pid)throw Error('DUB_PROCESS_EXIT_UNVERIFIED');
  const lines=(await readLimited(path.join(this.dir(id),'process.log'),4*1024*1024)).trim().split(/\r?\n/),result=JSON.parse(lines.at(-1));
  if(result.status!=='UNKNOWN'||result.action!=='translate'||result.documentId!==record.request.doc.id||result.documentRevision!==record.request.revision||result.sourceHash!==record.request.doc.sourceHash)throw Error('DUB_RESULT_IDENTITY');
  record=this.records.get(id);if(record.status!=='UNKNOWN')throw Error('DUB_NOT_UNKNOWN_TRANSLATION');
  return this.update(id,{status:'FAILED',result,error:'DUB_TRANSLATION_OUTCOME_UNKNOWN_ACKNOWLEDGED',providerOutcome:'UNVERIFIED',workerExited:true,acknowledgedAt:new Date().toISOString()});
 }
 async start(kind,data){
  if(!['export','voice','voice-workbench','dubbing','image','clip'].includes(kind))throw Error('INVALID_JOB_KIND');
  if(this.admitting)throw Error('JOB_BUSY');this.admitting=true;
  try{return await this.startLocked(kind,data);}finally{this.admitting=false;}
 }
 async exclusive(action){if(this.admitting||[...this.records.values()].some(r=>r.status==='RUNNING'))throw Error('JOB_BUSY');if([...this.records.values()].some(r=>r.status==='UNKNOWN'))throw Error('JOB_UNKNOWN');this.admitting=true;try{return await action();}finally{this.admitting=false;this.onChange?.();}}
 async startLocked(kind,data){
  if(!['export','voice','voice-workbench','dubbing','image','clip'].includes(kind))throw Error('INVALID_JOB_KIND');
  if(kind==='image')canonicalImageRequest(data.imageRequest);
  if(kind==='clip')canonicalClipRequest(data.clipRequest);
  if([...this.records.values()].some(r=>r.status==='UNKNOWN'))throw Error('JOB_UNKNOWN');
  if([...this.records.values()].some(r=>r.status==='RUNNING'))throw Error('JOB_BUSY');
  const id='job-'+randomUUID(),dir=this.dir(id);await fs.mkdir(dir,{recursive:true});
  const record={id,revision:0,status:'RUNNING',kind,projectId:data.projectId??null,projectRevision:data.projectRevision??null,batchId:data.batchId??null,variantId:data.variantId??null,createdAt:new Date().toISOString(),pid:null};
  let args,exe=process.execPath;
  if(kind==='export'){const brief=canonicalBrief(data.brief);record.briefHash=briefHash(brief);const relative=path.relative(this.root,path.join(dir,'brief.json')).replaceAll('\\','/');await fs.writeFile(safeChild(this.root,relative),JSON.stringify(brief),{flag:'wx'});args=['src/cli.mjs','build',relative];}
  else if(kind==='dubbing'){validateDubbing(data.request.doc);if(!['transcribe','export','translate','speakers'].includes(data.request.action))throw Error('DUB_REQUEST_INVALID');record.request=data.request;const relative=path.relative(this.root,path.join(dir,'dubbing-request.json')).replaceAll('\\','/');await fs.writeFile(safeChild(this.root,relative),JSON.stringify(record.request),{flag:'wx'});args=['src/dubbing-worker.mjs',relative];if(data.request.action==='translate'){exe='C:/Program Files/PowerShell/7/pwsh.exe';args=['-NoProfile','-NonInteractive','-File',safeChild(this.root,'scripts/run-dubbing-ai.ps1'),'-JobId',id];}}
  else if(kind==='voice-workbench'){record.request=voiceWorkbenchRequest(data.request);const relative=path.relative(this.root,path.join(dir,'voice-request.json')).replaceAll('\\','/');await fs.writeFile(safeChild(this.root,relative),JSON.stringify(record.request),{flag:'wx'});args=['src/voice-worker.mjs',relative];}
  else if(['image','clip'].includes(kind)){record[kind+'Request']=data[kind+'Request'];record.sceneId=data.sceneId;const imageId='jarvis-'+randomUUID();record.gpuIdentity={id:imageId,clientId:imageId,receipt:'outputs/'+imageId+'/receipt.json'};const relative=path.relative(this.root,path.join(dir,kind+'-request.json')).replaceAll('\\','/');await fs.writeFile(safeChild(this.root,relative),JSON.stringify({request:data[kind+'Request'],identity:record.gpuIdentity}),{flag:'wx'});args=['src/gpu-cli.mjs',kind+'-request',relative];}
  else {if(typeof data.voice!=='string'||!data.voice||data.voice.length>64)throw Error('INVALID_VOICE');record.voice=data.voice;args=['src/studio-cli.mjs','voice-preview',data.voice];}
  this.records.set(id,record);await this.update(id,{});
  let handle;try{
   const config=JSON.parse(await fs.readFile(safeChild(this.root,'runtime-config.json'),'utf8'));
   handle=await fs.open(safeChild(this.root,path.relative(this.root,path.join(dir,'process.log'))),'wx');
   const childEnv=childEnvironment(this.root,config);if(kind==='dubbing'&&record.request.action==='translate')childEnv.JARVIS_CONTENT_NODE=process.execPath;
   const child=spawn(exe,args,{cwd:this.root,env:childEnv,shell:false,windowsHide:true,stdio:['ignore',handle.fd,handle.fd]});
   let finished=false;const finish=async(code,error)=>{if(finished)return;finished=true;clearTimeout(timer);await handle.close();
    try{const lines=(await readLimited(safeChild(this.root,path.relative(this.root,path.join(dir,'process.log'))),4*1024*1024)).trim().split(/\r?\n/);const result=JSON.parse(lines.at(-1));
     if(result.status==='UNKNOWN'){await this.update(id,{status:'UNKNOWN',result,workerExited:true,error:result.error??'JOB_PENDING',endedAt:new Date().toISOString()});return;}
     if(code!==0||result.status!=='VERIFIED')throw Error(result.error??error??'JOB_FAILED');
     const sealed=await this.resultArtifacts(this.records.get(id),result);await this.update(id,{status:'VERIFIED',result,sealed,endedAt:new Date().toISOString()});
    }catch(e){let status='FAILED';if(['image','clip'].includes(kind))try{await fs.stat(safeChild(this.root,'.runtime/gpu-job.json'));status='UNKNOWN';}catch(stateError){if(stateError.code!=='ENOENT')status='UNKNOWN';}await this.update(id,{status,error:error??e.message,endedAt:new Date().toISOString()});}
   };
   const timer=setTimeout(()=>{void this.update(id,{status:'UNKNOWN',error:'JOB_DEADLINE_CHECK_PROCESS_NO_AUTO_RETRY'});},30*60*1000);timer.unref();
   child.once('close',(code)=>void finish(code).catch(()=>{}));
   await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
   await this.update(id,{pid:child.pid,spawnedAt:new Date().toISOString()});return this.records.get(id);
  }catch(e){await handle?.close().catch(()=>{});return this.update(id,{status:'FAILED',error:e.message});}
 }
}
