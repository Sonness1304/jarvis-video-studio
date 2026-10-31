import test from 'node:test';import assert from 'node:assert/strict';
const m=await import('../web/artcraft.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
function fixture({importer}={}){
 const old=globalThis.document,oldConfirm=globalThis.confirm,nodes=new Map();
 class Element{constructor(){this.children=[];this.value='';this.open=false;this.textContent='';this.files=[];}insertAdjacentHTML(_,html){for(const match of html.matchAll(/id="([^"]+)"/g))nodes.set(match[1],new Element());}append(...v){this.children.push(...v);}replaceChildren(...v){this.children=v;}addEventListener(){}showModal(){this.open=true;}close(){this.open=false;}focus(){}querySelectorAll(){return this.children.flatMap(c=>c.children).filter(c=>c.type==='checkbox'&&c.checked);}}
 nodes.set('media-library',new Element());globalThis.document={body:new Element(),getElementById:id=>nodes.get(id),createElement:()=>new Element()};globalThis.confirm=()=>true;
 const state={draft:{id:'proj',title:'Dự án',scenes:[{id:'first',title:'<img src=x>',visual:'diagram',phrases:[{text:'Lời đầu'}]}]},selected:0};
 let imports=0,dirtyEvents=0;const ui=m.initArtcraft({getState:()=>state,getAssets:()=>[],onImport:async()=>{imports++;return importer?await importer():{asset:{id:'asset-ok'},labelsSaved:true};},openLibrary(){}});ui.onDirtyChange(()=>dirtyEvents++);
 return {nodes,state,ui,get imports(){return imports;},get dirtyEvents(){return dirtyEvents;},restore(){globalThis.document=old;if(oldConfirm===undefined)delete globalThis.confirm;else globalThis.confirm=oldConfirm;}};
}
test('Artcraft UI preserves edited snapshot, signals stale context and never edits project',()=>{
 assert.equal(typeof m.initArtcraft,'function');const f=fixture();try{
  f.nodes.get('artcraft-open').onclick();assert.equal(f.nodes.get('artcraft-dialog').open,true);assert.match(f.nodes.get('artcraft-source').textContent,/<img src=x>/);
  const before=JSON.stringify(f.state.draft);f.nodes.get('artcraft-action').value='Một giọt nước rung nhẹ.';f.nodes.get('artcraft-action').oninput();assert(f.ui.hasUnsavedEdits());assert(f.dirtyEvents>0);assert.equal(JSON.stringify(f.state.draft),before);
  f.state.draft.scenes[0].title='Cảnh khác';f.ui.update();assert.equal(f.nodes.get('artcraft-stale').hidden,false);assert.match(f.nodes.get('artcraft-preview').value,/<img src=x>/);
  globalThis.confirm=()=>false;f.nodes.get('artcraft-close').onclick();assert.equal(f.nodes.get('artcraft-dialog').open,true);
  globalThis.confirm=()=>true;f.nodes.get('artcraft-refresh').onclick();assert.match(f.nodes.get('artcraft-source').textContent,/Cảnh khác/);assert.equal(f.nodes.get('artcraft-stale').hidden,true);
 }finally{f.restore();}
});
test('busy import keeps dialog open until completion; cancel has already returned without reset',async()=>{
 let finish;const pending=new Promise(resolve=>finish=resolve),f=fixture({importer:()=>pending});try{
  f.nodes.get('artcraft-open').onclick();f.nodes.get('artcraft-file').files=[{name:'a.mp4',size:10}];f.nodes.get('artcraft-rights').value='QA';
  const action=f.nodes.get('artcraft-file').onchange();f.nodes.get('artcraft-close').onclick();assert.equal(f.nodes.get('artcraft-dialog').open,true);assert.equal(f.imports,1);
  finish({asset:{id:'asset-committed'},labelsSaved:false});await action;assert.match(f.nodes.get('artcraft-status').textContent,/file vẫn giữ/);assert.equal(f.nodes.get('artcraft-file').disabled,false);f.nodes.get('artcraft-close').onclick();assert.equal(f.nodes.get('artcraft-dialog').open,false);
 }finally{f.restore();}
});
test('a pending clipboard promise cannot mark later edits clean',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');let finish;const pending=new Promise(resolve=>finish=resolve),f=fixture();
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>pending}}});try{
  f.nodes.get('artcraft-open').onclick();f.nodes.get('artcraft-action').value='Bản đầu';f.nodes.get('artcraft-action').oninput();const copying=f.nodes.get('artcraft-copy').onclick();
  f.nodes.get('artcraft-action').value='Bản sửa sau khi bấm copy';f.nodes.get('artcraft-action').oninput();finish();await copying;assert.equal(f.ui.hasUnsavedEdits(),true);
 }finally{f.restore();if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
test('cancelled Artcraft file picker does not upload or affect normal media input',async()=>{
 assert.equal(typeof m.initArtcraft,'function');const f=fixture();try{
  f.nodes.get('artcraft-open').onclick();const input=f.nodes.get('artcraft-file');await input.onchange();assert.equal(f.imports,0);
  input.files=[{name:'result.mp4',size:10}];f.nodes.get('artcraft-rights').value='Tôi tự tạo và có quyền dùng.';await input.onchange();assert.equal(f.imports,1);assert.match(f.nodes.get('artcraft-status').textContent,/asset-ok/);assert.equal(input.value,'');
 }finally{f.restore();}
});
