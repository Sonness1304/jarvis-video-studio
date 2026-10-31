import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';import {deflateRawSync,inflateRawSync} from 'node:zlib';import sharp from 'sharp';import puppeteer from 'puppeteer-core';
import {safeChild} from '../src/core.mjs';import {hashFile} from '../src/runtime.mjs';import {verifyQaIdentity} from '../src/qa.mjs';import {refractionGeometry,verifyLabRenderInputs} from '../src/motion-lab.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
try{
 const [relative,...extra]=process.argv.slice(2);if(!relative?.startsWith('outputs/')||extra.length)throw Error('USAGE: node scripts/motion-lab-proof.mjs OUTPUT_FOLDER');
 const out=safeChild(root,relative),read=async f=>JSON.parse(await fs.readFile(path.join(out,f),'utf8'));
 const config=JSON.parse(await fs.readFile(path.join(root,'runtime-config.json'),'utf8')),t=await read('timeline.json'),r=await read('receipt.json'),video=path.join(out,'video.mp4'),hash=await hashFile(video);
 verifyQaIdentity(r,hash,(await fs.stat(video)).size);
 const inputHashes={timeline:await hashFile(path.join(out,'timeline.json')),composition:await hashFile(path.join(out,'index.html'))};verifyLabRenderInputs(r,inputHashes);
 const proof={schemaVersion:1,status:'RUNNING',exportHash:hash,source:r.source,format:{width:t.width,height:t.height},qr:[],geometry:refractionGeometry(),layout:[],audioPlayback:'UNVERIFIED'};
 if(t.scenes.some(s=>s.lab?.kind==='qr')){
  const require=createRequire(import.meta.url),decode=require(path.join(root,'.tools/motion-lab/node_modules/jsqr'));
  if(require(path.join(root,'.tools/motion-lab/node_modules/jsqr/package.json')).version!=='1.4.0')throw Error('DECODER_VERSION_CHANGED');
  for(const s of t.scenes.filter(s=>s.lab?.kind==='qr')){
   const time=(Math.round((s.start+Math.min(2,(s.end-s.start)*.65))*30))/30;
   const name='proof-'+s.id+'.png',file=path.join(out,name);
   execFileSync(path.join(root,config.paths.ffmpeg),['-nostdin','-v','error','-ss',String(time),'-i',video,'-frames:v','1',file],{windowsHide:true});
   const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}),found=decode(new Uint8ClampedArray(data),info.width,info.height);
   const expected=s.lab.stage==='large'?null:'JARVIS MOTION LAB';if((found?.data??null)!==expected)throw Error('QR_FRAME_DECODE_FAILED_'+s.id);
   const n=s.lab.matrix.length,mask=s.lab.stage==='large'?{x:0,y:0,w:n,h:Math.ceil(n*.60)}:s.lab.stage==='small'?{x:Math.floor(n/2)-1,y:Math.floor(n/2)-1,w:3,h:3}:null;
   proof.qr.push({sceneId:s.id,stage:s.lab.stage,time,frameSha256:await hashFile(file),file:name,expected,payload:found?.data??null,decodedVersion:found?.version??null,generatorVersion:'1.5.4',decoder:'jsqr',decoderVersion:'1.4.0',ecc:'H',symbolVersion:(n-21)/4+1,maskModules:mask,result:'VERIFIED'});
  }
 }
 const bytes=Buffer.from('ABCABCABCABC\n'.repeat(120)),compressed=deflateRawSync(bytes),restored=inflateRawSync(compressed);if(!bytes.equals(restored))throw Error('DEFLATE_ROUNDTRIP_FAILED');
 proof.deflate={inputBytes:bytes.length,compressedBytes:compressed.length,equal:true,algorithm:'DEFLATE raw; not ZIP container',sha256:await fs.writeFile(path.join(out,'lossless-source.txt'),bytes).then(()=>hashFile(path.join(out,'lossless-source.txt')))};
 await fs.writeFile(path.join(out,'lossless.deflate'),compressed);await fs.writeFile(path.join(out,'lossless-restored.txt'),restored);
 const browser=await puppeteer.launch({executablePath:config.paths.chrome,headless:true,args:['--disable-gpu'],defaultViewport:{width:t.width,height:t.height}});
 try{const page=await browser.newPage();await page.goto(pathToFileURL(path.join(out,'index.html')).href);await page.evaluate(()=>document.fonts.ready);
  for(const s of t.scenes){const issues=await page.evaluate(({time,id})=>{window.__timelines.root.seek(time,false);const el=document.getElementById('scene-'+id),title=el.querySelector('h1'),visual=el.querySelector('.visual'),issues=[],a=title.getBoundingClientRect(),b=visual.getBoundingClientRect();if(a.bottom>b.top-8&&a.right>b.left&&a.left<b.right)issues.push('TITLE_TOUCHES_VISUAL');for(const text of el.querySelectorAll('.lab-figure text')){const r=text.getBoundingClientRect();if(r.left<b.left||r.right>b.right||r.top<b.top||r.bottom>b.bottom)issues.push('FIGURE_TEXT_OUTSIDE');}for(const cue of document.querySelectorAll('[data-caption-scene="'+id+'"]')){const r=cue.getBoundingClientRect();if(r.top<b.bottom+8)issues.push('CAPTION_TOUCHES_VISUAL');if(r.left<24||r.right>innerWidth-24||r.bottom>innerHeight-24||cue.scrollHeight>cue.clientHeight+2)issues.push('CAPTION_OUTSIDE');}return [...new Set(issues)];},{time:s.start+1,id:t.scenes.indexOf(s)});if(issues.length)throw Error(s.id+':'+issues.join(','));proof.layout.push({sceneId:s.id,result:'VERIFIED'});}
 }finally{await browser.close();}
 verifyLabRenderInputs(r,{timeline:await hashFile(path.join(out,'timeline.json')),composition:await hashFile(path.join(out,'index.html'))});proof.renderInputs=inputHashes;
 proof.status='VERIFIED';await fs.writeFile(path.join(out,'motion-proof.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:proof.status,output:relative,qrFrames:proof.qr.length,layout:proof.layout.length,audioPlayback:proof.audioPlayback}));
}catch(e){console.log(JSON.stringify({status:'FAILED',error:e.message}));process.exitCode=1;}
