import test from 'node:test';import assert from 'node:assert/strict';
import {motionSequence,applySequence,captureSequence,sequenceCurrent,suggestMotionPreset,motionLabel} from '../web/motion-sequence.mjs';
import {newBrief} from '../src/studio.mjs';import {canonicalBrief} from '../src/editor-store.mjs';import {buildTimeline,toSrt} from '../src/core.mjs';import {DraftHistory} from '../web/model.mjs';
const image=i=>({id:'scene-'+i,title:'Cảnh '+i,visual:'media',media:{kind:'image',path:'outputs/test/image.png',sha256:'a'.repeat(64),fit:i%2?'contain':'cover'},phrases:[{id:'phrase-'+i,text:'Một câu chuyện bằng hình ảnh.'}]});
function brief(){const b=newBrief({template:'listicle',theme:'editorial',voice:'Hải Đăng',id:'sequence-test'},[{name:'Hải Đăng',aliases:[]}]);b.scenes=[image(0),image(1),image(2),image(3),{...image(4),media:{kind:'video',path:'outputs/asset-test/media.mp4',sha256:'b'.repeat(64),start:0,end:2}}, {...image(5),visual:'quote',media:undefined,content:{body:'Một ý rõ ràng.'}}];b.scenes[1].media.motion={preset:'still',strength:'gentle'};return b;}
const options={preset:'explain',energy:'medium',overwrite:false};
test('review preview distinguishes strength-only edits without changing the motion preset',()=>{const b=brief();b.scenes[0].media.motion={preset:'push-in',strength:'gentle'};const row=motionSequence(b,{...options,overwrite:true}).rows[0];assert.equal(row.status,'change');assert.equal(row.before.preset,row.after.preset);assert.notEqual(motionLabel(row.before),motionLabel(row.after));assert.match(motionLabel(row.before),/Êm/);assert.match(motionLabel(row.after),/Cân bằng/);});
test('sequence preserves explicit manual motion including still and assigns deterministic image positions',()=>{
 const b=brief(),copy=structuredClone(b),p=motionSequence(b,options);assert.equal(p.changes,3);assert.equal(p.images,4);assert.equal(p.protected,1);assert.equal(p.skipped,2);
 assert.deepEqual(p.rows.map(r=>r.status),['change','protected','change','change','skip','skip']);assert.equal(p.rows[2].after.preset,'pan-right');assert.equal(p.rows[3].after.preset,'still');assert.deepEqual(b,copy);assert.deepEqual(motionSequence(b,options),p);
});
test('explicit overwrite changes only image motion; repeat is idempotent and snapshot undo is atomic',()=>{
 const b=brief(),o={...options,preset:'story',energy:'strong',overwrite:true},after=applySequence(b,o);assert.equal(after.scenes[1].media.motion.preset,'pan-right');assert.equal(after.scenes[1].media.motion.strength,'strong');
 const strip=value=>{const c=structuredClone(value);for(const s of c.scenes)if(s.media)delete s.media.motion;return c;};assert.deepEqual(strip(after),strip(b));assert.equal(motionSequence(after,o).changes,0);assert.deepEqual(applySequence(after,o),after);
 const h=new DraftHistory(b);h.push(after);assert.deepEqual(h.undo(),b);assert.deepEqual(h.redo(),after);
});
test('every preset and energy roundtrip keeps WAV timing SRT and source identities',()=>{
 const b=brief(),audio=Object.fromEntries(b.scenes.flatMap(s=>s.phrases.map(p=>[p.id,{samples:96000,sampleRate:48000}]))),before=buildTimeline(b,audio);
 for(const preset of ['explain','story','product','social'])for(const energy of ['gentle','medium','strong']){const next=canonicalBrief(applySequence(b,{preset,energy,overwrite:true})),after=buildTimeline(next,audio);assert.equal(next.scenes[0].media.motion.strength,energy);assert.deepEqual(after.phrases,before.phrases);assert.equal(after.duration,before.duration);assert.equal(toSrt(after),toSrt(before));}
});
test('capture rejects edits reorder revision and project changes but ignores cursor selection and preview generation',()=>{
 const state={draft:brief(),project:{brief:{id:'sequence-test'},revision:2},selected:0,editGeneration:1},c=captureSequence(state);assert.ok(sequenceCurrent(c,state));assert.ok(sequenceCurrent(c,{...state,selected:4,editGeneration:99}));
 for(const mutate of [s=>s.draft.scenes.reverse(),s=>s.draft.scenes[4].media.start=.5,s=>s.draft.scenes[0].phrases[0].text+=' mới',s=>s.project.revision++,s=>s.project.brief.id='other']){const s=structuredClone(state);mutate(s);assert.equal(sequenceCurrent(c,s),false);}
 assert.equal(sequenceCurrent(c,{draft:null,project:null}),false);
});
test('empty or non-image project has no changes and unsupported controls are rejected',()=>{
 const b=brief();b.scenes=b.scenes.slice(4);assert.equal(motionSequence(b,options).changes,0);assert.deepEqual(applySequence(b,options),b);
 for(const bad of [{...options,preset:'constructor'},{...options,energy:'fast'},{...options,overwrite:'false'}])assert.throws(()=>motionSequence(brief(),bad),/INVALID_SEQUENCE_OPTIONS/);
 for(const p of ['explain','story','product','social'])assert.equal(suggestMotionPreset({preset:p}),p);assert.equal(suggestMotionPreset({preset:'unknown'}),'explain');
});
