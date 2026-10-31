import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import http from 'node:http';
import {startEditor} from '../src/editor-server.mjs';import {ContentAttempts} from '../src/content-attempts.mjs';import {BatchQueue} from '../src/batch-queue.mjs';import {childEnvironment} from '../src/process.mjs';
const m=await import('../src/desktop-lifecycle.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});const nonce='a'.repeat(64);
test('idle shutdown authenticates owner and atomically excludes mutations and competing shutdown',async()=>{
 assert.equal(typeof m.DesktopLifecycle,'function');let finish;const lifecycle=new m.DesktopLifecycle({ownerNonce:nonce,activity:()=>new Promise(r=>finish=r)});const release=lifecycle.enterMutation();await assert.rejects(lifecycle.requestShutdown(nonce),/BUSY/);release();release();await assert.rejects(lifecycle.requestShutdown('b'.repeat(64)),/DENIED/);
 const stop=lifecycle.requestShutdown(nonce);assert.equal(lifecycle.phase,'CHECKING');assert.throws(()=>lifecycle.enterMutation(),/SHUTTING_DOWN/);await assert.rejects(lifecycle.requestShutdown(nonce),/SHUTTING_DOWN/);finish('idle');assert.deepEqual(await stop,{status:'READY_TO_CLOSE'});assert.equal(lifecycle.phase,'CLOSING');assert.throws(()=>lifecycle.enterMutation(),/SHUTTING_DOWN/);
});
test('busy unknown failed checks hold exit without poisoning future mutation admission',async()=>{
 for(const activity of [async()=> 'busy',async()=> 'unknown',async()=>{throw Error('corrupt');}]){const l=new m.DesktopLifecycle({ownerNonce:nonce,activity});await assert.rejects(l.requestShutdown(nonce),/BUSY|UNKNOWN/);assert.equal(l.phase,'READY');l.enterMutation()();}
 const unowned=new m.DesktopLifecycle({activity:async()=> 'idle'});await assert.rejects(unowned.requestShutdown(nonce),/DENIED/);
});
test('text/batch activity is readonly and unfinished or corrupt history blocks shutdown',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'desktop-activity-'));try{const s=new ContentAttempts(root,{launch:async()=>{throw Error('no launch');}});await s.init();assert.equal(await s.activity(),'idle');await fs.writeFile(path.join(s.base(),'admission.lease'),'{}');assert.equal(await s.activity(),'unknown');await fs.unlink(path.join(s.base(),'admission.lease'));
 const jobs={records:new Map()},q=new BatchQueue(root,jobs);assert.equal(q.activity(),'idle');q.records.set('b',{status:'QUEUED',entries:[]});assert.equal(q.activity(),'busy');q.records.set('b',{status:'BLOCKED',entries:[]});assert.equal(q.activity(),'unknown');q.records.set('b',{status:'PAUSED',entries:[{status:'UNKNOWN'}]});assert.equal(q.activity(),'unknown');q.close();
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('authenticated API hides nonce and protects shutdown from in-flight body/start and unknown jobs',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'desktop-http-'));await fs.mkdir(path.join(root,'web'));await fs.writeFile(path.join(root,'web/index.html'),'<h1>Studio</h1>');const s=await startEditor({root,port:0,voices:[{name:'Hải Đăng',aliases:[]}],desktopOptions:{ownerNonce:nonce}});
 try{const page=await fetch(s.url),cookie=page.headers.get('set-cookie').split(';')[0],boot=await(await fetch(s.url+'/api/bootstrap',{headers:{cookie}})).json(),headers={cookie,origin:s.url,'content-type':'application/json','x-studio-csrf':boot.csrf,'x-studio-desktop-owner':nonce};assert.equal(boot.serverIdentity.appId,'jarvis-video-studio');assert.equal(boot.serverIdentity.pid,process.pid);assert.match(boot.serverIdentity.rootHash,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(boot).includes(nonce));
 const stop=h=>fetch(s.url+'/api/desktop/shutdown',{method:'POST',headers:h,body:'{}'});
 assert.equal((await stop({...headers,'x-studio-desktop-owner':'wrong'})).status,403);assert.equal((await stop({...headers,origin:'https://evil.test'})).status,403);
 const waiting=http.request(s.url+'/api/projects',{method:'POST',headers:{...headers,'content-length':1000}});waiting.on('error',()=>{});waiting.write('{');await new Promise(r=>setTimeout(r,30));assert.equal((await stop(headers)).status,409);waiting.destroy();await new Promise(r=>setTimeout(r,30));
 s.jobs.records.set('job-unknown',{status:'UNKNOWN'});assert.equal((await stop(headers)).status,409);s.jobs.records.clear();assert.equal((await stop(headers)).status,200);
 }finally{await s.close();await fs.rm(root,{recursive:true,force:true});}
});
test('desktop owner nonce cannot flow to media or model child environments',()=>{process.env.JARVIS_DESKTOP_OWNER_NONCE=nonce;try{assert.equal(childEnvironment('C:/fixture',{paths:{chrome:'chrome',ffmpeg:'ffmpeg',ffprobe:'ffprobe'}}).JARVIS_DESKTOP_OWNER_NONCE,undefined);}finally{delete process.env.JARVIS_DESKTOP_OWNER_NONCE;}});
test('Windows EPERM on a finished PID needs an independent absence proof, never a blanket allow',async()=>{
 assert.equal(typeof m.desktopPidState,'function');let checks=0;
 const permission=()=>{throw Object.assign(Error('terminated Windows PID'),{code:'EPERM'});};
 assert.equal(await m.desktopPidState(123,{platform:'win32',kill:permission,windowsProbe:async()=>{checks++;return 'ABSENT';}}),'dead');assert.equal(checks,1);
 for(const probe of [async()=> 'PRESENT',async()=> 'garbled',async()=>{throw Error('query failed');}])assert.equal(await m.desktopPidState(123,{platform:'win32',kill:permission,windowsProbe:probe}),'unknown');
 assert.equal(await m.desktopPidState(123,{platform:'linux',kill:permission,windowsProbe:async()=>{throw Error('must not probe');}}),'unknown');
 assert.equal(await m.desktopPidState(123,{kill:()=>{throw Object.assign(Error(),{code:'ESRCH'});}}),'dead');
 assert.equal(await m.desktopPidState(123,{kill:()=>{}}),'unknown');
 for(const pid of [null,0,-1,1.2,'123'])assert.equal(await m.desktopPidState(pid,{windowsProbe:async()=>{throw Error('must not probe');}}),'unknown');
 const context={root:os.tmpdir(),jobs:{records:new Map([['done',{status:'VERIFIED',pid:123}]])},batches:{activity:()=> 'idle'},content:{activity:async()=> 'idle'}};
 assert.equal(await m.studioActivity({...context,pidState:async()=> 'dead'}),'idle');assert.equal(await m.studioActivity({...context,pidState:async()=> 'unknown'}),'unknown');
});
test('slow history checks cannot authorize shutdown after the native client deadline has expired',async()=>{
 const context={root:os.tmpdir(),jobs:{records:new Map([['one',{status:'VERIFIED',pid:123}],['two',{status:'VERIFIED',pid:456}]])},batches:{activity:()=> 'idle'},content:{activity:async()=> 'idle'},pidState:async()=>{await new Promise(r=>setTimeout(r,20));return 'dead';}};
 const lifecycle=new m.DesktopLifecycle({ownerNonce:nonce,activity:()=>m.studioActivity(context),activityTimeoutMs:25});
 await assert.rejects(lifecycle.requestShutdown(nonce),/DESKTOP_UNKNOWN/);assert.equal(lifecycle.phase,'READY');lifecycle.enterMutation()();
 await new Promise(r=>setTimeout(r,65));assert.equal(lifecycle.phase,'READY');
});
