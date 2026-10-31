import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {startEditor,parseRange} from '../src/editor-server.mjs';import http from 'node:http';

test('media library modules retain session authentication and serve JavaScript',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'media-desk-http-'));await fs.mkdir(path.join(root,'web'));
 const modules=['artcraft.mjs','artcraft-model.mjs','style-library.mjs','style-library-model.mjs','style-art.mjs','media-library.mjs','media-library-model.mjs','content-recipes.mjs','recipe-picker.mjs','whiteboard-model.mjs','whiteboard-editor.mjs'];for(const name of ['index.html',...modules])await fs.writeFile(path.join(root,'web',name),'media-'+name);
 const server=await startEditor({root,port:0,voices:[{name:'Hải Đăng',aliases:[]}]});try{
  for(const name of modules)assert.equal((await fetch(server.url+'/'+name)).status,401);
  const page=await fetch(server.url+'/'),cookie=page.headers.get('set-cookie').split(';')[0];
  for(const name of modules){const response=await fetch(server.url+'/'+name,{headers:{cookie}});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);assert.equal(await response.text(),'media-'+name);}
 }finally{await server.close();}
});

test('content API authenticates, bounds inputs, protects revision and never mutates a project',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p75-http-'));await fs.mkdir(path.join(root,'web'));await fs.writeFile(path.join(root,'web/index.html'),'test');let launches=0;
 const server=await startEditor({root,port:0,voices:[{name:'Hải Đăng',aliases:[]}],contentOptions:{launch:async()=>{launches++;}}});
 try{
  assert.equal((await fetch(server.url+'/api/content-attempts?projectId=content-test')).status,401);
  const page=await fetch(server.url+'/'),cookie=page.headers.get('set-cookie').split(';')[0],boot=await(await fetch(server.url+'/api/bootstrap',{headers:{cookie}})).json(),headers={cookie,origin:server.url,'content-type':'application/json','x-studio-csrf':boot.csrf};
  const create=await(await fetch(server.url+'/api/projects',{method:'POST',headers,body:JSON.stringify({id:'content-test',template:'listicle',theme:'editorial',voice:'Hải Đăng'})})).json();
  const input={projectId:'content-test',expectedRevision:1,draftHash:'a'.repeat(64),contentBrief:{subject:'Kịch bản',audience:'',goal:'',sourceNotes:'',targetSeconds:30,structure:'explain'},sceneCount:3,model:'ag/claude-sonnet-4-6'};
  const post=(data,h=headers)=>fetch(server.url+'/api/content-attempts',{method:'POST',headers:h,body:JSON.stringify(data)});
  assert.equal((await post(input,{...headers,origin:'https://evil.test'})).status,403);assert.equal((await post(input,{...headers,'x-studio-csrf':'wrong'})).status,403);
  assert.equal((await post({...input,expectedRevision:2})).status,409);assert.equal((await post({...input,key:'DO_NOT_ACCEPT'})).status,400);assert.equal((await post({...input,contentBrief:{...input.contentBrief,sourceNotes:'x'.repeat(33000)}})).status,413);
  const response=await post(input);assert.equal(response.status,202);const attempt=await response.json();assert.equal(launches,1);assert.equal((await post(input)).status,409);
  assert.equal((await fetch(server.url+'/api/content-attempts/'+attempt.id+'?projectId=foreign',{headers:{cookie}})).status,400);
  const saved=await(await fetch(server.url+'/api/projects/content-test',{headers:{cookie}})).json();assert.deepEqual(saved,create);assert.equal((await fetch(server.url+'/api/content-media',{headers:{cookie}})).status,200);
 }finally{await server.close();}
});
test('cut workspace modules are served only inside an authenticated session',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'p6-http-'));await fs.mkdir(path.join(root,'web'));for(const name of ['index.html','p6.mjs','clip-tools.mjs'])await fs.writeFile(path.join(root,'web',name),'p6-'+name);const server=await startEditor({root,port:0,voices:[{name:'Hải Đăng',aliases:[]}]});try{for(const name of ['p6.mjs','clip-tools.mjs'])assert.equal((await fetch(server.url+'/'+name)).status,401);const r=await fetch(server.url+'/'),cookie=r.headers.get('set-cookie').split(';')[0];for(const name of ['p6.mjs','clip-tools.mjs']){const response=await fetch(server.url+'/'+name,{headers:{cookie}});assert.equal(response.status,200);assert.equal(await response.text(),'p6-'+name);}}finally{await server.close();}});
test('loopback API requires session, exact origin and CSRF, bounded JSON, CAS conflicts',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p2-http-'));await fs.mkdir(path.join(root,'web'));await fs.writeFile(path.join(root,'web/index.html'),'<h1>test</h1>');
 const server=await startEditor({root,port:0,voices:[{name:'Hải Đăng',aliases:[]}]});const base=server.url;
 try{
  assert.equal((await fetch(base+'/api/bootstrap')).status,401);
  const page=await fetch(base+'/');const cookie=page.headers.get('set-cookie').split(';')[0];
  const boot=await(await fetch(base+'/api/bootstrap',{headers:{cookie}})).json();const headers={cookie,origin:base,'content-type':'application/json','x-studio-csrf':boot.csrf};
  assert.equal((await fetch(base+'/api/projects',{method:'POST',headers:{...headers,origin:'https://evil.test'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/api/projects',{method:'POST',headers:{...headers,'x-studio-csrf':'wrong'},body:'{}'})).status,403);
  const create={template:'listicle',theme:'editorial',voice:'Hải Đăng',id:'test'};
  const result=await(await fetch(base+'/api/projects',{method:'POST',headers,body:JSON.stringify(create)})).json();assert.equal(result.revision,1);
  const save={expectedRevision:1,brief:result.brief};assert.equal((await fetch(base+'/api/projects/test',{method:'POST',headers,body:JSON.stringify(save)})).status,200);
  assert.equal((await fetch(base+'/api/projects/test',{method:'POST',headers,body:JSON.stringify(save)})).status,409);
  assert.equal((await fetch(base+'/api/projects',{method:'POST',headers,body:'x'.repeat(131073)})).status,413);
  assert.equal((await fetch(base+'/api/assets/upload',{method:'POST',headers:{'content-type':'application/octet-stream'},body:'x'})).status,401);
  assert.equal((await fetch(base+'/api/assets',{headers:{cookie}})).status,200);
  assert.equal((await fetch(base+'/api/batches',{headers:{cookie}})).status,200);
  assert.equal((await fetch(base+'/api/assets/upload',{method:'POST',headers,body:'{}'})).status,400);
  const uploadHeaders={...headers,'content-type':'application/octet-stream','x-asset-name':'fake.mp4','x-asset-rights':encodeURIComponent('Tôi tự tạo')};
  const badUpload=await fetch(base+'/api/assets/upload',{method:'POST',headers:uploadHeaders,body:'#EXTM3U\nhttp://evil.test/a.ts'});assert.equal(badUpload.status,400);assert.equal((await badUpload.json()).error,'UNSUPPORTED_MEDIA');
  const variants=[{format:'portrait',theme:'editorial'},{format:'portrait',theme:'editorial'}];
  const badBatch=await fetch(base+'/api/batches',{method:'POST',headers,body:JSON.stringify({projectId:'test',expectedRevision:2,variants})});assert.equal(badBatch.status,400);assert.equal((await badBatch.json()).error,'INVALID_VARIANTS');
  const denied=await new Promise((resolve,reject)=>{http.get(base+'/api/bootstrap',{headers:{cookie,host:'evil.test'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});assert.equal(denied,403);
  await fs.mkdir(path.join(root,'outputs/test'),{recursive:true});await fs.writeFile(path.join(root,'outputs/test/video.mp4'),'changed');
  server.jobs.records.set('job-test',{status:'VERIFIED',result:{artifacts:{video:{path:'outputs/test/video.mp4',sha256:'a'.repeat(64)}}}});
  assert.equal((await fetch(base+'/api/artifacts/job-test/video',{headers:{cookie}})).status,400);
 }finally{await server.close();}
});
test('single byte range validated, no multipart or out-of-bounds range',()=>{
 assert.deepEqual(parseRange('bytes=0-99',1000),{start:0,end:99});assert.deepEqual(parseRange('bytes=-10',1000),{start:990,end:999});
 for(const v of ['bytes=1000-','bytes=0-10,20-30','bytes=9-1'])assert.throws(()=>parseRange(v,1000),/INVALID_RANGE/);
});

test('translation unknown acknowledgement requires authenticated CSRF and explicit consent, preserves unknown provider outcome',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'dub-ack-http-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.mkdir(path.join(root,'web'));await fs.writeFile(path.join(root,'web/index.html'),'fixture');const id='job-ack',dir=path.join(root,'.runtime/studio/jobs',id);await fs.mkdir(dir,{recursive:true});const doc={id:'dub-11111111-1111-4111-8111-111111111111',sourceHash:'a'.repeat(64)},result={status:'UNKNOWN',action:'translate',documentId:doc.id,documentRevision:1,sourceHash:doc.sourceHash};await fs.writeFile(path.join(dir,'00000001.json'),JSON.stringify({id,revision:1,kind:'dubbing',status:'UNKNOWN',workerExited:true,request:{action:'translate',doc,revision:1}}));await fs.writeFile(path.join(dir,'process.log'),JSON.stringify(result));const server=await startEditor({root,port:0,voices:[{name:'A',aliases:[]}]});t.after(()=>server.close());const url=server.url+'/api/jobs/'+id+'/acknowledge-translation-unknown';assert.equal((await fetch(url,{method:'POST',body:'{}'})).status,401);const page=await fetch(server.url+'/'),cookie=page.headers.get('set-cookie').split(';')[0],boot=await(await fetch(server.url+'/api/bootstrap',{headers:{cookie}})).json(),headers={cookie,origin:server.url,'content-type':'application/json','x-studio-csrf':boot.csrf};assert.equal((await fetch(url,{method:'POST',headers:{...headers,'x-studio-csrf':'bad'},body:'{}'})).status,403);assert.equal((await fetch(url,{method:'POST',headers,body:'{}'})).status,400);const response=await fetch(url,{method:'POST',headers,body:JSON.stringify({acknowledgeUnknown:true})});assert.equal(response.status,200);const ack=await response.json();assert.equal(ack.status,'FAILED');assert.equal(ack.result.status,'UNKNOWN');assert.equal(ack.providerOutcome,'UNVERIFIED');
});
