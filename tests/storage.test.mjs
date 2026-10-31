import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {inspectStorage} from '../src/storage.mjs';
async function fixture(){return fs.mkdtemp(path.join(os.tmpdir(),'video-storage-'));}
async function put(root,file,value){await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),typeof value==='string'?value:JSON.stringify(value));}
test('storage reads every historical project reference including shots and music without changing state',async()=>{
 const root=await fixture();await put(root,'outputs/old/frame-00001.png','image');await put(root,'outputs/new/final.mp4','movie');
 await put(root,'.runtime/studio/projects/one/00000001.json',{revision:1,brief:{scenes:[{shots:[{media:{path:'outputs/old/frame-00001.png'}}]}],music:{path:'outputs/music/music.wav'}}});
 await put(root,'.runtime/studio/projects/one/00000002.json',{revision:2,brief:{scenes:[]}});
 const before=await fs.readFile(path.join(root,'.runtime/studio/projects/one/00000001.json'));const r=await inspectStorage(root);
 assert.equal(r.totals.files,2);assert.equal(r.totals.bytes,10);assert.equal(r.references.projectRevisions,2);
 assert.ok(r.references.entries.some(x=>x.path==='outputs/old/frame-00001.png'&&x.owners.some(o=>o.revision==='00000001')));
 assert.ok(r.references.entries.some(x=>x.path==='outputs/music/music.wav'));assert.equal(r.cleanupApproved,false);assert.equal(r.reclaimableBytes,null);
 assert.deepEqual(await fs.readFile(path.join(root,'.runtime/studio/projects/one/00000001.json')),before);
 assert.equal((await fs.readdir(root)).length,2);
});
test('storage latest job revision decides busy status, not older RUNNING records',async()=>{
 const root=await fixture();await put(root,'.runtime/studio/jobs/job-one/00000001.json',{status:'RUNNING'});await put(root,'.runtime/studio/jobs/job-one/00000002.json',{status:'VERIFIED'});
 await put(root,'.runtime/studio/jobs/job-two/00000001.json',{status:'UNKNOWN'});
 const r=await inspectStorage(root);assert.equal(r.jobState.active.length,0);assert.equal(r.jobState.unknown.length,1);assert.equal(r.jobState.safeToRender,false);
});
test('missing optional directories are empty without mkdir, malformed metadata is partial',async()=>{
 const root=await fixture();let r=await inspectStorage(root);assert.equal(r.totals.files,0);assert.deepEqual(await fs.readdir(root),[]);
 await put(root,'.runtime/studio/assets/asset-one.json','{broken');r=await inspectStorage(root);assert.equal(r.status,'PARTIAL');assert.ok(r.warnings.length);assert.equal(r.references.coverage,'INCOMPLETE');
});
test('oversize metadata and linked paths stay unresolved, never traversed',async()=>{
 const root=await fixture(),outside=await fixture();await put(root,'.runtime/studio/assets/asset-large.json','x'.repeat(131073));await put(outside,'secret.txt','do not follow');
 await fs.mkdir(path.join(root,'outputs'));await fs.symlink(outside,path.join(root,'outputs','linked'),process.platform==='win32'?'junction':'dir');
 const r=await inspectStorage(root);assert.equal(r.status,'PARTIAL');assert.equal(r.totals.files,0);assert.ok(r.warnings.some(w=>w.code==='LINK_NOT_TRAVERSED'));assert.ok(r.warnings.some(w=>w.code==='METADATA_TOO_LARGE'));
});
test('frame classification is only a candidate and leases prevent render readiness',async()=>{
 const root=await fixture();await put(root,'outputs/video/frames/frame-00001.png','png');await put(root,'outputs/video/cover.png','cover');await put(root,'outputs/video/scene.py','code');await put(root,'.runtime/build.lock','{}');
 const r=await inspectStorage(root);assert.equal(r.groups['numbered-frame-candidate'].files,1);assert.equal(r.groups['recipe-source'].files,1);assert.equal(r.jobState.safeToRender,false);assert.equal(r.reclaimableBytes,null);
});
