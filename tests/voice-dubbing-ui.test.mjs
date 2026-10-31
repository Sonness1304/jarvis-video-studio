import test from 'node:test';import assert from 'node:assert/strict';
import {initVoiceDubbing} from '../web/voice-dubbing.mjs';import {dubbingSignature} from '../web/dubbing-model.mjs';
const voices=[{label:'Voice A',identity:{provider:'vieneu',voiceId:'A'}},{label:'Voice B',identity:{provider:'vieneu',voiceId:'B'}}];
test('saved dubbing shows the stored voice and replays its exact selected take after reopen and undo',async t=>{
 const before=globalThis.document,elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',_html:'',set innerHTML(v){this._html=v;if(id==='dub-voice')this.value='0';},get innerHTML(){return this._html;},showModal(){},close(){}});return elements.get(id);};globalThis.document={body:{insertAdjacentHTML(){}},getElementById:element};t.after(()=>{globalThis.document=before;});
 const doc={schemaVersion:1,id:'dub-11111111-1111-4111-8111-111111111111',sourceAssetId:'asset-test',sourceHash:'a'.repeat(64),duration:5,voice:voices[1].identity,segments:[{id:'segment-one',start:0,end:3,sourceText:'hello',targetText:'Xin chào'}]};doc.segments[0].selection={jobId:'job-saved-take',signature:dubbingSignature(doc,doc.segments[0])};const record={revision:1,doc};
 const api=async url=>url==='/api/assets'?[]:url==='/api/dubbing'?[record]:structuredClone(record);
 const ui=initVoiceDubbing({api,act:fn=>fn,message(){},boot:{voices:[{name:'A'}]},getVoices:()=>voices});await ui.open();element('dub-saved').value=doc.id;await element('dub-load').onclick();
 assert.equal(element('dub-voice').value,'1');assert.match(element('dub-segments').innerHTML,/\/api\/artifacts\/job-saved-take\/audio/);
 element('dub-voice').value='0';element('dub-voice').onchange();assert.equal(element('dub-voice').value,'0');element('dub-undo').onclick();assert.equal(element('dub-voice').value,'1');assert.match(element('dub-segments').innerHTML,/job-saved-take\/audio/);
 await ui.open();assert.equal(element('dub-voice').value,'1');record.doc.voice={provider:'vieneu',voiceId:'unavailable'};await element('dub-load').onclick();assert.equal(element('dub-voice').value,'unavailable');assert.doesNotMatch(element('dub-segments').innerHTML,/job-saved-take\/audio/);
});
test('failed ASR replaces processing text with the terminal error inside the dialog',async t=>{
 const before=globalThis.document,elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',showModal(){},close(){}});return elements.get(id);};globalThis.document={body:{insertAdjacentHTML(){}},getElementById:element};t.after(()=>{globalThis.document=before;});
 const record={revision:1,doc:{schemaVersion:1,id:'dub-11111111-1111-4111-8111-111111111111',sourceAssetId:'asset-test',sourceHash:'a'.repeat(64),duration:5,voice:voices[0].identity,segments:[]}};
 const api=async (url,options)=>url==='/api/assets'?[]:url==='/api/dubbing'?[record]:url.endsWith('/transcribe')?{status:'FAILED',error:'VOICE_RAM_GATE_4GIB'}:options?.method==='POST'?{revision:2,doc:options.data.doc}:structuredClone(record);
 const ui=initVoiceDubbing({api,act:fn=>fn,message(){},boot:{voices:[{name:'A'}]},getVoices:()=>voices});await ui.open();element('dub-saved').value=record.doc.id;await element('dub-load').onclick();
 await assert.rejects(element('dub-asr').onclick(),/VOICE_RAM_GATE_4GIB/);
 assert.match(element('dub-result').textContent,/VOICE_RAM_GATE_4GIB/);assert.doesNotMatch(element('dub-result').textContent,/Đang xử lý/);
});
