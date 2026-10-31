import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import {validatePack,createCreatorPack,verifyCreatorPack} from '../src/creator-pack.mjs';
import {ProjectStore} from '../src/editor-store.mjs';import {buildTimeline,toSrt} from '../src/core.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const meta=()=>({schemaVersion:1,contentId:'pilot-qr',projectId:'pilot-qr',revision:1,sources:[{id:'denso',url:'https://www.qrcode.com/en/about/error_correction.html',claim:'Khả năng sửa lỗi có giới hạn.',assessment:'Đã đối chiếu nguồn chính thức'}],rights:[{asset:'SVG và lời kể',basis:'Jarvis tự viết; preset voice theo runtime hiện có'}],cover:{sceneId:'intro',title:'QR bị che vẫn đọc?'},copy:Object.fromEntries(['youtube','facebook','tiktok'].map(k=>[k,{title:'QR bị che vẫn đọc?',caption:'Thử nghiệm có kiểm soát.'}]))});
test('metadata bounds paths, source URLs, copy and explicit project revision',()=>{
 assert.equal(validatePack(meta()).contentId,'pilot-qr');
 for(const f of [m=>m.contentId='../x',m=>m.revision=0,m=>m.sources[0].url='https://user:pass@example.com',m=>m.sources=[],m=>m.copy.youtube.title='x'.repeat(101)]){const m=meta();f(m);assert.throws(()=>validatePack(m));}
 for(const f of [m=>delete m.copy,m=>delete m.copy.youtube]){const m=meta();f(m);assert.throws(()=>validatePack(m),/INVALID_PACK_COPY/);}
});
test('pack pins project, export, SRT and QA hashes; changed export or mismatched revision fails before cover',async ctx=>{
 const root=await mkdtemp(path.join(tmpdir(),'creator-pack-')),out='outputs/attempt';await mkdir(path.join(root,out),{recursive:true});
 const b={schemaVersion:1,id:'pilot-qr',title:'QR bị che',preset:'explain',voice:'Hải Đăng',accent:'#156BA0',scenes:[{id:'intro',title:'QR',visual:'script',phrases:[{id:'p1',text:'Khả năng sửa lỗi có giới hạn.'}]}]};
 await new ProjectStore(root).create(b);const t=buildTimeline(b,{p1:{samples:144000,sampleRate:48000}}),v=Buffer.from('unit-fixture-video');
 for(const [name,data] of Object.entries({'brief.json':JSON.stringify(b),'timeline.json':JSON.stringify(t),'video.mp4':v,'captions.srt':toSrt(t),'receipt.json':JSON.stringify({status:'VERIFIED',briefHash:sha(JSON.stringify(b)+'\n'),renderInputs:{brief:sha(JSON.stringify(b)),timeline:sha(JSON.stringify(t)),captions:sha(toSrt(t))},artifacts:{video:{sha256:sha(v),bytes:v.length}},source:{head:'a'.repeat(40),dirty:false}}),'qa.json':JSON.stringify({status:'VERIFIED',exportHash:sha(v),audioPlayback:'UNVERIFIED'})}))await writeFile(path.join(root,out,name),data);
 let calls=0;const cover=async file=>{calls++;await writeFile(file,'unit-cover');};
 const pack=await createCreatorPack(root,out,meta(),{qaFile:out+'/qa.json',cover});assert.equal(pack.publicationStatus,'DRAFT');assert.equal(pack.project.revision,1);assert.equal(pack.files.find(f=>f.path==='video.mp4').sha256,sha(v));
 assert.equal(JSON.parse(await readFile(path.join(root,pack.path,'manifest.json'))).publicationStatus,'DRAFT');
 assert.equal((await verifyCreatorPack(root,pack.path)).status,'VERIFIED');
 const originalManifest=await readFile(path.join(root,pack.path,'manifest.json'));await writeFile(path.join(root,pack.path,'manifest.json'),originalManifest+' ');await assert.rejects(verifyCreatorPack(root,pack.path),/MANIFEST_CHANGED/);await writeFile(path.join(root,pack.path,'manifest.json'),originalManifest);
 const originalCopy=fs.copyFile.bind(fs);const copyMock=ctx.mock.method(fs,'copyFile',async(...args)=>{await originalCopy(...args);if(args[1].endsWith('video.mp4'))await writeFile(path.join(root,out,'timeline.json'),JSON.stringify({...t,duration:123}));});
 await assert.rejects(createCreatorPack(root,out,meta(),{qaFile:out+'/qa.json',cover}),/PACK_COPY_CHANGED/);copyMock.mock.restore();await writeFile(path.join(root,out,'timeline.json'),JSON.stringify(t));assert.equal(calls,1);
 await writeFile(path.join(root,out,'video.mp4'),'changed');await assert.rejects(createCreatorPack(root,out,meta(),{qaFile:out+'/qa.json',cover}),/EXPORT_CHANGED/);assert.equal(calls,1);
 await writeFile(path.join(root,out,'video.mp4'),v);const bad=meta();bad.revision=2;await assert.rejects(createCreatorPack(root,out,bad,{qaFile:out+'/qa.json',cover}));assert.equal(calls,1);
 await writeFile(path.join(root,out,'captions.srt'),'wrong');await assert.rejects(createCreatorPack(root,out,meta(),{qaFile:out+'/qa.json',cover}),/SRT_CHANGED/);
});
