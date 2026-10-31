import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {safeChild,validateBrief} from './core.mjs';
import {atomicJson} from './editor-atomic.mjs';
import {validatePhraseOverrides} from '../web/captions.mjs';
export const requireId=id=>{if(typeof id!=='string'||!/^[a-z][a-z0-9_-]{0,47}$/.test(id))throw Error('INVALID_PROJECT_ID');return id;};
const keys=(v,allowed,code)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw Error(code);};
export function canonicalBrief(value){
 const b=structuredClone(value);keys(b,['schemaVersion','id','title','preset','template','theme','voice','accent','scenes','format','transition','branding','captions','music','contentBrief','voiceWorkbench'],'UNKNOWN_BRIEF_FIELD');validateBrief(b);
 for(const s of b.scenes){keys(s,['id','title','visual','hold','content','media','phrases','shots','role','lab','board'],'UNKNOWN_SCENE_FIELD');for(const p of s.phrases){keys(p,['id','text','speechText','caption'],'UNKNOWN_PHRASE_FIELD');Object.assign(p,validatePhraseOverrides(p));}
  if(s.media)keys(s.media,['kind','path','sha256','start','end','fit','motion'],'UNKNOWN_MEDIA_FIELD');}
 return b;
}
export const briefHash=b=>createHash('sha256').update(JSON.stringify(canonicalBrief(b))).digest('hex');
export async function readLimited(file,max=131072){const st=await fs.stat(file);if(!st.isFile()||st.size>max)throw Error('FILE_TOO_LARGE');return fs.readFile(file,'utf8');}
export class ProjectStore{
 constructor(root){this.root=root;}
 dir(id){return safeChild(this.root,'.runtime/studio/projects/'+requireId(id));}
 async create(value){const brief=canonicalBrief(value),dir=this.dir(brief.id);await fs.mkdir(path.dirname(dir),{recursive:true});
  try{await fs.mkdir(dir);}catch(e){if(e.code==='EEXIST')throw Error('PROJECT_EXISTS');throw e;}
  return this.write(dir,{revision:1,brief,updatedAt:new Date().toISOString()});
 }
 async write(dir,record){return atomicJson(this.root,path.join(dir,String(record.revision).padStart(8,'0')+'.json'),record);}
 async read(id){const dir=this.dir(id),names=(await fs.readdir(dir)).filter(n=>/^\d{8}\.json$/.test(n)).sort();if(!names.length)throw Error('PROJECT_NOT_FOUND');
  let record;try{record=JSON.parse(await readLimited(safeChild(this.root,path.relative(this.root,path.join(dir,names.at(-1))))));canonicalBrief(record.brief);}catch(e){if(e instanceof SyntaxError)throw Error('PROJECT_REVISION_CORRUPT');throw e;}return record;
 }
 async save(id,expectedRevision,value){if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1||expectedRevision>=99999999)throw Error('INVALID_REVISION');
  const brief=canonicalBrief(value);if(brief.id!==requireId(id))throw Error('PROJECT_ID_CHANGED');
  const current=await this.read(id);if(current.revision!==expectedRevision)throw Error('REVISION_CONFLICT');
  try{return await this.write(this.dir(id),{revision:expectedRevision+1,brief,updatedAt:new Date().toISOString()});}catch(e){if(e.code==='EEXIST')throw Error('REVISION_CONFLICT');throw e;}
 }
 async list(){const dir=safeChild(this.root,'.runtime/studio/projects');await fs.mkdir(dir,{recursive:true});const out=[];
  for(const name of (await fs.readdir(dir)).filter(n=>/^[a-z][a-z0-9_-]{0,47}$/.test(n))){try{const r=await this.read(name);out.push({id:r.brief.id,title:r.brief.title,revision:r.revision,template:r.brief.template,theme:r.brief.theme,voice:r.brief.voice,updatedAt:r.updatedAt});}catch(e){if(e.message==='PROJECT_REVISION_CORRUPT'){out.push({id:name,title:'Dự án cần phục hồi',error:e.message,updatedAt:''});}else if(!['PROJECT_NOT_FOUND','ENOENT'].includes(e.message)&&e.code!=='ENOENT')throw e;}}
  return out.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
 }
}
