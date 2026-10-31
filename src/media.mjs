import fs from 'node:fs/promises';import sharp from 'sharp';import {createHash} from 'node:crypto';import {safeChild} from './core.mjs';
import {hashFile} from './runtime.mjs';import {readAsset} from './assets.mjs';
export async function readMedia(root,brief,{prepared=false}={}){
 const assets=[];
 for(const [index,s] of brief.scenes.entries()){
  if(s.visual!=='media')continue;
  if(s.media.kind==='video'){
   const file=safeChild(root,s.media.path);if(!prepared){const id=s.media.path.split('/')[1],a=await readAsset(root,id);if(a.kind!=='video'||a.path!==s.media.path||a.sha256!==s.media.sha256||s.media.end>a.duration+.001)throw Error('VIDEO_ASSET_CHANGED');}
   if((await fs.stat(file)).size>64*1024**2||await hashFile(file)!==s.media.sha256)throw Error('MEDIA_HASH_CHANGED');assets.push({name:'media-'+index+'.mp4',file,sha256:s.media.sha256});continue;
  }
  const file=safeChild(root,s.media.path);if((await fs.stat(file)).size>16*1024**2)throw Error('MEDIA_OVERSIZE');
  const payload=await fs.readFile(file);if(createHash('sha256').update(payload).digest('hex')!==s.media.sha256)throw Error('MEDIA_HASH_CHANGED');
  const {info}=await sharp(payload,{limitInputPixels:4*1024**2}).raw().toBuffer({resolveWithObject:true});
  const meta=await sharp(payload).metadata();if(meta.format!=='png'||info.width<256||info.height<256||info.width>2048||info.height>2048)throw Error('MEDIA_IMAGE_CONTRACT_FAILED');
  assets.push({name:'media-'+index+'.png',payload,width:info.width,height:info.height});
 }
 return assets;
}
