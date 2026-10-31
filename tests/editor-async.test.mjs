import test from 'node:test';import assert from 'node:assert/strict';
import {savedDraftState,artifactResponseCurrent} from '../web/model.mjs';
test('save acknowledgement cannot clear newer edit or overwrite another open project',()=>{
 const record={revision:1,brief:{id:'a',title:'sent'}},response={revision:2,brief:{id:'a',title:'sent'}};
 assert.deepEqual(savedDraftState(record,{id:'a',title:'edited'},record.brief,response),{apply:true,dirty:true});
 assert.equal(savedDraftState(record,record.brief,record.brief,response).dirty,false);
 assert.equal(savedDraftState({revision:1,brief:{id:'b'}},{id:'b'},record.brief,response).apply,false);
});
test('export fetch cannot replace edited or switched draft with stale measured timeline',()=>{
 const capture={generation:3,projectId:'a',request:2};assert.equal(artifactResponseCurrent(capture,{generation:4,projectId:'a',request:2}),false);
 assert.equal(artifactResponseCurrent(capture,{generation:3,projectId:'b',request:2}),false);assert.equal(artifactResponseCurrent(capture,{generation:3,projectId:'a',request:3}),false);assert.equal(artifactResponseCurrent(capture,capture),true);
});
