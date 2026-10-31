import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {startEditor} from '../src/editor-server.mjs';
test('AI endpoints preserve authentication, project revision and scene ownership',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p7-http-'));await fs.mkdir(path.join(root,'web'));for(const name of ['index.html','p7.mjs','image-request.mjs'])await fs.writeFile(path.join(root,'web',name),'test-'+name);
 const s=await startEditor({root,port:0,voices:[{name:'Hải Đăng',aliases:[]}]});try{
 for(const route of ['/api/ai/status','/p7.mjs','/image-request.mjs'])assert.equal((await fetch(s.url+route)).status,401);
 const page=await fetch(s.url+'/'),cookie=page.headers.get('set-cookie').split(';')[0],boot=await(await fetch(s.url+'/api/bootstrap',{headers:{cookie}})).json();const h={cookie,origin:s.url,'content-type':'application/json','x-studio-csrf':boot.csrf};
 assert.equal((await fetch(s.url+'/p7.mjs',{headers:{cookie}})).status,200);
 const p=await(await fetch(s.url+'/api/projects',{method:'POST',headers:h,body:JSON.stringify({id:'p7',template:'listicle',theme:'editorial',voice:'Hải Đăng'})})).json();
 let calls=0;s.jobs.start=async(kind,data)=>{calls++;return {kind,...data,status:'RUNNING'};};const input={kind:'image',projectId:'p7',expectedRevision:p.revision,sceneId:p.brief.scenes[0].id,request:{prompt:'robot',style:'line',seed:42}};
 const send=(v,headers=h)=>fetch(s.url+'/api/jobs',{method:'POST',headers,body:JSON.stringify(v)});
 assert.equal((await send(input,{...h,'x-studio-csrf':'bad'})).status,403);
 assert.equal((await send({...input,expectedRevision:0})).status,409);assert.equal((await send({...input,sceneId:'foreign'})).status,400);assert.equal((await send({...input,request:{...input.request,command:'anything'}})).status,400);assert.equal(calls,0);
 const ok=await send(input);assert.equal(ok.status,202);const r=await ok.json();assert.equal(r.imageRequest.seed,42);assert.equal(r.sceneId,input.sceneId);assert.equal(calls,1);
 }finally{await s.close();}
});
