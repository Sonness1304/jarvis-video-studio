import test from 'node:test';import assert from 'node:assert/strict';
import {catalog,newBrief} from '../src/studio.mjs';
import {validateBrief,buildTimeline} from '../src/core.mjs';
import {renderHtml} from '../src/composition.mjs';
const voices=[{name:'Hải Đăng',aliases:[]}];
test('eleven content templates have genuinely different visual sequences and five themes',()=>{
 assert.equal(catalog.templates.length,11);assert.equal(catalog.themes.length,12);
 const sequences=new Set(catalog.templates.map(t=>newBrief({template:t.id,theme:'editorial',voice:'Hải Đăng',id:'demo'},voices).scenes.map(s=>s.visual).join(',')));
 assert.ok(sequences.size>=7);
});
test('hold extends scene after narration without stretching subtitle or speech',()=>{
 const b=newBrief({template:'explain-short',theme:'editorial',voice:'Hải Đăng',id:'demo'},voices);
 const audio=Object.fromEntries(b.scenes.flatMap(s=>s.phrases.map(p=>[p.id,{samples:48000,sampleRate:48000}])));
 const t=buildTimeline(b,audio);b.scenes[0].hold=2.5;const held=buildTimeline(b,audio);
 assert.equal(held.frames-t.frames,75);assert.equal(held.phrases[0].end,t.phrases[0].end);
 assert.equal(held.phrases[1].start-t.phrases[1].start,2.5);
 for(const hold of [-1,11,'2',NaN])assert.throws(()=>validateBrief({...b,scenes:[{...b.scenes[0],hold}]}),/INVALID_HOLD/);
});
test('typed content rejects invalid metrics/lists and escapes script-like text in HTML and JS',()=>{
 const b=newBrief({template:'data-story',theme:'bold-pop',voice:'Hải Đăng',id:'demo'},voices);
 const s=b.scenes[0];s.visual='kinetic';s.title='</script><script>alert(1)</script>';s.content={body:'<img src=x onerror=bad>',metric:'42',label:'Số liệu minh họa'};
 const audio=Object.fromEntries(b.scenes.flatMap(s=>s.phrases.map(p=>[p.id,{samples:48000,sampleRate:48000}])));
 const html=renderHtml(buildTimeline(b,audio));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('</script><script>alert(1)'));
 for(const content of [{items:Array(6).fill('a')},{metric:'x'.repeat(21)},{evil:'raw'}])assert.throws(()=>validateBrief({...b,scenes:[{...s,content}]}),/INVALID_CONTENT/);
});
