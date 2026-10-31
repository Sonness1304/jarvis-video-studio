import test from 'node:test';
import assert from 'node:assert/strict';
import {contentStructures,contentLayouts,validateContentBrief,validateContentCandidate,validateRole,layoutChoices,contentBoardFromDraft,applyContentBoard,captureContentTarget,contentTargetCurrent,draftContentHash} from '../web/content-model.mjs';
import {canonicalBrief} from '../src/editor-store.mjs';
import {newBrief} from '../src/studio.mjs';
import {shotVisuals} from '../src/storyboard.mjs';
const brief=()=>newBrief({template:'listicle',theme:'editorial',voice:'Hải Đăng',id:'content-test'},[{name:'Hải Đăng',aliases:[]}]);
const metadata={subject:'Một kịch bản tốt',audience:'Người mới',goal:'Giải thích',targetSeconds:60,structure:'explain',sourceNotes:''};
const candidate=()=>({schemaVersion:1,title:'Kịch bản',scenes:['hook','explain','conclusion'].map(role=>({role,title:'Một ý',narration:['Một lời kể.'],layout:'kinetic',content:{body:'Một ý rõ'},reason:'Ngắn và rõ',needsInput:[]}))});
test('six structures, legacy and optional metadata share a strict contract',()=>{
 assert.equal(contentStructures.length,6);assert.deepEqual([...contentLayouts].sort(),[...shotVisuals].sort());
 assert.doesNotThrow(()=>canonicalBrief(brief()));
 for(const s of contentStructures){assert.equal(validateContentBrief({...metadata,structure:s.id}).structure,s.id);assert.ok(layoutChoices(s.id,'hook').length>=2);}
 for(const role of ['hook','context','explain','example','evidence','conclusion'])assert.equal(validateRole(role),role);
 for(const bad of [{...metadata,targetSeconds:14},{...metadata,targetSeconds:Infinity},{...metadata,targetSeconds:1.5},{...metadata,structure:'exec'},{...metadata,subject:'x'.repeat(121)},{...metadata,sourceNotes:'x'.repeat(6001)},{...metadata,command:'cmd'},{...metadata,subject:'a\u0000b'}])assert.throws(()=>validateContentBrief(bad));
 const b=brief();b.contentBrief=metadata;b.scenes[0].role='hook';assert.deepEqual(canonicalBrief(b).contentBrief,metadata);b.scenes[0].role='run';assert.throws(()=>canonicalBrief(b));
});
test('candidate is bounded data, never executable media or invented missing metric',()=>{
 assert.equal(validateContentCandidate(candidate()).scenes.length,3);
 for(const mutate of [c=>c.command='x',c=>c.scenes[0].path='outputs/x.png',c=>c.scenes[0].layout='exec',c=>c.scenes[0].narration=['x'.repeat(241)],c=>c.scenes[0].role='exec',c=>c.scenes.pop(),c=>c.scenes[0].content={items:Array(6).fill('x')}]){const c=candidate();mutate(c);assert.throws(()=>validateContentCandidate(c));}
 const c=candidate();c.scenes[0].layout='metric';c.scenes[0].content={};assert.ok(validateContentCandidate(c).scenes[0].needsInput.length);
});
test('layout-only edits preserve narration, media pins, shots, order and voice',()=>{
 const b=brief();b.scenes[0].shots=[{id:'shot-a',phraseId:b.scenes[0].phrases[0].id,title:'Shot',visual:'steps',content:{items:['A','B']}}];
 b.scenes[1].visual='media';b.scenes[1].media={kind:'image',path:'outputs/test/a.png',sha256:'a'.repeat(64),fit:'contain'};
 const before=structuredClone(b),board=contentBoardFromDraft(b);board.items[0].layout='spotlight';board.items[1].layout='kinetic';board.items[2].layout='diagram';board.items[2].content={items:['Ý đầu','Ý sau']};
 const result=applyContentBoard(b,board);assert.deepEqual(b,before);assert.deepEqual(result.scenes[0],b.scenes[0]);assert.deepEqual(result.scenes[1],b.scenes[1]);assert.deepEqual(result.scenes[2].phrases,b.scenes[2].phrases);assert.equal(result.scenes[2].visual,'diagram');assert.equal(result.voice,b.voice);
 board.items[0].replaceProtectedVisual=true;const replaced=applyContentBoard(b,board);assert.equal(replaced.scenes[0].visual,'spotlight');assert.equal(replaced.scenes[0].shots,undefined);
});
test('selected patches preserve extra scenes and reject missing metric, media and duplicate targets',()=>{
 const b=brief(),board=contentBoardFromDraft(b);board.items=board.items.slice(0,1);board.items[0].layout='metric';board.items[0].content={};assert.throws(()=>applyContentBoard(b,board),/CONTENT_REQUIRED/);
 board.items[0].layout='media';assert.throws(()=>applyContentBoard(b,board),/CONTENT_REQUIRED/);
 board.items[0].accept=false;assert.deepEqual(applyContentBoard(b,board),b);
 board.items[0].accept=true;board.items[0].layout='kinetic';board.items[0].narration=['Câu mới.'];const next=applyContentBoard(b,board);assert.equal(next.scenes.length,b.scenes.length);assert.equal(next.scenes[0].phrases[0].id,b.scenes[0].phrases[0].id);
 board.items.push(structuredClone(board.items[0]));assert.throws(()=>applyContentBoard(b,board),/DUPLICATE_TARGET/);
 board.items=[{...board.items[0],targetSceneId:null}];const appended=applyContentBoard(b,board);assert.equal(appended.scenes.length,b.scenes.length+1);assert.doesNotThrow(()=>canonicalBrief(appended));
 const full=brief();while(full.scenes.length<20){const n=full.scenes.length;full.scenes.push({id:'extra-'+n,title:'Extra',visual:'kinetic',phrases:[{id:'extra-p-'+n,text:'Lời kể'}]});}assert.throws(()=>applyContentBoard(full,board),/TOO_MANY_SCENES/);
});
test('capture detects unsaved changes as well as revision and project changes',async()=>{
 const state={project:{revision:1,brief:brief()},draft:brief()},capture=captureContentTarget(state);
 assert.equal(contentTargetCurrent(capture,state),true);assert.match(await draftContentHash(capture.draftJson),/^[a-f0-9]{64}$/);
 state.draft.title='Khác';assert.equal(contentTargetCurrent(capture,state),false);state.draft=brief();state.project.revision++;assert.equal(contentTargetCurrent(capture,state),false);
});
