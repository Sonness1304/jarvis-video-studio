import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {ProjectStore} from '../src/editor-store.mjs';import {atomicJson} from '../src/editor-atomic.mjs';import {newBrief} from '../src/studio.mjs';import * as model from '../web/model.mjs';
async function scratch(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'video-stability-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}
const brief=id=>newBrief({template:'listicle',theme:'editorial',voice:'Hải Đăng',id},[{name:'Hải Đăng',aliases:[]}]);
test('all projects beyond 200 stay discoverable with newest first and deterministic ties',async t=>{
 const root=await scratch(t),s=new ProjectStore(root),base=path.join(root,'.runtime/studio/projects');await fs.mkdir(base,{recursive:true});
 for(let i=0;i<202;i++){const id='p'+String(i).padStart(4,'0'),dir=path.join(base,id);await fs.mkdir(dir);await fs.writeFile(path.join(dir,'00000001.json'),JSON.stringify({revision:1,brief:brief(id),updatedAt:new Date(Date.UTC(2026,0,1)+Math.min(i,200)*1000).toISOString()}));}
 const corrupt=path.join(base,'broken');await fs.mkdir(corrupt);await fs.writeFile(path.join(corrupt,'00000001.json'),'{');
 const list=await s.list();assert.equal(list.length,203);assert.deepEqual(list.slice(0,2).map(p=>p.id),['p0200','p0201']);assert.equal(list.at(-1).error,'PROJECT_REVISION_CORRUPT');assert.equal((await s.read('p0201')).revision,1);
});
test('project paging searches the complete catalog before slicing and clamps empty or stale pages',()=>{
 const records=Array.from({length:201},(_,i)=>({id:'p'+i,title:i===200?'Đường mới':'Dự án '+i}));assert.equal(typeof model.projectPage,'function');
 const first=model.projectPage(records,{page:1});assert.equal(first.items.length,24);assert.equal(first.pages,9);assert.equal(first.total,201);
 assert.equal(model.projectPage(records,{page:9}).items.length,9);assert.equal(model.projectPage(records,{page:999}).page,9);
 const found=model.projectPage(records,{query:'duong',page:9});assert.deepEqual(found.items,[records[200]]);assert.equal(found.page,1);
 const empty=model.projectPage(records,{query:'none',page:9});assert.equal(empty.items.length,0);assert.equal(empty.page,1);assert.equal(empty.pages,1);assert.equal(records.length,201);
});
test('atomic publish conflicts remove only their own pending file and preserve the published record',async t=>{
 const root=await scratch(t),target=path.join(root,'record.json'),foreign=path.join(root,'.pending-foreign');await fs.writeFile(foreign,'owned elsewhere');
 await atomicJson(root,target,{revision:1});await assert.rejects(atomicJson(root,target,{revision:2}),{code:'EEXIST'});
 assert.deepEqual((await fs.readdir(root)).sort(),['.pending-foreign','record.json']);assert.deepEqual(JSON.parse(await fs.readFile(target)),{revision:1});
});
for(const operation of ['writeFile','sync','link'])test('atomic '+operation+' failure cleans its pending and keeps original error',async t=>{
 const root=await scratch(t),target=path.join(root,'record.json'),expected=Object.assign(Error('SENTINEL_'+operation),{code:operation==='writeFile'?'ENOSPC':'EIO'}),open=fs.open;
 if(operation==='link')t.mock.method(fs,'link',async()=>{throw expected;});
 else t.mock.method(fs,'open',async(...args)=>{const h=await open(...args);h[operation]=async()=>{throw expected;};return h;});
 await assert.rejects(atomicJson(root,target,{revision:1}),e=>e===expected);assert.deepEqual(await fs.readdir(root),[]);
});
test('cleanup failure never masks the original publish error',async t=>{
 const root=await scratch(t),target=path.join(root,'record.json');await atomicJson(root,target,{revision:1});
 t.mock.method(fs,'unlink',async()=>{throw Object.assign(Error('cleanup denied'),{code:'EACCES'});});
 await assert.rejects(atomicJson(root,target,{revision:2}),{code:'EEXIST'});assert.deepEqual(JSON.parse(await fs.readFile(target)),{revision:1});
});
test('write plus close failure preserves the write error and still attempts owned cleanup',async t=>{
 const root=await scratch(t),target=path.join(root,'record.json'),open=fs.open,writeError=Object.assign(Error('write full'),{code:'ENOSPC'});let closeCalled=false;
 t.mock.method(fs,'open',async(...args)=>{const handle=await open(...args),close=handle.close.bind(handle);handle.writeFile=async()=>{throw writeError;};handle.close=async()=>{closeCalled=true;await close();throw Object.assign(Error('close failed'),{code:'EIO'});};return handle;});
 await assert.rejects(atomicJson(root,target,{revision:1}),e=>e===writeError);assert.equal(closeCalled,true);assert.deepEqual(await fs.readdir(root),[]);
});
test('sharp is a direct pinned dependency matching the runtime lock hash',async()=>{
 const {createHash}=await import('node:crypto'),pkg=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url))),raw=await fs.readFile(new URL('../package-lock.json',import.meta.url)),lock=JSON.parse(raw),config=JSON.parse(await fs.readFile(new URL('../runtime-config.json',import.meta.url)));
 assert.equal(pkg.dependencies.sharp,'0.35.5');assert.equal(lock.packages[''].dependencies.sharp,pkg.dependencies.sharp);assert.equal(lock.packages['node_modules/sharp'].version,pkg.dependencies.sharp);assert.equal(config.hashes.packageLock,createHash('sha256').update(raw).digest('hex'));
});
