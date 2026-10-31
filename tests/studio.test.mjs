import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {catalog,readVoices,canonicalVoice,newBrief,writeNewBrief} from '../src/studio.mjs';
import {validateBrief,buildTimeline,audioCacheKey} from '../src/core.mjs';
const root=new URL('../',import.meta.url);
test('real preset catalog returns selectable metadata without embeddings or speaker codes',async()=>{
 const voices=await readVoices(root);assert.equal(voices.length,25);
 assert.ok(voices.some(v=>v.name==='Thục Đoan'&&v.region==='Nam'));
 assert.ok(!JSON.stringify(voices).includes('speaker_emb'));assert.ok(!JSON.stringify(voices).includes('codes'));
 const bank=[{name:'Hải Đăng',aliases:['Minh Quân']}];assert.equal(canonicalVoice('Minh Quân',bank),'Hải Đăng');
 assert.equal(audioCacheKey('Chào',{voice:canonicalVoice('Minh Quân',bank)}),audioCacheKey('Chào',{voice:canonicalVoice('Hải Đăng',bank)}));
 assert.throws(()=>canonicalVoice('made-up',bank),/UNKNOWN_PRESET_VOICE/);
});
test('authoring validates content template theme and canonical voice before runtime',async()=>{
 const voices=await readVoices(root);assert.equal(catalog.templates.length,11);assert.equal(catalog.themes.length,12);
 const b=newBrief({template:'story-short',theme:'paper-story',voice:'Thục Đoan',id:'story-demo'},voices);
 assert.equal(validateBrief(b).theme,'paper-story');assert.equal(b.preset,'story');assert.ok(b.scenes.length>=3);
 const audio=Object.fromEntries(b.scenes.flatMap(s=>s.phrases.map(p=>[p.id,{samples:48000,sampleRate:48000}])));
 assert.equal(buildTimeline(b,audio).theme,'paper-story');
 for(const key of ['template','theme','voice','id'])assert.throws(()=>newBrief({template:'story-short',theme:'paper-story',voice:'Thục Đoan',id:'story-demo',[key]:'<bad>'},voices));
 assert.throws(()=>validateBrief({...b,theme:'unknown'}),/INVALID_THEME/);
});
test('new brief cannot overwrite user file or escape root',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'studio-new-')),voices=await readVoices(root);
 const b=newBrief({template:'explain-short',theme:'editorial',voice:'Hải Đăng',id:'intro'},voices);
 await writeNewBrief(dir,'intro.json',b);await assert.rejects(writeNewBrief(dir,'intro.json',b),/EEXIST/);
 assert.equal(JSON.parse(await fs.readFile(path.join(dir,'intro.json'),'utf8')).id,'intro');
 await assert.rejects(writeNewBrief(dir,'../escape.json',b),/PATH_OUTSIDE_ROOT/);
});
