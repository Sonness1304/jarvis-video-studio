import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import sharp from 'sharp';
import {readMedia} from '../src/media.mjs';import {validateBrief,buildTimeline} from '../src/core.mjs';import {renderHtml} from '../src/composition.mjs';
test('local generated image is pinned decoded and placed in scene without embedding a user path',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'video-media-'));await fs.mkdir(path.join(root,'outputs'));
 const payload=await sharp({create:{width:768,height:1024,channels:3,background:'#3569cc'}}).png().toBuffer();await fs.writeFile(path.join(root,'outputs/image.png'),payload);
 const b={schemaVersion:1,id:'image-scene',title:'Ảnh AI',preset:'story',voice:'Hải Đăng',accent:'#3569CC',scenes:[{id:'shot',title:'Một hình ảnh mới',visual:'media',media:{kind:'image',path:'outputs/image.png',sha256:createHash('sha256').update(payload).digest('hex')},phrases:[{id:'p',text:'Ảnh đã tạo được gắn vào cảnh.'}]}]};
 const assets=await readMedia(root,validateBrief(b));assert.equal(assets[0].name,'media-0.png');assert.equal(assets[0].width,768);
 const html=renderHtml(buildTimeline(b,{p:{samples:48000,sampleRate:48000}}));assert.match(html,/assets\/media-0.png/);assert.ok(!html.includes('outputs/image.png'));
 await fs.writeFile(path.join(root,'outputs/image.png'),Buffer.from('corrupted'));await assert.rejects(readMedia(root,b),/MEDIA_HASH_CHANGED/);
 assert.throws(()=>validateBrief({...b,scenes:[{...b.scenes[0],media:{kind:'image',path:'../escape',sha256:'bad'}}]}));
});
