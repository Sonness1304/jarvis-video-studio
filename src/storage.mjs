import fs from 'node:fs/promises';import path from 'node:path';import {safeChild} from './core.mjs';
const optionalMissing=e=>e.code==='ENOENT';
function category(file){const name=path.posix.basename(file);if(/\.(py|mjs|js|blend)$/i.test(name))return 'recipe-source';if(/^(?:frame[-_]?)?\d{4,8}\.png$/i.test(name))return 'numbered-frame-candidate';if(/\.(mp4|mov|webm|wav|mp3|flac|srt|ass)$/i.test(name))return 'media-subtitle';if(/(?:codex|cover)/i.test(name))return 'source-cover';if(/\.(json|txt|md)$/i.test(name))return 'metadata';return 'unclassified';}
export async function inspectStorage(root){
 const warnings=[],files=[],metadata={projects:[],assets:[],jobs:[]},refs=new Map(),groups={},largest=new Map();
 const warn=(file,e)=>warnings.push({path:file,code:e.code??e.message});
 async function walk(relative,sink){let entries;try{entries=await fs.readdir(safeChild(root,relative),{withFileTypes:true});}catch(e){if(!optionalMissing(e))warn(relative,e);return;}
  for(const entry of entries){const file=relative+'/'+entry.name;try{const st=await fs.lstat(safeChild(root,file));if(st.isSymbolicLink()){warnings.push({path:file,code:'LINK_NOT_TRAVERSED'});continue}if(st.isDirectory())await walk(file,sink);else if(st.isFile())sink.push({path:file,bytes:st.size});}catch(e){warn(file,e.message==='SYMLINK_PATH'?{code:'LINK_NOT_TRAVERSED'}:e);}}
 }
 await walk('outputs',files);for(const [kind,folder] of [['projects','projects'],['assets','assets'],['jobs','jobs']])await walk('.runtime/studio/'+folder,metadata[kind]);
 for(const file of files){const key=category(file.path),g=groups[key]??={files:0,bytes:0};g.files++;g.bytes+=file.bytes;const dir=file.path.split('/')[1],row=largest.get(dir)??{path:'outputs/'+dir,files:0,bytes:0};row.files++;row.bytes+=file.bytes;largest.set(dir,row);}
 const latest=new Map();for(const file of metadata.jobs.filter(f=>/\/\d{8}\.json$/.test(f.path))){const dir=path.posix.dirname(file.path),old=latest.get(dir);if(!old||old.path<file.path)latest.set(dir,file);}
 let projectRevisions=0,assetManifests=0;const jobState={active:[],unknown:[],leases:[],safeToRender:false,processCoverage:'PERSISTED_ONLY'};
 function visit(value,owner){if(typeof value==='string'&&value.startsWith('outputs/')){const owners=refs.get(value)??[];if(!owners.some(o=>JSON.stringify(o)===JSON.stringify(owner)))owners.push(owner);refs.set(value,owners);}else if(Array.isArray(value))for(const v of value)visit(v,owner);else if(value&&typeof value==='object')for(const v of Object.values(value))visit(v,owner);}
 async function read(file,kind){if(!file.path.endsWith('.json'))return;if(file.bytes>131072){warn(file.path,{code:'METADATA_TOO_LARGE'});return}
  try{const target=safeChild(root,file.path),st=await fs.lstat(target);if(!st.isFile()||st.size!==file.bytes)throw Error('METADATA_CHANGED');const data=await fs.readFile(target);if(data.length>131072)throw Error('METADATA_TOO_LARGE');const record=JSON.parse(data.toString('utf8'));if(!record||Array.isArray(record)||typeof record!=='object')throw Error('METADATA_INVALID');
   const owner={kind,id:file.path.split('/').at(-2),revision:path.posix.basename(file.path,'.json')};visit(record,owner);if(kind==='project')projectRevisions++;if(kind==='asset')assetManifests++;
   if(kind==='job'&&latest.get(path.posix.dirname(file.path))===file){if(record.status==='RUNNING')jobState.active.push(owner.id);else if(!['VERIFIED','FAILED','CANCELLED','INTERRUPTED'].includes(record.status))jobState.unknown.push(owner.id);}
  }catch(e){warn(file.path,e instanceof SyntaxError?{code:'METADATA_INVALID'}:e);if(kind==='job')jobState.unknown.push(path.posix.dirname(file.path));}
 }
 for(const f of metadata.projects.filter(f=>/\/\d{8}\.json$/.test(f.path)))await read(f,'project');for(const f of metadata.assets)await read(f,'asset');for(const f of metadata.jobs)await read(f,'job');
 for(const lease of ['.runtime/build.lock','.runtime/gpu-job.json'])try{await fs.lstat(safeChild(root,lease));jobState.leases.push(lease);}catch(e){if(!optionalMissing(e)){warn(lease,e);jobState.leases.push(lease);}}
 jobState.safeToRender=!jobState.active.length&&!jobState.unknown.length&&!jobState.leases.length&&!warnings.length;
 return {schemaVersion:1,observedAt:new Date().toISOString(),status:warnings.length?'PARTIAL':'VERIFIED',logicalBytesOnly:true,totals:{files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0)},groups,largest:[...largest.values()].sort((a,b)=>b.bytes-a.bytes).slice(0,20),references:{coverage:'INCOMPLETE',projectRevisions,assetManifests,entries:[...refs].sort(([a],[b])=>a.localeCompare(b)).map(([file,owners])=>({path:file,owners})),limits:['Production receipts, scripts, Creator Pack and unsaved drafts are not fully resolved. No reference is not evidence of an orphan.']},warnings,jobState,cleanupApproved:false,reclaimableBytes:null};
}
