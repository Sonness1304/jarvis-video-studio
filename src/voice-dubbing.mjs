import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';import {atomicJson} from './editor-atomic.mjs';import {readLimited} from './editor-store.mjs';import {safeChild} from './core.mjs';import {validateDubbing} from '../web/dubbing-model.mjs';
export class DubbingStore{
 constructor(root){this.root=root;}
 dir(id){if(!/^dub-[a-f0-9-]{36}$/.test(id??''))throw Error('DUB_ID_INVALID');return safeChild(this.root,'.runtime/studio/dubbing/'+id);}
 async create(asset){const id='dub-'+randomUUID(),doc=validateDubbing({schemaVersion:2,speakers:[],background:{mode:'unselected'},id,sourceAssetId:asset.id,sourceHash:asset.sourceHash,duration:asset.duration,segments:[]});await fs.mkdir(this.dir(id),{recursive:true});return this.write({revision:1,doc});}
 async write(record){await atomicJson(this.root,path.join(this.dir(record.doc.id),String(record.revision).padStart(8,'0')+'.json'),record);return record;}
 async read(id){const dir=this.dir(id),name=(await fs.readdir(dir)).filter(n=>/^\d{8}\.json$/.test(n)).sort().at(-1);const p=JSON.parse(await readLimited(path.join(dir,name),2*1024*1024));validateDubbing(p.doc);return p;}
 async save(id,expectedRevision,doc){validateDubbing(doc);const current=await this.read(id);if(current.revision!==expectedRevision)throw Error('REVISION_CONFLICT');if(doc.id!==id||['sourceAssetId','sourceHash','duration'].some(k=>doc[k]!==current.doc[k]))throw Error('DUB_SOURCE_CHANGED');try{return await this.write({revision:current.revision+1,doc});}catch(e){if(e.code==='EEXIST')throw Error('REVISION_CONFLICT');throw e;}}
 async list(){const dir=safeChild(this.root,'.runtime/studio/dubbing');await fs.mkdir(dir,{recursive:true});return Promise.all((await fs.readdir(dir)).filter(n=>/^dub-[a-f0-9-]{36}$/.test(n)).map(id=>this.read(id)));}
}
