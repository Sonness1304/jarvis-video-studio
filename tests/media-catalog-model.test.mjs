import test from 'node:test';import assert from 'node:assert/strict';import * as m from '../web/media-library-model.mjs';
const a={id:'asset-a',name:'Ảnh',kind:'image',path:'outputs/a',sha256:'a'.repeat(64),bytes:10,createdAt:'2026-10-15',group:'Kênh AI',tags:['Robot']},b={...a,id:'asset-b',path:'outputs/b',group:'Khác',tags:['Cũ']},c={...a,id:'jarvis-11111111-1111-1111-1111-111111111111',path:'outputs/c',sha256:'b'.repeat(64),origin:'ai'};
test('display duplicates retain every alias and aggregate exact current-draft references',()=>{
 assert.equal(typeof m.catalogPage,'function');const draft={scenes:[{id:'s',title:'Cảnh',visual:'media',media:{path:b.path,sha256:b.sha256}}]},result=m.catalogPage([a,b,c],{draft,pageSize:24});assert.equal(result.total,2);assert.equal(result.items.find(x=>x.sha256===a.sha256).copies.length,2);assert.equal(m.assetReferences(result.items.find(x=>x.sha256===a.sha256),draft).length,1);
 const tagged=m.catalogPage([a,b,c],{group:'Khác'});assert.equal(tagged.total,1);assert.equal(tagged.items[0].id,b.id);assert.equal(m.catalogPage([a,b,c],{dedupe:false}).total,3);
});
test('catalog filters all records before paging, resets bounds and typed AI URLs cannot escape scope',()=>{
 assert.equal(typeof m.catalogPage,'function');const assets=Array.from({length:51},(_,i)=>({...a,id:'asset-'+String(i).padStart(3,'0'),sha256:i.toString(16).padStart(64,'0')}));const page=m.catalogPage(assets,{page:2,pageSize:24,sort:'name'});assert.equal(page.items.length,24);assert.equal(page.pages,3);assert.equal(m.catalogPage(assets,{page:9}).page,3);assert.equal(m.catalogPage(assets,{query:'absent'}).page,1);assert.equal(m.catalogPage([a,c],{origin:'ai',tag:'robot'}).total,1);
 assert.equal(m.assetUrl(c),'/api/images/'+c.id);assert.throws(()=>m.assetUrl({...c,id:'jarvis-../evil'}),/INVALID_ASSET_ID/);
});
