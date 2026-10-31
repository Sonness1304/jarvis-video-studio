import test from 'node:test';import assert from 'node:assert/strict';import {initMediaLibrary} from '../web/media-library.mjs';
// Minimal DOM port: tests exercise real handlers and asynchronous close ordering without a browser dependency.
function fixture({refresh=async()=>{},attach=()=>{},saveLabels=async()=>({revision:1})}={}){
 const nodes=new Map(),previous=globalThis.document,previousConfirm=globalThis.confirm,outside=[];
 class Element{
  constructor(id='',tag='div'){Object.assign(this,{id,tagName:tag,children:[],listeners:{},value:'',checked:false,open:false,textContent:'',innerHTML:''});}
  insertAdjacentHTML(_,html){for(const m of html.matchAll(/id="([^"]+)"/g))nodes.set(m[1],new Element(m[1]));for(const name of ['kind','usage'])if(nodes.has('media-desk-'+name))nodes.get('media-desk-'+name).value='all';if(nodes.has('media-desk-sort'))nodes.get('media-desk-sort').value='newest';}
  querySelector(){return new Element();}addEventListener(type,fn){this.listeners[type]=fn;}querySelectorAll(query){return query==='video,audio'?this.children.filter(c=>['video','audio'].includes(c.tagName)):[];}
  replaceChildren(...v){this.children=v;}append(...v){this.children.push(...v);}pause(){this.paused=true;}removeAttribute(name){delete this[name];}load(){this.loaded=true;}focus(){}showModal(){this.open=true;}close(){this.open=false;this.listeners.close?.();}
 }
 for(const id of ['media-library','music-player'])nodes.set(id,new Element(id));globalThis.document={body:new Element(),getElementById:id=>nodes.get(id),createElement:tag=>new Element('',tag)};
 const asset={id:'asset-video',kind:'video',name:'Clip',path:'outputs/asset-video/media.mp4',sha256:'a'.repeat(64),bytes:5,duration:1};
 const library=initMediaLibrary({getAssets:()=>[asset],getState:()=>({draft:{scenes:[]},selected:0}),attach,selectScene(){},refresh,saveLabels,message:t=>outside.push(t)});
 nodes.get('media-desk-origin').value='all';
 const $=id=>nodes.get(id);$('open-media-desk').onclick();$('media-desk-grid').onclick({target:{closest:()=>({dataset:{mediaSelect:asset.id}})}});
 return {$,outside,library,restore(){if(previous===undefined)delete globalThis.document;else globalThis.document=previous;if(previousConfirm===undefined)delete globalThis.confirm;else globalThis.confirm=previousConfirm;}};
}
test('a pending refresh cannot recreate a hidden decoder after the library has closed',async()=>{
 let resolve;const done=new Promise(r=>resolve=r),f=fixture({refresh:()=>done});try{
  assert.equal(f.$('media-desk-preview').children.length,1);const pending=f.$('media-desk-refresh').onclick();f.$('close-media-desk').onclick();assert.equal(f.$('media-desk-preview').children.length,0);resolve();await pending;
  assert.equal(f.$('media-desk').open,false);assert.equal(f.$('media-desk-preview').children.length,0);assert.equal(f.$('media-desk-refresh').disabled,false);
 }finally{f.restore();}
});
test('attach errors remain visible inside the open dialog and never announce success',async()=>{
 const f=fixture({attach:()=>{throw Error('STORYBOARD_ATTACH_ERROR');}});try{await f.$('media-desk-attach').onclick();assert.equal(f.$('media-desk').open,true);assert.match(f.$('media-desk-status').textContent,/STORYBOARD_ATTACH_ERROR/);assert.deepEqual(f.outside,[]);}finally{f.restore();}
});
test('a failed refresh keeps the loaded catalog and visibly explains the failure',async()=>{
 const f=fixture({refresh:async()=>{throw Error('NETWORK_FAILED');}});try{const before=f.$('media-desk-grid').innerHTML;await f.$('media-desk-refresh').onclick();assert.equal(f.$('media-desk-grid').innerHTML,before);assert.match(f.$('media-desk-status').textContent,/Chưa làm mới được/);assert.equal(f.$('media-desk-refresh').disabled,false);}finally{f.restore();}
});
test('cancelling a filter or close keeps the label draft and rendered catalog consistent',()=>{
 const f=fixture();try{globalThis.confirm=()=>false;f.$('media-label-group').value='Chưa lưu';f.$('media-label-group').oninput();assert.equal(f.library.hasUnsavedEdits(),true);
 const before=f.$('media-desk-grid').innerHTML;f.$('media-desk-kind').value='image';f.$('media-desk-kind').onchange();assert.equal(f.$('media-desk-kind').value,'all');assert.equal(f.$('media-desk-grid').innerHTML,before);
 f.library.updated();assert.equal(f.$('media-label-group').value,'Chưa lưu');f.$('close-media-desk').onclick();assert.equal(f.$('media-desk').open,true);globalThis.confirm=()=>true;f.$('close-media-desk').onclick();assert.equal(f.$('media-desk').open,false);assert.equal(f.library.hasUnsavedEdits(),false);
 }finally{f.restore();}
});
test('saving labels pins exact ID and revision, blocks close while pending and keeps a failed draft',async()=>{
 let reject,payload;const pending=new Promise((_,r)=>reject=r),f=fixture({saveLabels:input=>{payload=input;return pending;}});try{f.$('media-label-tags').value='Robot, AI';const save=f.$('media-label-save').onclick();assert.deepEqual(payload,{id:'asset-video',expectedRevision:0,group:'',tags:['Robot','AI']});assert.equal(f.$('media-label-group').disabled,true);f.$('close-media-desk').onclick();assert.equal(f.$('media-desk').open,true);reject(Error('REVISION_CONFLICT'));await save;assert.equal(f.library.hasUnsavedEdits(),true);assert.equal(f.$('media-label-tags').value,'Robot, AI');assert.match(f.$('media-label-status').textContent,/phiên khác/);assert.equal(f.$('media-label-save').disabled,false);
 }finally{f.restore();}
});
test('refresh completion preserves labels typed after the request began',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r),f=fixture({refresh:()=>pending});try{const refresh=f.$('media-desk-refresh').onclick();f.$('media-label-group').value='Nhãn vừa nhập';f.$('media-label-group').oninput();resolve();await refresh;assert.equal(f.$('media-label-group').value,'Nhãn vừa nhập');assert.equal(f.library.hasUnsavedEdits(),true);}finally{f.restore();}
});
test('refresh completion cannot reset a pending label save',async()=>{
 let resolveRefresh,resolveSave;const pendingRefresh=new Promise(r=>resolveRefresh=r),pendingSave=new Promise(r=>resolveSave=r),f=fixture({refresh:()=>pendingRefresh,saveLabels:()=>pendingSave});try{const refresh=f.$('media-desk-refresh').onclick();f.$('media-label-group').value='Đang lưu';const save=f.$('media-label-save').onclick();resolveRefresh();await refresh;assert.equal(f.$('media-label-group').value,'Đang lưu');assert.equal(f.library.hasUnsavedEdits(),true);resolveSave({revision:1});await save;}finally{f.restore();}
});
test('an old refresh cannot recreate the detail decoder in a reopened library',async()=>{
 let resolve;const done=new Promise(r=>resolve=r),f=fixture({refresh:()=>done});try{const refresh=f.$('media-desk-refresh').onclick();f.$('close-media-desk').onclick();f.$('open-media-desk').onclick();const preview=f.$('media-desk-preview').children[0];resolve();await refresh;assert.equal(f.$('media-desk-preview').children[0],preview);}finally{f.restore();}
});
