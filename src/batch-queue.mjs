import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {safeChild} from './core.mjs';import {canonicalBrief,briefHash,readLimited} from './editor-store.mjs';import {atomicJson} from './editor-atomic.mjs';import {catalog} from './studio.mjs';import {formatProfile} from './formats.mjs';
const terminal=new Set(['VERIFIED','PARTIAL']);
export class BatchQueue{
 constructor(root,jobs){this.root=root;this.jobs=jobs;this.records=new Map();this.busy=false;this.closed=false;}
 dir(id){if(!/^batch-[a-f0-9-]{36}$/.test(id))throw Error('INVALID_BATCH_ID');return safeChild(this.root,'.runtime/studio/batches/'+id);}
 async save(record,patch={}){const next={...record,...patch,revision:record.revision+1,updatedAt:new Date().toISOString()};await atomicJson(this.root,path.join(this.dir(next.id),String(next.revision).padStart(8,'0')+'.json'),next);this.records.set(next.id,next);return next;}
 async init(){const dir=safeChild(this.root,'.runtime/studio/batches');await fs.mkdir(dir,{recursive:true});
  for(const id of (await fs.readdir(dir)).filter(n=>/^batch-[a-f0-9-]{36}$/.test(n))){const folder=this.dir(id),names=(await fs.readdir(folder)).filter(n=>/^\d{8}\.json$/.test(n)).sort();
   try{if(!names.length)throw Error('BATCH_UNSEALED');let b=JSON.parse(await readLimited(path.join(folder,names.at(-1))));if(b.id!==id||!b.sealed||!Array.isArray(b.entries)||!b.entries.length||b.entries.length>12)throw Error('BATCH_CORRUPT');
    this.records.set(id,b);if(!terminal.has(b.status)&&b.status!=='BLOCKED')await this.save(b,{status:'PAUSED',error:'RESTART_REQUIRES_RESUME'});
   }catch(e){this.records.set(id,{id,revision:0,sealed:false,status:'BLOCKED',entries:[],error:'BATCH_CORRUPT_OR_UNSEALED'});}
  }this.jobs.onChange=()=>this.schedule();return this;
 }
 schedule(){if(this.closed||this.timer)return;this.timer=setTimeout(()=>{this.timer=null;void this.pump().catch(()=>{});},500);this.timer.unref();}
 async enqueue(project,variants){
  if(!Array.isArray(variants)||!variants.length||variants.length>12||new Set(variants.map(v=>v?.format+'/'+v?.theme)).size!==variants.length)throw Error('INVALID_VARIANTS');
  for(const v of variants){try{formatProfile(v.format);}catch{throw Error('INVALID_VARIANTS');}if(!catalog.themes.some(t=>t.id===v.theme)||Object.keys(v).some(k=>!['format','theme'].includes(k)))throw Error('INVALID_VARIANTS');}
  const brief=canonicalBrief(project.brief);if(this.busy||this.admitting||[...this.records.values()].some(b=>!terminal.has(b.status)))throw Error('BATCH_BUSY');this.admitting=true;
  let b;try{const id='batch-'+randomUUID(),dir=this.dir(id);await fs.mkdir(dir);const entries=[];
   for(let i=0;i<variants.length;i++){const v=variants[i],snapshot=canonicalBrief({...brief,...v}),name='v'+i+'.json';await atomicJson(this.root,path.join(dir,name),snapshot);entries.push({variantId:'v'+i,...v,briefFile:name,briefHash:briefHash(snapshot),status:'QUEUED',jobId:null});}
   b=await this.save({id,revision:0,sealed:true,projectId:brief.id,projectRevision:project.revision,createdAt:new Date().toISOString(),status:'QUEUED',entries});
  }finally{this.admitting=false;}await this.pump();return structuredClone(this.records.get(b.id));
 }
 async list(){return structuredClone([...this.records.values()].reverse());}
 activity(){if(this.busy||this.admitting)return 'busy';for(const b of this.records.values()){if(['QUEUED','RUNNING'].includes(b.status))return 'busy';if(!['VERIFIED','PARTIAL','PAUSED','FAILED'].includes(b.status)||!Array.isArray(b.entries)||b.entries.some(e=>e.status==='UNKNOWN'||e.jobId&&!this.jobs.records.has(e.jobId)))return 'unknown';}return 'idle';}
 async resume(id){const b=this.records.get(id);if(!b)throw Error('BATCH_NOT_FOUND');if(!b.sealed||b.status==='BLOCKED')throw Error('BATCH_BLOCKED');if(this.busy)throw Error('BATCH_BUSY');
  if([...this.jobs.records.values()].some(j=>j.status==='UNKNOWN'))throw Error('JOB_UNKNOWN');if(!['PAUSED','FAILED'].includes(b.status))throw Error('BATCH_NOT_PAUSED');
  const entries=b.entries.map(e=>({...e,status:e.status==='FAILED'?'SKIPPED_FAILED':e.status}));await this.save(b,{status:'QUEUED',entries,error:null});await this.pump();return structuredClone(this.records.get(id));
 }
 async pump(){if(this.busy||this.closed)return;this.busy=true;try{
  let b=[...this.records.values()].find(b=>['QUEUED','RUNNING'].includes(b.status));if(!b)return;let entries=structuredClone(b.entries);
  for(const e of entries){if(['VERIFIED','SKIPPED_FAILED'].includes(e.status))continue;
   const matches=[...this.jobs.records.values()].filter(j=>j.batchId===b.id&&j.variantId===e.variantId);
   if(matches.length>1){await this.save(b,{status:'BLOCKED',error:'DUPLICATE_JOB_IDENTITY'});return;}
   const job=matches[0]??(e.jobId?this.jobs.records.get(e.jobId):null);
   if(job){if(job.batchId!==b.id||job.variantId!==e.variantId){await this.save(b,{status:'BLOCKED',error:'JOB_IDENTITY_CHANGED'});return;}
    e.jobId=job.id;e.status=job.status;
    if(job.status==='VERIFIED')continue;
    if(job.status==='FAILED'){await this.save(b,{entries,status:'FAILED',error:'VARIANT_FAILED'});return;}
    if(job.status==='UNKNOWN'){await this.save(b,{entries,status:'PAUSED',error:'JOB_UNKNOWN'});return;}
    await this.save(b,{entries,status:'RUNNING'});this.schedule();return;
   }
   if(e.status!=='QUEUED'||e.jobId){await this.save(b,{status:'BLOCKED',error:'JOB_RECORD_MISSING'});return;}
   let brief;try{if(e.briefFile!==e.variantId+'.json')throw Error('BATCH_SNAPSHOT_CHANGED');brief=canonicalBrief(JSON.parse(await readLimited(safeChild(this.root,path.relative(this.root,path.join(this.dir(b.id),e.briefFile))))));if(briefHash(brief)!==e.briefHash)throw Error('BATCH_SNAPSHOT_CHANGED');}
   catch{await this.save(b,{status:'BLOCKED',error:'BATCH_SNAPSHOT_CHANGED'});return;}
   try{const j=await this.jobs.start('export',{brief,projectId:b.projectId,projectRevision:b.projectRevision,batchId:b.id,variantId:e.variantId});e.jobId=j.id;e.status=j.status;await this.save(b,{entries,status:j.status==='FAILED'?'FAILED':'RUNNING'});this.schedule();return;}
   catch(err){if(err.message==='JOB_BUSY'){this.schedule();return;}await this.save(b,{status:'PAUSED',error:err.message==='JOB_UNKNOWN'?'JOB_UNKNOWN':'ADMISSION_FAILED'});return;}
  }
  await this.save(b,{entries,status:entries.some(e=>e.status==='SKIPPED_FAILED')?'PARTIAL':'VERIFIED',error:null});
 }finally{this.busy=false;}}
 close(){this.closed=true;clearTimeout(this.timer);}
}
