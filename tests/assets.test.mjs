import test from 'node:test';import assert from 'node:assert/strict';import {sniffMedia,validateUploadMetadata,assetDecodeArgs} from '../src/assets.mjs';
test('canonical assets strictly decode their declared stream without requiring the absent stream',()=>{
 assert.deepEqual(assetDecodeArgs('clip.mp4','video').filter((x,i,a)=>a[i-1]==='-map'),['0:v:0']);
 assert.deepEqual(assetDecodeArgs('music.wav','music').filter((x,i,a)=>a[i-1]==='-map'),['0:a:0']);
 assert.throws(()=>assetDecodeArgs('x','other'),/INVALID_ASSET_KIND/);
});
test('media sniff refuses playlists disguised by extension and requires rights declaration',()=>{
 assert.throws(()=>sniffMedia(Buffer.from('#EXTM3U\nhttps://evil.test/video.ts')),/UNSUPPORTED_MEDIA/);assert.throws(()=>sniffMedia(Buffer.from('<svg onload="bad">')),/UNSUPPORTED_MEDIA/);
 assert.equal(sniffMedia(Buffer.from([137,80,78,71,13,10,26,10])),'image');const b=Buffer.alloc(16);b.write('ftyp',4);assert.equal(sniffMedia(b),'video');
 assert.throws(()=>validateUploadMetadata({name:'x.mp4',rights:''}),/RIGHTS_REQUIRED/);assert.equal(validateUploadMetadata({name:'ảnh.png',rights:'Tôi tự tạo'}).name,'ảnh.png');
});
