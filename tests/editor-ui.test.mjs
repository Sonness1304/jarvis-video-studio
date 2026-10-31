import test from 'node:test';import assert from 'node:assert/strict';
import {DraftHistory,reorderScene,duplicateScene,removeScene,waveformGeometry,batchVariants} from '../web/model.mjs';
import {execFileSync} from 'node:child_process';
test('browser entrypoint parses before it is served',()=>{execFileSync(process.execPath,['--check',new URL('../web/editor.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],{windowsHide:true});});
const b={scenes:[{id:'a',phrases:[{id:'p-a',text:'a'}]},{id:'b',phrases:[{id:'p-b',text:'b'}]}]};
test('scene edits are immutable, duplicate uses distinct phrase IDs, remove preserves last scene',()=>{
 const moved=reorderScene(b,0,1);assert.equal(moved.scenes[0].id,'b');assert.equal(b.scenes[0].id,'a');
 const copied=duplicateScene(b,0,'copy');assert.equal(copied.scenes.length,3);assert.notEqual(copied.scenes[1].phrases[0].id,b.scenes[0].phrases[0].id);
 assert.throws(()=>removeScene({scenes:[b.scenes[0]]},0),/LAST_SCENE/);assert.throws(()=>reorderScene(b,0,9),/INVALID_SCENE_INDEX/);
});
test('undo redo handles new branch and bounds fifty states',()=>{
 const history=new DraftHistory(b);history.push(reorderScene(b,0,1));assert.equal(history.undo().scenes[0].id,'a');assert.equal(history.redo().scenes[0].id,'b');
 history.undo();history.push(duplicateScene(b,0,'new'));assert.equal(history.canRedo,false);for(let i=0;i<70;i++)history.push({...b,title:String(i)});assert.ok(history.states.length<=50);
});
test('waveform uses measured PCM bins at phrase offsets and never invents draft amplitudes',()=>{
 assert.deepEqual(waveformGeometry(null),[]);const bins=waveformGeometry({duration:4,phrases:[{start:1,end:3,waveform:[0,.5,1]}]});assert.equal(bins.length,3);assert.equal(bins[0].x,250);assert.ok(Math.abs(bins[2].x-583.333333)<.001);assert.ok(Math.abs(bins[0].width-166.666667)<.001);assert.deepEqual(bins.map(b=>b.amplitude),[0,.5,1]);
});
test('batch variant choices explicit, unique and bounded twelve',()=>{
 assert.deepEqual(batchVariants(['portrait','square'],['editorial']),[{format:'portrait',theme:'editorial'},{format:'square',theme:'editorial'}]);assert.throws(()=>batchVariants([],['editorial']),/INVALID_VARIANTS/);assert.throws(()=>batchVariants(['portrait','landscape','square'],['a','b','c','d','e']),/INVALID_VARIANTS/);
});
test('voice previews and ASR jobs only offer artifacts they actually produce',async()=>{
 const {jobOutputKind}=await import('../web/model.mjs');
 assert.equal(jobOutputKind({kind:'voice-workbench'}),'audio');assert.equal(jobOutputKind({kind:'voice'}),'audio');
 assert.equal(jobOutputKind({kind:'dubbing',request:{action:'transcribe'}}),'transcript');
 assert.equal(jobOutputKind({kind:'dubbing',request:{action:'export'}}),'dubbing-video');assert.equal(jobOutputKind({kind:'export'}),'video');
});

test('translation and speaker suggestions are data, never links to nonexistent MP4',async()=>{const {jobOutputKind}=await import('../web/model.mjs');for(const action of ['translate','speakers'])assert.equal(jobOutputKind({kind:'dubbing',request:{action}}),'transcript');});
