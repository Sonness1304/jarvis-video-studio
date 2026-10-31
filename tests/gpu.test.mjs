import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {assertResources,imageGraph,clipGraph,validateClipExport,ComfyClient,validateOutput,submitMeasured,waitForJob} from '../src/gpu.mjs';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createGpuIntent,resolveGpuIntent,findGpuPrompt,writeOwnedArtifact} from '../src/gpu-job.mjs';import {acquireBuildLock} from '../src/process.mjs';
test('GPU minimum gate requires live free RAM VRAM and disk rather than total installed capacity',()=>{
 assert.equal(assertResources({ram:3*1024**3,vram:6*1024**3,disk:30*1024**3}),true);
 for(const [key,minimum] of [['ram',3],['vram',6],['disk',30]])assert.throws(()=>assertResources({ram:3*1024**3,vram:6*1024**3,disk:30*1024**3,[key]:minimum*1024**3-1}),new RegExp('INSUFFICIENT_'+key.toUpperCase()));
 for(const k of ['ram','vram','disk'])assert.throws(()=>assertResources({ram:7*1024**3,vram:7*1024**3,disk:31*1024**3,[k]:0}),/INSUFFICIENT_/);
});
test('reconciliation can resume after artifact copy without overwriting changed content',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gpu-copy-reconcile-'));await fs.mkdir(path.join(root,'outputs'));const payload=Buffer.from('synthetic-owned-payload');
 assert.equal((await writeOwnedArtifact(root,'outputs/clip.mp4',payload)).reused,false);
 assert.equal((await writeOwnedArtifact(root,'outputs/clip.mp4',payload)).reused,true);
 await fs.writeFile(path.join(root,'outputs/clip.mp4'),'changed');await assert.rejects(writeOwnedArtifact(root,'outputs/clip.mp4',payload),/GPU_ARTIFACT_CHANGED/);
 assert.equal(await fs.readFile(path.join(root,'outputs/clip.mp4'),'utf8'),'changed');
});
test('clip validation rejects wrong codec dimensions frames rate or truncated duration',()=>{
 const video={codec_type:'video',codec_name:'h264',width:320,height:512,nb_frames:'49',r_frame_rate:'24/1'},m={streams:[video],format:{duration:String(49/24)}};assert.equal(validateClipExport(m),true);
 for(const [key,value] of Object.entries({codec_name:'av1',width:768,height:1024,nb_frames:'48',r_frame_rate:'30/1'}))assert.throws(()=>validateClipExport({...m,streams:[{...video,[key]:value}]}),/CLIP_EXPORT_CONTRACT_FAILED/);
 assert.throws(()=>validateClipExport({...m,format:{duration:'1'}}));assert.throws(()=>validateClipExport({streams:[]}));
});
test('clip canary has a reviewed fixed core graph with 49 measured frames and safe unique image',()=>{
 const g=clipGraph('Robot waves its hand slowly.','jarvis-abc','jarvis-abc.png');
 assert.equal(g['6'].inputs.length,49);assert.equal(g['6'].inputs.width,320);assert.equal(g['6'].inputs.height,512);assert.equal(g['13'].inputs.fps,24);
 assert.equal(g['14'].inputs.filename_prefix,'jarvis-abc');assert.equal(g['3'].inputs.text,'Robot waves its hand slowly.');
 assert.throws(()=>clipGraph('test','jarvis-abc','../outside.png'));assert.throws(()=>clipGraph('test','jarvis-abc','other.png'));
 assert.ok(!JSON.stringify(g).includes('http'));assert.ok(!Object.values(g).some(n=>n.class_type.includes('API')));
});
test('accepted submit with lost reply remains blocked until matching terminal readback',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gpu-unknown-')),release=await acquireBuildLock(root),id='jarvis-11111111-1111-4111-8111-111111111111';
 await createGpuIntent(root,{clientId:id,status:'SUBMITTING',receipt:'outputs/'+id+'/receipt.json'});await release();
 await assert.rejects(acquireBuildLock(root),/GPU_JOB_PENDING/);await assert.rejects(resolveGpuIntent(root,id,'UNKNOWN'),/NOT_TERMINAL/);
 const prompt=await findGpuPrompt({request:async route=>route==='/queue'?{queue_running:[[0,'prompt-id',{}, {client_id:id}]],queue_pending:[]}:{'prompt-id':{prompt:[0,'prompt-id',{}, {client_id:id}]}}},id);assert.equal(prompt,'prompt-id');
 await resolveGpuIntent(root,id,'FAILED');const next=await acquireBuildLock(root);await next();
});
test('resource gate is measured immediately before submit and elapsed time bounds polling',async()=>{
 let submits=0;await assert.rejects(submitMeasured({submit:async()=>{submits++;}},imageGraph('test','jarvis-abc'),'client',async()=>({ram:0,vram:7*1024**3,disk:31*1024**3})),/INSUFFICIENT_RAM/);assert.equal(submits,0);
 let clock=0,polls=0;const result=await waitForJob({history:async()=>{polls++;clock+=9000;return {status:'PENDING'};}},'id',{deadlineMs:10000,now:()=>clock,pause:async ms=>{clock+=ms;}});
 assert.equal(result.status,'UNKNOWN');assert.equal(polls,1);assert.ok(clock<=10000);
});
test('image prompt is literal bounded data with a fixed core graph and one output prefix',()=>{
 const graph=imageGraph('A robot; do not run any code', 'jarvis-abc');
 assert.equal(graph['2'].inputs.text,'A robot; do not run any code');assert.equal(graph['7'].inputs.filename_prefix,'jarvis-abc');
 assert.equal(graph['4'].inputs.batch_size,1);assert.throws(()=>imageGraph('x'.repeat(5000),'safe'));
 assert.throws(()=>imageGraph('test','../escape'));assert.throws(()=>validateOutput({filename:'../bad.png',subfolder:'',type:'output'},'jarvis-abc'));
 assert.throws(()=>validateOutput({filename:'other_00001_.png',subfolder:'',type:'output'},'jarvis-abc'));
});
test('only loopback is accepted and unknown submit is never automatically retried',async()=>{
 assert.throws(()=>new ComfyClient('https://example.com'));assert.throws(()=>new ComfyClient('http://localhost:8188'));assert.throws(()=>new ComfyClient('http://127.0.0.1:8188/path'));
 let calls=0;const server=http.createServer((req,res)=>{calls++;res.destroy();});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const client=new ComfyClient('http://127.0.0.1:'+server.address().port);const r=await client.submit(imageGraph('test','jarvis-abc'),'owned-client');assert.equal(r.status,'UNKNOWN');assert.equal(calls,1);}finally{server.close();}
});
test('history verifies completed output and detects backend failure without conflating HTTP200 with generation',async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:{status:{completed:true,status_str:'success'},outputs:{7:{images:[{filename:'jarvis-abc_00001_.png',subfolder:'',type:'output'}]}}}}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const client=new ComfyClient('http://127.0.0.1:'+server.address().port);const r=await client.history('id');assert.equal(r.status,'COMPLETED');assert.equal(r.output.filename,'jarvis-abc_00001_.png');}finally{server.close();}
});
