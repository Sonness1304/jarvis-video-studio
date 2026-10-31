import test from 'node:test';import assert from 'node:assert/strict';
import {pronounce,validateVoiceWorkbench,phraseVoice,voiceSignature,topicHints,pruneVoiceTargets} from '../web/voice-model.mjs';
import {canonicalBrief} from '../src/editor-store.mjs';
const b={schemaVersion:1,id:'test',title:'Test',preset:'story',voice:'Hải Đăng',accent:'#3569cc',scenes:[{id:'scene',title:'Cảnh',visual:'script',phrases:[{id:'phrase',text:'AI và Việt Nam'}]}]};
test('dictionary is Unicode whole token literal case-sensitive longest first nonrecursive; override wins',()=>{
 const d=[{from:'AI',to:'Ây ai'},{from:'Việt Nam',to:'Việt Nam đẹp'},{from:'đẹp',to:'hay'}];
 assert.equal(pronounce('AI Việt Nam xAI AIx ai',d),'Ây ai Việt Nam đẹp xAI AIx ai');assert.equal(pronounce('AI',d,'cách riêng'),'cách riêng');
 assert.throws(()=>pronounce('AI',[{from:'AI',to:'x'.repeat(241)}]),/VOICE_DICTIONARY/);
});
test('topic hints are suggestions; explicit per-scene voice overrides and legacy remains unchanged',()=>{
 assert.ok(topicHints.science);assert.equal(phraseVoice(b,b.scenes[0]).voiceId,'Hải Đăng');
 const next=structuredClone(b);next.voiceWorkbench={schemaVersion:1,topic:'science',dictionary:[],sceneVoices:{scene:{provider:'vieneu',voiceId:'Thục Đoan'}},selections:{}};
 assert.equal(phraseVoice(next,next.scenes[0]).voiceId,'Thục Đoan');assert.deepEqual(canonicalBrief(next),next);assert.deepEqual(canonicalBrief(b),b);
});
test('signature changes on effective speech, voice or profile revision but caption presentation does not',()=>{
 const p=b.scenes[0].phrases[0],s=b.scenes[0];const sig=voiceSignature(b,s,p);
 assert.equal(sig,voiceSignature(b,s,{...p,caption:{text:'caption only'}}));assert.notEqual(sig,voiceSignature(b,s,{...p,speechText:'Đọc khác'}));
 const next=structuredClone(b);next.voiceWorkbench={schemaVersion:1,defaultVoice:{provider:'profile',voiceId:'profile-11111111-1111-4111-8111-111111111111',revision:1}};const a=voiceSignature(next,s,p);next.voiceWorkbench.defaultVoice.revision=2;assert.notEqual(a,voiceSignature(next,s,p));
});
test('invalid fields, unknown scene, unsafe selectors and unbounded dictionary are rejected',()=>{
 for(const value of [{schemaVersion:1,evil:1},{schemaVersion:1,dictionary:Array(101).fill({from:'x',to:'y'})},{schemaVersion:1,selections:{phrase:{jobId:'../../evil',signature:'x'}}},{schemaVersion:1,sceneVoices:{missing:{provider:'vieneu',voiceId:'Hải Đăng'}}}])assert.throws(()=>validateVoiceWorkbench(value,b.scenes));
});
test('valid full dictionary does not overflow take signature and unused mappings keep same spoken identity',()=>{
 const next=structuredClone(b);next.voiceWorkbench={schemaVersion:1,dictionary:Array.from({length:100},(_,i)=>({from:'unused'+i,to:'x'.repeat(240)}))};assert.ok(voiceSignature(next,next.scenes[0],next.scenes[0].phrases[0]).length<2048);assert.equal(voiceSignature(next,next.scenes[0],next.scenes[0].phrases[0]),voiceSignature(b,b.scenes[0],b.scenes[0].phrases[0]));
});
test('removing a scene or phrase prunes only orphan voice references and preserves Undo input',()=>{
 const next=structuredClone(b);next.voiceWorkbench={schemaVersion:1,sceneVoices:{scene:{provider:'vieneu',voiceId:'Hải Đăng'},gone:{provider:'vieneu',voiceId:'Thục Đoan'}},selections:{gone:{jobId:'job-old',signature:'old'}}};const clean=pruneVoiceTargets(next);assert.ok(next.voiceWorkbench.sceneVoices.gone);assert.equal(clean.voiceWorkbench.sceneVoices.gone,undefined);assert.ok(clean.voiceWorkbench.sceneVoices.scene);assert.deepEqual(clean.voiceWorkbench.selections,{});canonicalBrief(clean);
});
