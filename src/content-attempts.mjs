import fs from 'node:fs/promises';import path from 'node:path';import {createHash,randomUUID} from 'node:crypto';import {spawn,execFileSync} from 'node:child_process';
import {safeChild} from './core.mjs';import {readLimited,requireId} from './editor-store.mjs';import {atomicJson} from './editor-atomic.mjs';
import {contentModels,validateContentInput} from './content-ai.mjs';import {validateContentCandidate} from '../web/content-model.mjs';
const digest=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const idCheck=id=>{if(!/^content-[a-f0-9-]{36}$/.test(id??''))throw Error('INVALID_CONTENT_ID');return id;};
const terminal=s=>['VERIFIED','FAILED'].includes(s);
export function contentProcessIdentity(pid){
 if(!Number.isInteger(pid)||pid<=0)return null;
 try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')return null;return undefined;}
 if(process.platform!=='win32')return undefined;
 try{
  const script=`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}'; if($p){@{pid=[int]$p.ProcessId;start=$p.CreationDate.ToUniversalTime().ToString('o');command=$p.CommandLine}|ConvertTo-Json -Compress}`;
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['systemroot','windir','path','pathext','temp','tmp','userprofile','programfiles'].includes(k.toLowerCase())));
  const text=execFileSync('C:/Program Files/PowerShell/7/pwsh.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,env,timeout:8000,maxBuffer:16384}).trim();return text?JSON.parse(text):null;
 }catch{return undefined;}
}
async function defaultProbe(owner){if(!owner)return 'unknown';const live=contentProcessIdentity(owner.pid);if(live===null)return 'dead';if(!live||live.start!==owner.start||!live.command?.includes('content-cli.mjs'))return 'unknown';return 'live';}
async function defaultLeaseProbe(owner){if(!owner)return 'unknown';const live=contentProcessIdentity(owner.pid);if(live===null)return 'dead';return live?.start===owner.start?'live':'unknown';}
export class ContentAttempts{
 constructor(root,{launch,ownerProbe=defaultProbe,leaseProbe=defaultLeaseProbe,clock=()=>new Date().toISOString(),projectCap=10,globalCap=100}={}){this.root=root;this.launch=launch??(a=>this.launchChild(a));this.ownerProbe=ownerProbe;this.leaseProbe=leaseProbe;this.clock=clock;this.projectCap=projectCap;this.globalCap=globalCap;}
 base(){return safeChild(this.root,'.runtime/studio/content-attempts');}
 file(id,name){return safeChild(this.root,'.runtime/studio/content-attempts/'+idCheck(id)+'/'+name);}
 async init(){await fs.mkdir(this.base(),{recursive:true});}
 async ids(){return (await fs.readdir(this.base())).filter(n=>/^content-[a-f0-9-]{36}$/.test(n));}
 async activity(){
  try{try{await fs.lstat(path.join(this.base(),'admission.lease'));return 'unknown';}catch(e){if(e.code!=='ENOENT')return 'unknown';}
   const ids=await this.ids();if(ids.length>this.globalCap)return 'unknown';
   for(const id of ids){const request=await this.request(id),r=await this.record(id);if(r.requestHash!==request.requestHash)return 'unknown';if(['QUEUED','RUNNING'].includes(r.status))return 'busy';if(!terminal(r.status))return 'unknown';
    let hasOwner=false;for(const name of ['owner.json','wrapper.json'])try{await fs.lstat(this.file(id,name));hasOwner=true;}catch(e){if(e.code!=='ENOENT')return 'unknown';}
    if(hasOwner&&await this.probe(id)!=='dead')return 'unknown';
   }return 'idle';
  }catch{return 'unknown';}
 }
 async request(id){const request=JSON.parse(await readLimited(this.file(id,'request.json'),32768));const {requestHash,...rest}=request;if(request.id!==id||digest(rest)!==requestHash)throw Error('CONTENT_REQUEST_HASH');return request;}
 async record(id){const names=(await fs.readdir(path.dirname(this.file(id,'request.json')))).filter(n=>/^\d{8}\.json$/.test(n)).sort();if(!names.length)throw Error('CONTENT_NOT_FOUND');const r=JSON.parse(await readLimited(this.file(id,names.at(-1)),16384));if(r.id!==id||!Number.isInteger(r.revision))throw Error('CONTENT_RECORD_INVALID');return r;}
 async update(id,patch){const old=await this.record(id),next={...old,...patch,revision:old.revision+1,updatedAt:this.clock()};if(Buffer.byteLength(JSON.stringify(next))>16384)throw Error('CONTENT_RECORD_TOO_LARGE');return atomicJson(this.root,this.file(id,String(next.revision).padStart(8,'0')+'.json'),next);}
 async list(projectId){requireId(projectId);const out=[];for(const id of await this.ids()){const r=await this.request(id);if(r.projectId===projectId)out.push(await this.read(id,projectId));}return out.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
 async read(id,projectId){const request=await this.request(id);if(request.projectId!==requireId(projectId))throw Error('CONTENT_PROJECT_MISMATCH');const record=await this.record(id);if(record.requestHash!==request.requestHash)throw Error('CONTENT_REQUEST_HASH');
  if(record.status==='VERIFIED'){const source=await readLimited(this.file(id,'result.json'),70000);if(digest(source)!==record.resultHash)throw Error('CONTENT_RESULT_HASH');const result=JSON.parse(source);if(result.nonce!==request.nonce||result.requestHash!==request.requestHash)throw Error('CONTENT_OWNER_MISMATCH');return {...record,candidate:validateContentCandidate(result.candidate)};}return record;
 }
 async admission(){
  const file=path.join(this.base(),'admission.lease'),identity=contentProcessIdentity(process.pid),owner={pid:process.pid,start:identity?.start??'unverified',nonce:randomUUID()};
  try{await atomicJson(this.root,file,owner);}catch(e){
   if(e.code!=='EEXIST')throw e;let previous,source;
   try{source=await readLimited(file,4096);previous=JSON.parse(source);}catch{throw Error('CONTENT_BUSY');}
   if(!/^[-a-f0-9]{36}$/.test(previous.nonce??'')||await this.leaseProbe(previous)!=='dead')throw Error('CONTENT_BUSY');
   const archive=path.join(this.base(),'admission-'+previous.nonce+'.archive');
   // An exclusive hardlink elects a single recovery owner. Unknown/interrupted recovery holds.
   try{await fs.link(file,archive);}catch{throw Error('CONTENT_BUSY');}
   if(await readLimited(file,4096)!==source)throw Error('CONTENT_BUSY');await fs.unlink(file);
   try{await atomicJson(this.root,file,owner);}catch{throw Error('CONTENT_BUSY');}
  }
  return async()=>{const current=JSON.parse(await readLimited(file,4096));if(current.nonce!==owner.nonce)throw Error('CONTENT_LEASE_CHANGED');await fs.unlink(file);};
 }
 async start(input){
  if(!input||Object.keys(input).some(k=>!['projectId','projectRevision','draftHash','contentBrief','sceneCount','model','fallbackFrom'].includes(k)))throw Error('INVALID_CONTENT_REQUEST');
  requireId(input.projectId);validateContentInput({contentBrief:input.contentBrief,sceneCount:input.sceneCount});if(!Number.isSafeInteger(input.projectRevision)||input.projectRevision<1||!/^[a-f0-9]{64}$/.test(input.draftHash??'')||!Object.values(contentModels).includes(input.model))throw Error('INVALID_CONTENT_REQUEST');
  const release=await this.admission();
  try{
   const ids=await this.ids(),own=[];for(const id of ids){const r=await this.request(id);if(r.projectId===input.projectId)own.push(await this.record(id));}
   for(const r of own.filter(r=>!terminal(r.status))){if(await this.probe(r.id)!=='dead')throw Error('CONTENT_BUSY');if(r.status!=='UNKNOWN')await this.update(r.id,{status:'UNKNOWN',error:'CONTENT_OUTCOME_UNKNOWN'});}
   if(ids.length>=this.globalCap||own.length>=this.projectCap)throw Error('CONTENT_CAP');
   if(input.model===contentModels.opus){const previous=input.fallbackFrom?await this.read(idCheck(input.fallbackFrom),input.projectId):null;
    if(!previous||previous.model!==contentModels.sonnet||previous.status!=='FAILED'||previous.fallbackEligible!==true||await this.probe(previous.id)!=='dead')throw Error('CONTENT_FALLBACK_DENIED');
   }else if(input.fallbackFrom!==undefined)throw Error('CONTENT_FALLBACK_DENIED');
   const id='content-'+randomUUID(),dir=path.dirname(this.file(id,'request.json'));await fs.mkdir(dir);
   const values={...input,id,nonce:randomUUID(),createdAt:this.clock()},request={...values,requestHash:digest(values)};await atomicJson(this.root,this.file(id,'request.json'),request);
   const record={schemaVersion:1,id,revision:1,projectId:input.projectId,projectRevision:input.projectRevision,draftHash:input.draftHash,model:input.model,requestHash:request.requestHash,status:'QUEUED',createdAt:values.createdAt,updatedAt:values.createdAt,usage:null,thinking:'UNVERIFIED'};
   await atomicJson(this.root,this.file(id,'00000001.json'),record);
   try{await this.launch(record);}catch{await this.update(id,{status:'FAILED',error:'CONTENT_LAUNCH_FAILED',fallbackEligible:false});}
   return this.read(id,input.projectId);
  }finally{await release();}
 }
 async verifyConnector(){const config=JSON.parse(await readLimited(safeChild(this.root,'content-connector.json'),4096));if(config.schemaVersion!==1||config.endpoint!=='http://127.0.0.1:20128/v1')throw Error('CONTENT_CONNECTOR_CHANGED');const loader=await fs.readFile(config.savedKeyLoader);if(digest(loader)!==config.loaderSha256)throw Error('CONTENT_LOADER_CHANGED');return config;}
 async launchChild(record){
  await this.verifyConnector();
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['systemroot','windir','path','pathext','temp','tmp','userprofile','localappdata','appdata','comspec','programfiles','programdata'].includes(k.toLowerCase())));
  env.JARVIS_CONTENT_NODE=process.execPath;
  const child=spawn('C:/Program Files/PowerShell/7/pwsh.exe',['-NoProfile','-NonInteractive','-File',safeChild(this.root,'scripts/run-content-ai.ps1'),'-RequestId',record.id],{cwd:this.root,env,windowsHide:true,detached:false,stdio:'ignore'});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  const wrapper=contentProcessIdentity(child.pid);await atomicJson(this.root,this.file(record.id,'wrapper.json'),{...wrapper,pid:child.pid,nonce:(await this.request(record.id)).nonce});
  child.once('exit',()=>{void this.wrapperEnded(record.id).catch(()=>{});});child.unref();
 }
 async wrapperEnded(id){const r=await this.record(id);if(terminal(r.status))return;try{await fs.stat(this.file(id,'owner.json'));}catch(e){if(e.code==='ENOENT')await this.update(id,{status:'FAILED',error:'CONTENT_HELPER_FAILED',fallbackEligible:false});}}
 async probe(id){let owner;try{owner=JSON.parse(await readLimited(this.file(id,'owner.json'),4096));const r=await this.request(id);if(owner.nonce!==r.nonce)return 'unknown';}catch(e){if(e.code!=='ENOENT')return 'unknown';
   try{const wrapper=JSON.parse(await readLimited(this.file(id,'wrapper.json'),4096));if(wrapper.nonce!==(await this.request(id)).nonce)return 'unknown';return this.leaseProbe(wrapper);}catch{}
  }return this.ownerProbe(owner);}
 async reconcile(id,projectId){const old=await this.read(id,projectId);if(terminal(old.status))return old;
  try{const result=JSON.parse(await readLimited(this.file(id,'result.json'),70000));return await this.publish(id,result);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(old.status!=='UNKNOWN')await this.update(id,{status:'UNKNOWN',error:await this.probe(id)==='live'?'CONTENT_OWNER_RUNNING':'CONTENT_OUTCOME_UNKNOWN'});return this.read(id,projectId);
 }
 async publish(id,result){
  const request=await this.request(id);if(result.nonce!==request.nonce||result.requestHash!==request.requestHash)throw Error('CONTENT_OWNER_MISMATCH');
  const old=await this.record(id);if(terminal(old.status))return this.read(id,request.projectId);
  if(!['VERIFIED','FAILED','UNKNOWN'].includes(result.status))throw Error('CONTENT_RESULT_INVALID');
  if(result.status==='VERIFIED')validateContentCandidate(result.candidate);
  const file=this.file(id,'result.json');try{await atomicJson(this.root,file,result);}catch(e){if(e.code!=='EEXIST')throw e;const existing=JSON.parse(await readLimited(file,70000));if(JSON.stringify(existing)!==JSON.stringify(result))throw Error('CONTENT_RESULT_CHANGED');}
  const patch={status:result.status,resultHash:digest(await fs.readFile(file,'utf8')),usage:result.usage??null,actualModel:result.actualModel??null,elapsedMs:result.elapsedMs??null,fallbackEligible:result.fallbackEligible===true};
  if(result.error)patch.error=/^CONTENT_[A-Z0-9_]{1,80}$/.test(result.error)?result.error:'CONTENT_FAILED';
  try{await this.update(id,patch);}catch(e){if(e.code!=='EEXIST')throw e;}
  return this.read(id,request.projectId);
 }
}
