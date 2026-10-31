import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {ProjectStore,canonicalBrief} from '../src/editor-store.mjs';import {newBrief} from '../src/studio.mjs';
const brief=()=>newBrief({template:'listicle',theme:'editorial',voice:'Hải Đăng',id:'test'},[{name:'Hải Đăng',aliases:[]}]);
test('project revisions survive restart and concurrent CAS never silently overwrites',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p2-store-')),s=new ProjectStore(root);const b=brief();await s.create(b);
 const writes=await Promise.allSettled([s.save('test',1,{...b,title:'A'}),s.save('test',1,{...b,title:'B'})]);
 assert.equal(writes.filter(r=>r.status==='fulfilled').length,1);assert.match(writes.find(r=>r.status==='rejected').reason.message,/REVISION_CONFLICT/);
 const restarted=new ProjectStore(root);assert.equal((await restarted.read('test')).revision,2);assert.equal((await restarted.list()).length,1);
 await assert.rejects(s.save('test',1,b),/REVISION_CONFLICT/);await assert.rejects(s.read('../escape'),/INVALID_PROJECT_ID/);
 await assert.rejects(s.create(b),/PROJECT_EXISTS/);
});
test('interrupted JSON write does not publish a partial latest revision',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p2-atomic-')),store=new ProjectStore(root),b=brief();await store.create(b);
 const writeFile=fs.writeFile,open=fs.open;
 fs.writeFile=async(file,data,opts)=>{if(String(file).endsWith('00000002.json')){await writeFile(file,'{',opts);throw Object.assign(Error('ENOSPC'),{code:'ENOSPC'});}return writeFile(file,data,opts);};
 fs.open=async(...args)=>{const handle=await open(...args);if(String(args[0]).includes('.pending-')){const write=handle.writeFile.bind(handle);handle.writeFile=async()=>{await write('{');throw Object.assign(Error('ENOSPC'),{code:'ENOSPC'});};}return handle;};
 try{await assert.rejects(store.save('test',1,{...b,title:'partial'}),/ENOSPC/);}finally{fs.writeFile=writeFile;fs.open=open;}
 assert.equal((await new ProjectStore(root).read('test')).revision,1);
});
test('input rejects unknown executable fields and keeps narration data',()=>{
 assert.throws(()=>canonicalBrief({...brief(),command:'rm'}),/UNKNOWN_BRIEF_FIELD/);
 const b=brief();b.scenes[0].phrases[0].text='</script> & lệnh chỉ là chữ';assert.equal(canonicalBrief(b).scenes[0].phrases[0].text,b.scenes[0].phrases[0].text);
});

test('content metadata survives revisions without changing legacy timing fields',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p75-store-')),store=new ProjectStore(root),b=brief();await store.create(b);
 b.contentBrief={subject:'Chủ đề',audience:'',goal:'',targetSeconds:45,structure:'story',sourceNotes:''};b.scenes[0].role='hook';
 await store.save('test',1,b);const saved=await new ProjectStore(root).read('test');assert.deepEqual(saved.brief,b);
 assert.throws(()=>canonicalBrief({...b,contentBrief:{...b.contentBrief,tool:'run'}}),/INVALID_CONTENT_BRIEF/);
});
