import test from 'node:test';import assert from 'node:assert/strict';
const m=await import('../web/media-library-model.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const image={id:'asset-image',kind:'image',name:'Ảnh Đà Nẵng',path:'outputs/asset-image/media.png',sha256:'a'.repeat(64),bytes:4096,createdAt:'2026-10-14T10:00:00Z'};
const video={id:'asset-video',kind:'video',name:'Clip',path:'outputs/asset-video/media.mp4',sha256:'b'.repeat(64),bytes:8192,createdAt:'2026-10-15T10:00:00Z'};
const music={id:'asset-music',kind:'music',name:'Nhạc',path:'outputs/asset-music/music.wav',sha256:'c'.repeat(64),bytes:1024};
const draft={scenes:[{id:'s1',title:'Biển',visual:'media',media:{path:image.path,sha256:image.sha256}},{id:'s2',title:'Sai hash',visual:'media',media:{path:video.path,sha256:'f'.repeat(64)}},{id:'s3',visual:'quote',media:{path:image.path,sha256:image.sha256}}],music:{assetId:music.id,path:music.path,sha256:music.sha256}};
test('media usage describes only exact current-draft references, never global orphan status',()=>{
 assert.equal(typeof m.assetReferences,'function');assert.deepEqual(m.assetReferences(image,draft),[{kind:'scene',sceneId:'s1',index:0,title:'Biển'}]);assert.deepEqual(m.assetReferences(video,draft),[]);assert.deepEqual(m.assetReferences(music,draft),[{kind:'music'}]);assert.deepEqual(m.assetReferences({...image,path:'other'},draft),[]);assert.deepEqual(m.assetReferences(image,null),[]);
});
test('media search/filter/sort is accent-insensitive, stable, immutable and uses current draft usage',()=>{
 assert.equal(typeof m.filterAssets,'function');const assets=[music,video,image],before=JSON.stringify(assets);
 assert.deepEqual(m.filterAssets(assets,{query:'anh da nang'}).map(v=>v.id),[image.id]);
 assert.deepEqual(m.filterAssets(assets,{kind:'music'}).map(v=>v.id),[music.id]);
 assert.deepEqual(m.filterAssets(assets,{usage:'current',draft,sort:'size'}).map(v=>v.id),[image.id,music.id]);
 assert.deepEqual(m.filterAssets(assets,{usage:'unattached',draft}).map(v=>v.id),[video.id]);
 assert.deepEqual(m.filterAssets(assets,{sort:'newest'}).map(v=>v.id),[video.id,image.id,music.id]);assert.equal(JSON.stringify(assets),before);
 const same=[{...image,id:'asset-z'},{...image,id:'asset-a'}];assert.deepEqual(m.filterAssets(same,{sort:'size'}).map(v=>v.id),['asset-a','asset-z']);
});
test('media totals count only valid normalized sizes and preview URLs accept canonical asset identifiers',()=>{
 assert.equal(typeof m.assetTotals,'function');assert.deepEqual(m.assetTotals([image,video,music,{bytes:-1},{bytes:NaN}]),{count:5,bytes:13312});
 assert.equal(m.assetUrl(video,'file'),'/api/assets/asset-video/file');assert.equal(m.assetUrl(video,'poster'),'/api/assets/asset-video/poster');assert.throws(()=>m.assetUrl({...video,id:'../outside'},'file'),/INVALID_ASSET_ID/);assert.throws(()=>m.assetUrl(video,'execute'),/INVALID_ASSET_KIND/);
});
