import test from 'node:test';
import assert from 'node:assert/strict';
const m=await import('../web/artcraft-model.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const image={id:'asset-test',name:'Ảnh tham khảo',kind:'image',path:'outputs/asset-test/media.png',sha256:'a'.repeat(64)};
const draft={id:'project-one',title:'Thí nghiệm',format:'portrait',theme:'editorial',voice:'Hải Đăng',scenes:[{id:'scene-one',title:'Giọt nước',visual:'media',media:{kind:'image',path:image.path,sha256:image.sha256},phrases:[{id:'p-one',text:'Một giọt nước chuyển động.'}]}]};
const options={action:'Giọt nước dao động nhẹ, giữ một giọt.',camera:'Máy cố định.',style:'Cận cảnh thí nghiệm.',duration:8,referenceIds:[]};
test('Artcraft snapshot is immutable, references opt in and filesystem paths stay local',()=>{
 assert.equal(typeof m.artcraftSnapshot,'function');const before=JSON.stringify(draft),s=m.artcraftSnapshot({draft,selected:0,assets:[image]});
 assert.equal(s.aspectRatio,'9:16');assert.equal(s.references.length,1);draft.scenes[0].title='Đã sửa';
 const b=m.artcraftBrief(s,options);assert.equal(b.scene.title,'Giọt nước');assert.deepEqual(b.references,[]);assert.equal(b.durationSeconds,8);assert.equal(b.mediaApiRequests,0);
 const selected=m.artcraftBrief(s,{...options,referenceIds:[image.id]});assert.equal(selected.references[0].sha256,image.sha256);assert(!JSON.stringify(selected).includes('outputs/'));assert(!JSON.stringify(s).includes('outputs/'));
 assert(!JSON.stringify(selected).includes('voice'));assert.match(m.artcraftText(selected),/Máy cố định/);assert.match(m.artcraftText(selected),/audio|Âm thanh/i);
 draft.scenes[0].title='Giọt nước';assert.equal(JSON.stringify(draft),before);
});
test('format, missing scene, edited fields and chosen references are validated',()=>{
 assert.equal(typeof m.artcraftSnapshot,'function');for(const [format,ratio] of [['portrait','9:16'],['landscape','16:9'],['square','1:1']])assert.equal(m.artcraftSnapshot({draft:{...draft,format},selected:0,assets:[]}).aspectRatio,ratio);
 assert.throws(()=>m.artcraftSnapshot({draft:null,selected:0,assets:[]}),/ARTCRAFT_SCENE_REQUIRED/);
 assert.throws(()=>m.artcraftSnapshot({draft,selected:9,assets:[]}),/ARTCRAFT_SCENE_REQUIRED/);
 assert.throws(()=>m.artcraftSnapshot({draft:{...draft,format:'other'},selected:0,assets:[]}),/ARTCRAFT_FORMAT/);
 const s=m.artcraftSnapshot({draft,selected:0,assets:[image]});
 for(const duration of [0,61,Infinity,NaN])assert.throws(()=>m.artcraftBrief(s,{...options,duration}),/ARTCRAFT_DURATION/);
 assert.throws(()=>m.artcraftBrief(s,{...options,action:''}),/ARTCRAFT_FIELD/);
 assert.throws(()=>m.artcraftBrief(s,{...options,camera:'x'.repeat(401)}),/ARTCRAFT_FIELD/);
 assert.throws(()=>m.artcraftBrief(s,{...options,referenceIds:['missing']}),/ARTCRAFT_REFERENCE/);
 assert.equal(m.artcraftSnapshot({draft,selected:0,assets:[{...image,sha256:'b'.repeat(64)}]}).references.length,0);
 const boards=structuredClone(draft);boards.scenes[0].shots=[{id:'shot',visual:'diagram'}];assert.equal(m.artcraftSnapshot({draft:boards,selected:0,assets:[image]}).references.length,0);
 boards.scenes[0].shots[0]={id:'shot',visual:'media',media:draft.scenes[0].media};assert.equal(m.artcraftSnapshot({draft:boards,selected:0,assets:[image]}).references.length,1);
});
test('import is explicit, cancel does nothing, label failure preserves uploaded result without retry',async()=>{
 assert.equal(typeof m.importArtcraftMedia,'function');let uploads=0,labels=0;const asset={id:'asset-new',kind:'video'};
 const upload=async(file,rights)=>{uploads++;assert.equal(rights,'Artcraft: Tôi tự tạo.');return asset;},saveLabels=async input=>{labels++;assert.equal(input.expectedRevision,0);assert.equal(input.group,'Artcraft');throw Error('LABEL_FAILURE');};
 assert.equal(await m.importArtcraftMedia({file:null,rights:'',upload,saveLabels}),null);assert.equal(uploads,0);
 await assert.rejects(()=>m.importArtcraftMedia({file:{size:10,name:'a.mp4'},rights:'',upload,saveLabels}),/RIGHTS_REQUIRED/);
 const result=await m.importArtcraftMedia({file:{size:10,name:'a.mp4'},rights:'Tôi tự tạo.',upload,saveLabels});assert.equal(result.asset.id,asset.id);assert.equal(result.labelsSaved,false);assert.equal(uploads,1);assert.equal(labels,1);
 await assert.rejects(()=>m.importArtcraftMedia({file:{size:65*1024**2,name:'a.mp4'},rights:'Tôi tự tạo.',upload,saveLabels}),/ASSET_TOO_LARGE/);
 await assert.rejects(()=>m.importArtcraftMedia({file:{size:10,name:'a.wav'},rights:'Tôi tự tạo.',upload,saveLabels}),/ARTCRAFT_MEDIA_TYPE/);
});
