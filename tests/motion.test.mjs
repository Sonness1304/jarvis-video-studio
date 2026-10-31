import test from 'node:test';import assert from 'node:assert/strict';
import {motionState,timingBlocks} from '../src/motion.mjs';
const scene={id:'s',start:10,end:20};
const phrases=[{id:'a',sceneId:'s',start:10,end:12,waveform:[.1,.4,.9]},{id:'b',sceneId:'s',start:13,end:19,waveform:[.8,.2,.3]}];
test('wave follows the actual active phrase and gaps are silent',()=>{
 const a=motionState(scene,phrases,11),b=motionState(scene,phrases,15);
 assert.equal(a.activePhrase,0);assert.equal(b.activePhrase,1);assert.deepEqual(a.wave,[.1,.4,.9]);assert.deepEqual(b.wave,[.8,.2,.3]);
 assert.equal(a.waveProgress,.5);assert.equal(motionState(scene,phrases,12.5).activePhrase,-1);assert.ok(motionState(scene,phrases,12.5).wave.every(x=>x===0));
});
test('track positions retain true phrase lengths and pauses, including the scene end',()=>{
 assert.deepEqual(timingBlocks(scene,phrases),[{left:0,width:20},{left:30,width:60}]);
 assert.equal(motionState(scene,phrases,20).progress,1);assert.equal(motionState(scene,phrases,5).progress,0);
});
test('seek A B A is stateless while machine motion actually changes within a scene',()=>{
 const a=motionState(scene,phrases,11);motionState(scene,phrases,16);assert.deepEqual(a,motionState(scene,phrases,11));
 assert.notEqual(a.head,motionState(scene,phrases,11.5).head);assert.notEqual(a.paper,motionState(scene,phrases,11.5).paper);
 for(let time=10;time<=20;time+=.1){const m=motionState(scene,phrases,time);assert.ok(Math.abs(m.head)<=38);assert.ok(m.paper>=0&&m.paper<=18);}
});
