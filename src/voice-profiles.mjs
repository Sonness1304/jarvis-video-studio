import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {safeChild} from './core.mjs';import {hashFile} from './runtime.mjs';import {atomicJson} from './editor-atomic.mjs';import {readLimited} from './editor-store.mjs';
export function validateProfileInput(v){
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['name','rights','transcript','duration'].includes(k))||[['name',80],['rights',1000],['transcript',240]].some(([k,n])=>typeof v[k]!=='string'||!v[k].trim()||v[k].length>n||/[\x00-\x1f]/.test(v[k]))||!Number.isFinite(v.duration)||v.duration<3||v.duration>8)throw Error('PROFILE_INPUT_INVALID');return v;
}
export class VoiceProfiles{
 constructor(root){this.root=root;}
 dir(id){if(!/^profile-[a-f0-9-]{36}$/.test(id??''))throw Error('PROFILE_ID_INVALID');return safeChild(this.root,'.runtime/studio/voice-profiles/'+id);}
 async create(input,normalized){
  validateProfileInput(input);if(!Buffer.isBuffer(normalized)||!normalized.length||normalized.length>64*1024**2)throw Error('PROFILE_AUDIO_INVALID');
  const id='profile-'+randomUUID(),dir=this.dir(id);await fs.mkdir(dir,{recursive:true});const reference={path:'.runtime/studio/voice-profiles/'+id+'/reference.wav'};await fs.writeFile(safeChild(this.root,reference.path),normalized,{flag:'wx'});reference.sha256=await hashFile(safeChild(this.root,reference.path));
  const record={schemaVersion:1,id,revision:1,...input,sourceHash:reference.sha256,reference,archived:false,consentedAt:new Date().toISOString(),engine:'vieneu',modelRevision:'61b85e3d937fbbacb387714180e8182823512523'};await atomicJson(this.root,path.join(dir,'00000001.json'),record);return record;
 }
 async read(id,revision){
  const dir=this.dir(id);let name;if(revision!==undefined){if(!Number.isSafeInteger(revision)||revision<1||revision>99999999)throw Error('PROFILE_REVISION_INVALID');name=String(revision).padStart(8,'0')+'.json';}else name=(await fs.readdir(dir)).filter(n=>/^\d{8}\.json$/.test(n)).sort().at(-1);
  const r=JSON.parse(await readLimited(safeChild(this.root,path.relative(this.root,path.join(dir,name)))));if(r.id!==id||r.reference?.path!=='.runtime/studio/voice-profiles/'+id+'/reference.wav'||await hashFile(safeChild(this.root,r.reference.path))!==r.reference.sha256)throw Error('PROFILE_AUDIO_CHANGED');return r;
 }
 async archive(id,revision){const p=await this.read(id);if(p.revision!==revision)throw Error('REVISION_CONFLICT');const next={...p,revision:p.revision+1,archived:true};try{await atomicJson(this.root,path.join(this.dir(id),String(next.revision).padStart(8,'0')+'.json'),next);}catch(e){if(e.code==='EEXIST')throw Error('REVISION_CONFLICT');throw e;}return next;}
 async list(){const dir=safeChild(this.root,'.runtime/studio/voice-profiles');await fs.mkdir(dir,{recursive:true});return Promise.all((await fs.readdir(dir)).filter(n=>/^profile-[a-f0-9-]{36}$/.test(n)).map(id=>this.read(id)));}
}
