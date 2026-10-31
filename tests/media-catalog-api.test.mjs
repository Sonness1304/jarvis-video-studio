import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';import sharp from 'sharp';import {startEditor} from '../src/editor-server.mjs';
test('catalog labels require session/origin/CSRF, preserve CAS, AI file works without legacy list priming',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'catalog-api-'));await fs.mkdir(path.join(root,'web'),{recursive:true});await fs.writeFile(path.join(root,'web/index.html'),'test');const id='jarvis-11111111-1111-1111-1111-111111111111';await fs.mkdir(path.join(root,'outputs',id),{recursive:true});
 const png=await sharp({create:{width:32,height:32,channels:3,background:'#336699'}}).png().toBuffer(),sha256=createHash('sha256').update(png).digest('hex');await fs.writeFile(path.join(root,'outputs',id,'image.png'),png);await fs.writeFile(path.join(root,'outputs',id,'receipt.json'),JSON.stringify({status:'VERIFIED',image:{path:'outputs/'+id+'/image.png',sha256}}));
 const server=await startEditor({root,port:0,voices:[{name:'Hải Đăng',aliases:[]}]});try{
  assert.equal((await fetch(server.url+'/api/media-catalog')).status,401);const page=await fetch(server.url+'/'),cookie=page.headers.get('set-cookie').split(';')[0],boot=await(await fetch(server.url+'/api/bootstrap',{headers:{cookie}})).json(),headers={cookie,origin:server.url,'content-type':'application/json','x-studio-csrf':boot.csrf};
  const direct=await fetch(server.url+'/api/images/'+id,{headers:{cookie}});assert.equal(direct.status,200);assert.equal(createHash('sha256').update(Buffer.from(await direct.arrayBuffer())).digest('hex'),sha256);
  const catalog=await(await fetch(server.url+'/api/media-catalog',{headers:{cookie}})).json();assert.equal(catalog.items.length,1);
  const payload={id,expectedRevision:0,group:'Thử',tags:['Robot']},post=(p,h=headers)=>fetch(server.url+'/api/media-labels',{method:'POST',headers:h,body:JSON.stringify(p)});
  assert.equal((await post(payload,{...headers,origin:'https://evil.test'})).status,403);assert.equal((await post(payload,{...headers,'x-studio-csrf':'bad'})).status,403);assert.equal((await post({...payload,id:'asset-missing'})).status,404);
  assert.equal((await post(payload)).status,200);assert.equal((await post(payload)).status,409);const next=await(await fetch(server.url+'/api/media-catalog',{headers:{cookie}})).json();assert.deepEqual(next.items[0].tags,['Robot']);assert.equal(next.items[0].labelRevision,1);
 }finally{await server.close();}
});
