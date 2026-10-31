import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {safeChild} from './core.mjs';import {hashFile} from './runtime.mjs';
const MAX_FILES=256,MAX_BYTES=1024**3,MAX_MANIFEST=1024**2,RESERVE=2*1024**3;
const sha=data=>createHash('sha256').update(data).digest('hex');
export function bundlePath(value){if(typeof value!=='string'||value.length>240||value.includes('\\')||value.includes(':')||value.startsWith('/')||value.split('/').some(p=>!p||p==='.'||p==='..'||/[\x00-\x1f<>"|?*]/.test(p)||/[. ]$/.test(p)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw Error('BUNDLE_PATH_INVALID');return value;}
function identity(id){if(typeof id!=='string'||!/^[a-z][a-z0-9-]{0,79}$/.test(id))throw Error('BUNDLE_ID_INVALID');return id;}
function rows(files,sealed=false){if(!Array.isArray(files)||!files.length||files.length>MAX_FILES)throw Error('BUNDLE_LIMIT');const seen=new Set();let total=0;
 for(const f of files){if(!f||typeof f!=='object'||Array.isArray(f))throw Error('BUNDLE_MANIFEST_INVALID');bundlePath(f.path);const key=f.path.normalize('NFC').toLowerCase();if(seen.has(key))throw Error('BUNDLE_PATH_COLLISION');seen.add(key);if(typeof f.role!=='string'||!/^[a-z-]{1,32}$/.test(f.role))throw Error('BUNDLE_MANIFEST_INVALID');
  if(sealed){if(!Number.isSafeInteger(f.bytes)||f.bytes<0||!/^[a-f0-9]{64}$/.test(f.sha256??''))throw Error('BUNDLE_MANIFEST_INVALID');total+=f.bytes;if(total>MAX_BYTES)throw Error('BUNDLE_LIMIT');}}
 return total;
}
async function room(root,bytes){const s=await fs.statfs(root);if(Number(s.bavail)*Number(s.bsize)<bytes+RESERVE)throw Error('BUNDLE_DISK_SPACE');}
async function bounded(file,max){const h=await fs.open(file,'r');try{const st=await h.stat();if(!st.isFile()||st.size>max)throw Error('BUNDLE_MANIFEST_INVALID');const buffer=Buffer.alloc(max+1);let n=0;while(n<buffer.length){const r=await h.read(buffer,n,buffer.length-n,n);if(!r.bytesRead)break;n+=r.bytesRead;}if(n>max)throw Error('BUNDLE_MANIFEST_INVALID');return buffer.subarray(0,n);}finally{await h.close();}}
async function createDir(root,relative){await fs.mkdir(safeChild(root,path.posix.dirname(relative)),{recursive:true});await fs.mkdir(safeChild(root,relative));return safeChild(root,relative);}
export async function copyBundleFile(root,source,destRoot,destRelative,expected){
 const src=safeChild(root,source),before=await fs.lstat(src);if(!before.isFile()||before.size!==expected.bytes)throw Error('BUNDLE_SOURCE_CHANGED');
 await fs.mkdir(safeChild(destRoot,path.posix.dirname(destRelative)),{recursive:true});const dst=safeChild(destRoot,destRelative);let input,output;const h=createHash('sha256');let bytes=0;
 try{input=await fs.open(src,'r');const opened=await input.stat();if(!opened.isFile()||opened.ino!==before.ino||opened.size!==before.size)throw Error('BUNDLE_SOURCE_CHANGED');output=await fs.open(dst,'wx');const buffer=Buffer.alloc(65536);
  for(;;){const r=await input.read(buffer,0,buffer.length,bytes);if(!r.bytesRead)break;const chunk=buffer.subarray(0,r.bytesRead);bytes+=r.bytesRead;if(bytes>expected.bytes||bytes>MAX_BYTES)throw Error('BUNDLE_SOURCE_CHANGED');h.update(chunk);let at=0;while(at<chunk.length){const w=await output.write(chunk,at,chunk.length-at);if(!w.bytesWritten)throw Error('BUNDLE_WRITE_FAILED');at+=w.bytesWritten;}}
  await output.sync();const after=await input.stat();if(bytes!==expected.bytes||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)throw Error('BUNDLE_SOURCE_CHANGED');
 }finally{await output?.close();await input?.close();}
 const copied=h.digest('hex');if(expected.sha256&&expected.sha256!==copied)throw Error('BUNDLE_HASH_MISMATCH');if(await hashFile(safeChild(root,source))!==copied||await hashFile(safeChild(destRoot,destRelative))!==copied)throw Error('BUNDLE_SOURCE_CHANGED');return copied;
}
async function partial(dir,error){await fs.writeFile(path.join(dir,'PARTIAL.json'),JSON.stringify({status:'PARTIAL',error:error.message,at:new Date().toISOString()}),{flag:'wx'}).catch(()=>{});}
export async function exportBundle(root,{id,files,metadata={}}){identity(id);rows(files);const prepared=[];let total=0;
 for(const f of files){if(!/^(?:outputs\/|recipes\/|docs\/research\/|\.tools\/fonts\/)/.test(f.path)&&!['runtime-config.json','package-lock.json'].includes(f.path))throw Error('BUNDLE_SOURCE_SCOPE');const st=await fs.lstat(safeChild(root,f.path));if(!st.isFile())throw Error('BUNDLE_SOURCE_CHANGED');total+=st.size;if(total>MAX_BYTES)throw Error('BUNDLE_LIMIT');prepared.push({path:f.path,role:f.role,bytes:st.size});}
 if(Buffer.byteLength(JSON.stringify({files:prepared,metadata}))>MAX_MANIFEST-30000)throw Error('BUNDLE_LIMIT');await room(root,total);
 const relative='.runtime/bundles/'+id,dir=await createDir(root,relative);
 try{for(const f of prepared)f.sha256=await copyBundleFile(root,f.path,root,relative+'/payload/'+f.path,f);
  const manifest={schemaVersion:1,id,createdAt:new Date().toISOString(),totalBytes:total,metadata,files:prepared};const data=JSON.stringify(manifest,null,2)+'\n';if(Buffer.byteLength(data)>MAX_MANIFEST)throw Error('BUNDLE_LIMIT');
  await fs.writeFile(safeChild(root,relative+'/manifest.json'),data,{flag:'wx'});const manifestHash=sha(data);await fs.writeFile(safeChild(root,relative+'/READY.json'),JSON.stringify({status:'READY',manifestHash}),{flag:'wx'});return {status:'VERIFIED',id,path:relative,manifestHash,files:prepared.length,bytes:total,reproductionStatus:'UNVERIFIED'};
 }catch(e){await partial(dir,e);throw e;}
}
export async function verifyBundle(root,id){identity(id);const relative='.runtime/bundles/'+id;const ready=JSON.parse((await bounded(safeChild(root,relative+'/READY.json'),4096)).toString('utf8'));const data=await bounded(safeChild(root,relative+'/manifest.json'),MAX_MANIFEST),manifestHash=sha(data);if(ready.status!=='READY'||ready.manifestHash!==manifestHash)throw Error('BUNDLE_HASH_MISMATCH');let manifest;try{manifest=JSON.parse(data.toString('utf8'));}catch{throw Error('BUNDLE_MANIFEST_INVALID');}
 if(!manifest||manifest.schemaVersion!==1||manifest.id!==id)throw Error('BUNDLE_MANIFEST_INVALID');const total=rows(manifest.files,true);if(total!==manifest.totalBytes)throw Error('BUNDLE_MANIFEST_INVALID');
 for(const f of manifest.files){const file=safeChild(root,relative+'/payload/'+f.path),st=await fs.lstat(file);if(!st.isFile()||st.size!==f.bytes||await hashFile(file)!==f.sha256)throw Error('BUNDLE_HASH_MISMATCH');}
 return {status:'VERIFIED',id,path:relative,manifestHash,files:manifest.files.length,bytes:total,manifest,reproductionStatus:'UNVERIFIED'};
}
export async function restoreBundle(root,id){const checked=await verifyBundle(root,id);await room(root,checked.bytes);const relative='.runtime/restored/'+id,dir=await createDir(root,relative);
 try{for(const f of checked.manifest.files)await copyBundleFile(root,checked.path+'/payload/'+f.path,root,relative+'/'+f.path,f);await fs.writeFile(safeChild(root,relative+'/RESTORED.json'),JSON.stringify({status:'VERIFIED',id,manifestHash:checked.manifestHash}),{flag:'wx'});return {status:'VERIFIED',id,path:relative,manifestHash:checked.manifestHash,files:checked.files,bytes:checked.bytes,reproductionStatus:'UNVERIFIED'};
 }catch(e){await partial(dir,e);throw e;}
}
