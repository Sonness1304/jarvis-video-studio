import test from 'node:test';import assert from 'node:assert/strict';
import {imageMotion,validateImageMotion,applyImageMotion} from '../web/image-motion.mjs';
import {newBrief} from '../src/studio.mjs';import {canonicalBrief} from '../src/editor-store.mjs';
import {buildTimeline,toSrt} from '../src/core.mjs';import {renderHtml} from '../src/composition.mjs';import {seekCases} from '../src/qa-seek.mjs';
const brief=()=>{const b=newBrief({template:'listicle',theme:'editorial',voice:'Hải Đăng',id:'motion-test'},[{name:'Hải Đăng',aliases:[]}]);b.scenes=b.scenes.slice(0,1);Object.assign(b.scenes[0],{visual:'media',media:{kind:'image',path:'outputs/test/image.png',sha256:'a'.repeat(64)}});return b;};
test('optional motion roundtrips and leaves narration measured timing and subtitle unchanged',()=>{
 const b=brief(),audio=Object.fromEntries(b.scenes[0].phrases.map(p=>[p.id,{samples:96000,sampleRate:48000}])),before=buildTimeline(b,audio);
 b.scenes[0].media.motion={preset:'push-in',strength:'gentle'};const saved=canonicalBrief(b),after=buildTimeline(saved,audio);
 assert.deepEqual(after.scenes[0].media.motion,b.scenes[0].media.motion);assert.deepEqual(after.phrases,before.phrases);assert.equal(after.duration,before.duration);assert.equal(toSrt(after),toSrt(before));
 for(const motion of [null,[],{},'still',{preset:'push-in',strength:'fast'},{preset:'script',strength:'medium'},{preset:'still',strength:'medium',command:'x'}]){const bad=brief();bad.scenes[0].media.motion=motion;assert.throws(()=>canonicalBrief(bad),/INVALID_IMAGE_MOTION/);}
 const video=brief();video.scenes[0].media={kind:'video',path:'outputs/asset-test/media.mp4',sha256:'a'.repeat(64),start:0,end:2,motion:{preset:'still',strength:'medium'}};assert.throws(()=>canonicalBrief(video),/INVALID_IMAGE_MOTION/);
});
test('camera uses absolute clamped eased time with reversible seek and cover-safe pan in every strength',()=>{
 for(const strength of ['gentle','medium','strong'])for(const preset of ['still','push-in','pull-out','pan-left','pan-right']){
  const m={preset,strength};validateImageMotion(m);const a=imageMotion(m,0),mid=imageMotion(m,.5),z=imageMotion(m,1);
  assert.deepEqual(imageMotion(m,-2),a);assert.deepEqual(imageMotion(m,3),z);assert.deepEqual(imageMotion(m,.5),mid);
  for(const p of [0,.2,.5,.8,1]){const r=imageMotion(m,p);assert.ok(Number.isFinite(r.scale)&&r.scale>=1);assert.ok(Math.abs(r.x)<=50*(r.scale-1)+1e-9);assert.equal(r.y,0);}
  if(preset==='still')assert.deepEqual(a,z);else assert.notDeepEqual(a,z);
  if(preset==='push-in')assert.ok(z.scale>a.scale);if(preset==='pull-out')assert.ok(z.scale<a.scale);
  if(preset==='pan-left')assert.ok(z.x<a.x);if(preset==='pan-right')assert.ok(z.x>a.x);
 }
 assert.throws(()=>imageMotion({preset:'still',strength:'medium'},NaN),/INVALID_MOTION_PROGRESS/);
});
test('motion form applies one immutable media edit; default removes motion and preserves pins',()=>{
 const media=brief().scenes[0].media,copy=structuredClone(media);
 const next=applyImageMotion(media,'pan-left','strong','contain');assert.deepEqual(media,copy);assert.equal(next.fit,'contain');assert.equal(next.sha256,copy.sha256);
 assert.deepEqual(next.motion,{preset:'pan-left',strength:'strong'});assert.equal(applyImageMotion(next,'default','medium','cover').motion,undefined);
 assert.throws(()=>applyImageMotion({...media,kind:'video'},'still','medium','cover'),/INVALID_IMAGE_MOTION/);
});
test('composition shares camera function and visible scene bounds; legacy and still seek gates stay distinct',()=>{
 const b=brief(),audio=Object.fromEntries(b.scenes[0].phrases.map(p=>[p.id,{samples:96000,sampleRate:48000}]));
 for(const format of ['portrait','landscape','square']){b.format=format;b.scenes[0].hold=2;b.scenes[0].media.motion={preset:'still',strength:'medium'};const t=buildTimeline(b,audio),html=renderHtml(t);
  assert.ok(html.includes(imageMotion.toString()));assert.ok(html.includes('"start":0'));assert.ok(html.includes('"end":'+t.duration));
  assert.equal(seekCases(t)[0].motionExpected,false);assert.ok(seekCases(t)[0].times.every(v=>v>=0&&v<t.duration));
  delete b.scenes[0].media.motion;assert.equal(seekCases(buildTimeline(b,audio))[0].motionExpected,true);
 }
});
