import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {startEditor} from '../src/editor-server.mjs';
test('workbench API stays under session/CSRF and rejects stale/extra requests before job spawn',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'voice-api-'));await fs.mkdir(path.join(root,'web'));await fs.writeFile(path.join(root,'web/index.html'),'test');const server=await startEditor({root,port:0,voices:[{name:'Hải Đăng',aliases:[]}]});t.after(async()=>{await server.close();await fs.rm(root,{recursive:true,force:true});});
 assert.equal((await fetch(server.url+'/api/voice-workbench/preferences')).status,401);const page=await fetch(server.url+'/'),cookie=page.headers.get('set-cookie').split(';')[0],boot=await(await fetch(server.url+'/api/bootstrap',{headers:{cookie}})).json(),headers={cookie,origin:server.url,'x-studio-csrf':boot.csrf,'content-type':'application/json'};
 const pref=await fetch(server.url+'/api/voice-workbench/preferences',{headers:{cookie}});assert.equal(pref.status,200);assert.deepEqual(await pref.json(),{});
 assert.equal((await fetch(server.url+'/api/voice-workbench/preview',{method:'POST',headers:{...headers,'x-studio-csrf':'wrong'},body:'{}'})).status,403);
 const created=await(await fetch(server.url+'/api/projects',{method:'POST',headers,body:JSON.stringify({template:'story-short',theme:'editorial',voice:'Hải Đăng',id:'test'})})).json();
 const invalid=await fetch(server.url+'/api/voice-workbench/preview',{method:'POST',headers,body:JSON.stringify({projectId:'test',expectedRevision:0,brief:created.brief,sceneId:'opening',phraseId:'p0',extra:'bad'})});assert.equal(invalid.status,400);
 const stale=await fetch(server.url+'/api/voice-workbench/preview',{method:'POST',headers,body:JSON.stringify({projectId:'test',expectedRevision:0,brief:created.brief,sceneId:'opening',phraseId:'p0'})});assert.equal(stale.status,409);
});
