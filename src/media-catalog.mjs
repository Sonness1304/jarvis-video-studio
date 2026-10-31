import fs from 'node:fs/promises';import path from 'node:path';import sharp from 'sharp';
import {safeChild} from './core.mjs';import {readLimited} from './editor-store.mjs';import {readAsset} from './assets.mjs';import {atomicJson} from './editor-atomic.mjs';
const aiId=/^jarvis-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function mediaId(id){if(typeof id!=='string'||!(/^asset-[a-z0-9-]{1,48}$/.test(id)||aiId.test(id)))throw Error('INVALID_MEDIA_ID');return id;}
function labels(v){if(!v||Array.isArray(v)||Object.keys(v).some(k=>!['expectedRevision','group','tags'].includes(k))||!Number.isSafeInteger(v.expectedRevision)||v.expectedRevision<0||v.expectedRevision>=99999999||typeof v.group!=='string'||!Array.isArray(v.tags)||v.tags.length>10)throw Error('INVALID_MEDIA_LABELS');
 const clean=(s,max,empty=false)=>{if(typeof s!=='string'||/[\x00-\x1f\x7f/\\]/.test(s))throw Error('INVALID_MEDIA_LABELS');const text=s.trim().normalize('NFC');if(text.length>max||!empty&&!text)throw Error('INVALID_MEDIA_LABELS');return text;};
 const group=clean(v.group,40,true),tags=v.tags.map(t=>clean(t,24));if(tags.some(t=>t.includes(','))||new Set(tags.map(t=>t.toLocaleLowerCase('vi'))).size!==tags.length)throw Error('INVALID_MEDIA_LABELS');return {group,tags};}
export class MediaLabels{
 constructor(root){this.root=root;}
 dir(id){return safeChild(this.root,'.runtime/studio/media-labels/'+mediaId(id));}
 async read(id){const dir=this.dir(id);let names;try{names=(await fs.readdir(dir)).filter(n=>/^\d{8}\.json$/.test(n)).sort();}catch(e){if(e.code==='ENOENT')return {revision:0,group:'',tags:[]};throw e;}if(!names.length)return {revision:0,group:'',tags:[]};
  try{const r=JSON.parse(await readLimited(safeChild(this.root,path.relative(this.root,path.join(dir,names.at(-1))))));if(!Number.isSafeInteger(r.revision)||String(r.revision).padStart(8,'0')+'.json'!==names.at(-1)||Object.keys(r).some(k=>!['revision','group','tags'].includes(k)))throw Error();const value=labels({expectedRevision:r.revision,group:r.group,tags:r.tags});return {revision:r.revision,...value};}catch{throw Error('MEDIA_LABELS_CORRUPT');}}
 async save(id,input){mediaId(id);const value=labels(input),current=await this.read(id);if(current.revision!==input.expectedRevision)throw Error('REVISION_CONFLICT');const revision=current.revision+1,dir=this.dir(id);await fs.mkdir(dir,{recursive:true});try{return await atomicJson(this.root,path.join(dir,String(revision).padStart(8,'0')+'.json'),{revision,...value});}catch(e){if(e.code==='EEXIST')throw Error('REVISION_CONFLICT');throw e;}}
}
export async function readCatalogItem(root,id){mediaId(id);if(id.startsWith('asset-')){const a=await readAsset(root,id);if(!/^[a-f0-9]{64}$/.test(a.sha256??'')||!Number.isSafeInteger(a.bytes)||a.bytes<0||typeof a.name!=='string'||a.name.length>128)throw Error('MEDIA_MANIFEST_INVALID');return {...a,origin:'asset'};}
 const r=JSON.parse(await readLimited(safeChild(root,'outputs/'+id+'/receipt.json'),32768)),im=r.image;
 if(r.status!=='VERIFIED'||im?.path!=='outputs/'+id+'/image.png'||!/^[a-f0-9]{64}$/.test(im.sha256??''))throw Error('MEDIA_MANIFEST_INVALID');
 const file=safeChild(root,im.path),stat=await fs.stat(file);if(!stat.isFile()||stat.size>16*1024**2)throw Error('MEDIA_MANIFEST_INVALID');const meta=await sharp(file,{limitInputPixels:4*1024**2}).metadata();if(meta.format!=='png')throw Error('MEDIA_MANIFEST_INVALID');
 return {id,name:'Ảnh AI '+id.slice(-8),kind:'image',origin:'ai',path:im.path,sha256:im.sha256,bytes:stat.size,width:meta.width,height:meta.height,createdAt:new Date(Number.isFinite(r.startedAtMs)?r.startedAtMs:stat.mtimeMs).toISOString(),rights:'Ảnh tạo local; xem giấy phép model nguồn. Không có xác nhận quyền thương mại tự động.'};
}
export async function listMediaCatalog(root){
 const dir=safeChild(root,'.runtime/studio/assets');const assetNames=(await fs.readdir(dir).catch(e=>{if(e.code==='ENOENT')return [];throw e;})).filter(n=>/^asset-[a-z0-9-]+\.json$/.test(n)),aiNames=(await fs.readdir(safeChild(root,'outputs')).catch(e=>{if(e.code==='ENOENT')return [];throw e;})).filter(n=>aiId.test(n));
 if(assetNames.length+aiNames.length>10000)throw Error('CATALOG_LIMIT');const items=[],labelStore=new MediaLabels(root);let skipped=0;
 for(const id of [...assetNames.map(n=>n.slice(0,-5)),...aiNames]){let item;try{item=await readCatalogItem(root,id);}catch(e){if(id.startsWith('asset-'))throw e;skipped++;continue;}
  const entry=await labelStore.read(id);items.push({...item,group:entry.group,tags:entry.tags,labelRevision:entry.revision});}
 return {items,skipped};
}
