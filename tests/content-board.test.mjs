import test from 'node:test';import assert from 'node:assert/strict';
import {boardFromCandidate,applyBoard,encodeBoard,restoreBoard,cacheBoard,boardIssue,attemptMatchesTarget,recordBoardInput} from '../web/content-board.mjs';
import {captureContentTarget,contentBoardFromDraft} from '../web/content-model.mjs';import {newBrief} from '../src/studio.mjs';
const brief=()=>newBrief({template:'listicle',theme:'editorial',voice:'Hải Đăng',id:'board-test'},[{name:'Hải Đăng',aliases:[]}]);
const candidate={schemaVersion:1,title:'Bản gợi ý',scenes:['hook','explain','conclusion'].map(role=>({role,title:'Ý mới',narration:['Lời mới'],layout:'kinetic',content:{},reason:'Rõ ý',needsInput:[]}))};
test('candidate maps ordinary scene IDs only and retains protected scenes and old extras',()=>{
 const b=brief();b.scenes[0].visual='media';b.scenes[0].media={kind:'image',path:'outputs/test/image.png',sha256:'a'.repeat(64)};
 const board=boardFromCandidate(b,candidate);assert.notEqual(board.items[0].targetSceneId,b.scenes[0].id);const state={project:{brief:b,revision:1},draft:b},capture=captureContentTarget(state),result=applyBoard(capture,state,board);
 assert.deepEqual(result.scenes[0],b.scenes[0]);assert.ok(result.scenes.length>=b.scenes.length);assert.equal(result.scenes[1].title,'Ý mới');
 board.items.forEach(x=>x.accept=false);board.title=b.title;assert.deepEqual(applyBoard(capture,state,board),b);
});
test('stale target rejects the entire apply without mutating either candidate or draft',()=>{
 const b=brief(),state={project:{brief:b,revision:1},draft:b},capture=captureContentTarget(state),board=boardFromCandidate(b,candidate),before=structuredClone(board);state.draft={...b,title:'Bản khác'};
 assert.throws(()=>applyBoard(capture,state,board),/CONTENT_STALE/);assert.deepEqual(board,before);assert.equal(state.draft.title,'Bản khác');
});
test('restored patch cache is bounded, project/hash scoped, strict and survives quota failure in memory',()=>{
 const b=brief(),board=contentBoardFromDraft(b),v={projectId:b.id,revision:1,baseHash:'a'.repeat(64),attemptId:null,board};
 const source=encodeBoard(v);assert.deepEqual(restoreBoard(source,b.id),JSON.parse(source));assert.throws(()=>restoreBoard(source,'foreign'));assert.throws(()=>restoreBoard('{',b.id));
 for(const mutate of [v=>v.command='x',v=>v.board.items[0].command='x',v=>v.baseHash='bad',v=>v.board.items[0].narration=['x'.repeat(241)]]){const value=structuredClone(v);mutate(value);assert.throws(()=>restoreBoard(JSON.stringify(value),b.id));}
 assert.equal(cacheBoard({setItem(){throw Error('QUOTA');}},'test',v).persisted,false);assert.deepEqual(v.board,board);
 board.items[0].layout='metric';board.items[0].content={};assert.match(boardIssue(board.items[0]),/số liệu/);board.items[0].accept=false;assert.equal(boardIssue(board.items[0]),'');
});

test('both read and reconcile require attempt project, revision and original draft hash',()=>{
 const target={projectId:'board-test',revision:2,baseHash:'a'.repeat(64)},a={projectId:'board-test',projectRevision:2,draftHash:'a'.repeat(64)};assert.equal(attemptMatchesTarget(a,target),true);
 for(const patch of [{projectId:'other'},{projectRevision:1},{draftHash:'0'.repeat(64)}])assert.equal(attemptMatchesTarget({...a,...patch},target),false);
});
test('input event immediately updates local patch/version without redraw or blur',()=>{
 const state={board:contentBoardFromDraft(brief()),edits:0,unsent:false};recordBoardInput(state,0,'title','LOCAL TEXT NOT YET BLURRED');assert.equal(state.board.items[0].title,'LOCAL TEXT NOT YET BLURRED');assert.equal(state.edits,1);assert.equal(state.unsent,true);
});
