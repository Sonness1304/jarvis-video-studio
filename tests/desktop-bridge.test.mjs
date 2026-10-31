import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {savedDraftState} from '../web/model.mjs';
const m=await import('../web/desktop-bridge.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
test('native draft publisher has one fixed schema, initialfalse, OR truth table and duplicate suppression',()=>{
 assert.equal(typeof m.publishDesktopDirty,'function');const out=[],send=x=>out.push(x);assert.equal(m.publishDesktopDirty({},send),false);m.publishDesktopDirty({},send);assert.deepEqual(out,[{type:'studio-dirty',dirty:false}]);
 for(let bits=1;bits<8;bits++){assert.equal(m.publishDesktopDirty({draftDirty:!!(bits&1),contentDirty:!!(bits&2),captionDirty:!!(bits&4),secret:'not forwarded'},send),true);}assert.equal(out.length,2);assert.deepEqual(Object.keys(out[1]),['type','dirty']);m.publishDesktopDirty({},send);assert.equal(out.length,3);assert.doesNotThrow(()=>m.publishDesktopDirty({captionDirty:true}));
});
test('a delayed save cannot publish clean when a newer draft or unapplied board still exists',()=>{
 const original={id:'project',title:'A'},current={...original,title:'C'},record={revision:1,brief:original},snapshot={...original,title:'B'},response={revision:2,brief:snapshot},state=savedDraftState(record,current,snapshot,response),out=[];
 assert.equal(m.publishDesktopDirty({draftDirty:state.dirty},v=>out.push(v)),true);assert.equal(m.publishDesktopDirty({draftDirty:false,contentDirty:true},v=>out.push(v)),true);assert.equal(m.publishDesktopDirty({draftDirty:false,captionDirty:true},v=>out.push(v)),true);assert.equal(m.publishDesktopDirty({draftDirty:JSON.stringify(response.brief)!==JSON.stringify(snapshot)},v=>out.push(v)),false);
});
test('both boards expose dirty notification and editor uses exact draft comparison, served only in session',()=>{
 const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8'),p75=read('web/p75.mjs'),p78=read('web/p78.mjs'),editor=read('web/editor.mjs'),server=read('src/editor-server.mjs');for(const s of [p75,p78]){assert.ok(s.includes('hasUnsavedEdits'));assert.ok(s.includes('onDirtyChange'));}assert.ok(editor.includes('publishDesktopDirty'));assert.ok(editor.includes('JSON.stringify(project.brief)'));assert.ok(server.includes('/desktop-bridge.mjs'));
});
test('desktop reconnect refreshes session before bootstrap without replaying edits or jobs',async()=>{
 assert.equal(typeof m.refreshDesktopBootstrap,'function');const calls=[];
 const boot=await m.refreshDesktopBootstrap(async(url,options)=>{calls.push([url,options?.method??'GET']);return {ok:true,json:async()=>({csrf:'fresh',serverIdentity:{appId:'jarvis-video-studio'}})};});
 assert.equal(boot.csrf,'fresh');assert.deepEqual(calls,[['/','GET'],['/api/bootstrap','GET']]);
 await assert.rejects(m.refreshDesktopBootstrap(async()=>({ok:false})),/DESKTOP_RECONNECT_FAILED/);
});
