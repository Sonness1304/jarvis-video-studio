import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import sharp from 'sharp';
const m=await import('../src/media-catalog.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
async function rootFixture(){const root=await fs.mkdtemp(path.join(os.tmpdir(),'catalog-v2-'));await fs.mkdir(path.join(root,'.runtime/studio/assets'),{recursive:true});await fs.mkdir(path.join(root,'outputs'));return root;}
test('catalog sees over 200 registered files plus verified AI images without importing copies',async()=>{
 assert.equal(typeof m.listMediaCatalog,'function');const root=await rootFixture();for(let n=0;n<205;n++){const id='asset-'+n;await fs.writeFile(path.join(root,'.runtime/studio/assets',id+'.json'),JSON.stringify({id,status:'VERIFIED',kind:'image',path:'outputs/'+id+'/media.png',sha256:'a'.repeat(64),bytes:10,name:'Ảnh '+n,createdAt:'2026-10-15T00:00:00Z'}));}
 const id='jarvis-11111111-1111-1111-1111-111111111111',dir=path.join(root,'outputs',id);await fs.mkdir(dir);const png=await sharp({create:{width:32,height:32,channels:3,background:'#224466'}}).png().toBuffer(),sha=createHash('sha256').update(png).digest('hex');await fs.writeFile(path.join(dir,'image.png'),png);await fs.writeFile(path.join(dir,'receipt.json'),JSON.stringify({status:'VERIFIED',kind:'image',image:{path:'outputs/'+id+'/image.png',sha256:sha},startedAtMs:1234}));
 const result=await m.listMediaCatalog(root);assert.equal(result.items.length,206);assert.equal(result.items.find(a=>a.id===id).origin,'ai');assert.equal(result.items.find(a=>a.id===id).width,32);assert.equal((await fs.readdir(path.join(root,'.runtime/studio/assets'))).length,205);
 await assert.rejects(m.readCatalogItem(root,'../outside'),/INVALID_MEDIA_ID/);assert.equal((await m.readCatalogItem(root,id)).sha256,sha);
});
test('media labels persist by exact ID, normalize tags, reject invalid input and compare-and-swap across instances',async()=>{
 assert.equal(typeof m.MediaLabels,'function');const root=await rootFixture(),one=new m.MediaLabels(root),two=new m.MediaLabels(root),id='asset-test';
 assert.deepEqual(await one.read(id),{revision:0,group:'',tags:[]});const input={expectedRevision:0,group:' Kênh AI ',tags:[' hình ảnh ','Robot']};const results=await Promise.allSettled([one.save(id,input),two.save(id,input)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/REVISION_CONFLICT/);assert.deepEqual(await new m.MediaLabels(root).read(id),{revision:1,group:'Kênh AI',tags:['hình ảnh','Robot']});
 for(const tags of [['AI','ai'],['x'.repeat(25)],Array(11).fill('a'),['bad\nvalue'],['one,two'],['../outside']])await assert.rejects(one.save(id,{expectedRevision:1,group:'',tags}),/INVALID_MEDIA_LABELS/);
 await assert.rejects(one.save('../bad',input),/INVALID_MEDIA_ID/);await assert.rejects(one.save(id,{...input,extra:true}),/INVALID_MEDIA_LABELS/);
});
test('corrupt latest label snapshot is preserved and never silently resets revisions',async()=>{
 const root=await rootFixture(),store=new m.MediaLabels(root),id='asset-corrupt';await store.save(id,{expectedRevision:0,group:'Đã lưu',tags:[]});const file=path.join(root,'.runtime/studio/media-labels',id,'00000002.json');await fs.writeFile(file,'{"revision":2');
 await assert.rejects(store.read(id),/MEDIA_LABELS_CORRUPT/);await assert.rejects(store.save(id,{expectedRevision:1,group:'ghi đè',tags:[]}),/MEDIA_LABELS_CORRUPT/);assert.equal(await fs.readFile(file,'utf8'),'{"revision":2');
});
