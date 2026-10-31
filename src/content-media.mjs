import fs from 'node:fs/promises';
import {safeChild} from './core.mjs';import {listAssets} from './assets.mjs';import {hashFile} from './runtime.mjs';import {readLimited} from './editor-store.mjs';
// Only registered assets and sealed AI image receipts are selectable. Rehash at resolve.
export async function listContentMedia(root){
 const out=[];
 for(const asset of await listAssets(root)){
  if(!['image','video'].includes(asset.kind)||await hashFile(safeChild(root,asset.path))!==asset.sha256)continue;
  const media={kind:asset.kind,path:asset.path,sha256:asset.sha256,fit:'cover'};
  if(asset.kind==='video'){media.start=0;media.end=Math.min(60,asset.duration);}
  out.push({id:asset.id,name:asset.name,media,url:'/api/assets/'+asset.id+'/'+(asset.kind==='video'?'poster':'file')});
 }
 const names=(await fs.readdir(safeChild(root,'outputs')).catch(()=>[])).filter(n=>/^jarvis-[a-f0-9-]+$/.test(n)).slice(-200);
 for(const name of names){try{
  const r=JSON.parse(await readLimited(safeChild(root,'outputs/'+name+'/receipt.json'))),image=r.image;
  if(r.status!=='VERIFIED'||image?.path!=='outputs/'+name+'/image.png'||!/^[a-f0-9]{64}$/.test(image.sha256??'')||await hashFile(safeChild(root,image.path))!==image.sha256)continue;
  out.push({id:name,name:'Ảnh AI · '+name.slice(-8),media:{kind:'image',path:image.path,sha256:image.sha256,fit:'cover'},url:'/api/images/'+name});
 }catch{}}
 return out;
}
