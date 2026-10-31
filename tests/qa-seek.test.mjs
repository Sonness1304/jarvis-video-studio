import test from 'node:test';import assert from 'node:assert/strict';import {seekCases} from '../src/qa-seek.mjs';
test('native seek schedule covers every scene A B A within the correct clip',()=>{
 const t={duration:20,scenes:[{id:'one',visual:'voice',start:.6,end:3},{id:'two',visual:'render',start:3,end:19}]};
 const cases=seekCases(t);assert.equal(cases.length,2);
 for(const [i,c] of cases.entries()){assert.equal(c.times[0],c.times[2]);assert.notEqual(c.times[0],c.times[1]);assert.ok(c.times.every(x=>x>=(i?3:0)&&x<(i?20:3)));}
});
