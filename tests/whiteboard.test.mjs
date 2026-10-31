import test from 'node:test';import assert from 'node:assert/strict';
import {validateBoard,boardTemplate,compileBoard,boardState,applyWhiteboard} from '../web/whiteboard-model.mjs';
import {validateBrief,buildTimeline,qaFrames} from '../src/core.mjs';
import {canonicalBrief,ProjectStore} from '../src/editor-store.mjs';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {duplicateScene,rewriteNarration,DraftHistory} from '../web/model.mjs';
import {applyContentBoard,contentBoardFromDraft} from '../web/content-model.mjs';
const scene=()=>({id:'s1',title:'Một bảng',visual:'whiteboard',phrases:[{id:'p1',text:'Ý đầu.'},{id:'p2',text:'Ý sau.'},{id:'p3',text:'Kết.'}],board:boardTemplate('process',[{id:'p1'},{id:'p2'},{id:'p3'}])});
const brief=()=>({schemaVersion:1,id:'board-test',title:'Bảng',preset:'explain',voice:'Hải Đăng',accent:'#3569CC',scenes:[scene()]});
test('three templates use existing phrases and strict nodes/actions',()=>{
 for(const key of ['process','compare','cause'])for(const count of [1,3]){const phrases=scene().phrases.slice(0,count);validateBoard(boardTemplate(key,phrases),phrases);}
 for(const change of [b=>b.nodes=[],b=>b.nodes[1].id=b.nodes[0].id,b=>b.nodes[1].slot=b.nodes[0].slot,b=>b.nodes[0].label='x'.repeat(71),b=>b.html='<script>',b=>b.actions[0].phraseId='missing',b=>b.actions.push({...b.actions[0],id:'a99'}),b=>b.actions[0].targetId='missing']){const s=scene();change(s.board);assert.throws(()=>validateBoard(s.board,s.phrases));}
});
test('hidden targets, arrow endpoints and self loops reject; anchors compile in WAV order',()=>{
 const s=scene();s.board.actions=[{id:'r',type:'reveal',targetId:'n2',phraseId:'p2',edge:'start'},{id:'a',type:'arrow',targetId:'n1',toId:'n2',phraseId:'p1',edge:'end'}];assert.throws(()=>validateBoard(s.board,s.phrases),/HIDDEN.*n2/);
 s.board.actions[1].phraseId='p2';s.board.actions[1].toId='n1';assert.throws(()=>validateBoard(s.board,s.phrases));s.board.actions[1].toId='n2';validateBoard(s.board,s.phrases);
 const phrases=s.phrases.map((p,i)=>({...p,start:i*2+.6,end:i*2+1.6}));const c=compileBoard(s.board,phrases,7);assert.deepEqual(c.actions.map(a=>a.time),[2.6,3.6]);
 const a=boardState(c,2.8);boardState(c,6);assert.deepEqual(boardState(c,2.8),a);assert.equal(boardState(c,0).nodes.n2.opacity,0);assert.equal(boardState(c,7).nodes.n2.opacity,1);
});
test('canonical save data, duplicate, orphan anchors and undo preserve source',()=>{
 const b=brief();canonicalBrief(b);const dup=duplicateScene(b,0,'s2');validateBrief(dup);assert.equal(dup.scenes[1].board.actions[0].phraseId,dup.scenes[1].phrases[0].id);assert.notEqual(dup.scenes[1].board.nodes[0].id,b.scenes[0].board.nodes[0].id);
 const edited=rewriteNarration(b.scenes[0],'Một câu mới.');assert.deepEqual(edited.board,b.scenes[0].board);assert.throws(()=>validateBrief({...b,scenes:[edited]}),/ANCHOR/);
 const protectedBoard=contentBoardFromDraft(b);protectedBoard.items[0].narration=['Không tự thay'];assert.deepEqual(applyContentBoard(b,protectedBoard).scenes,b.scenes);
 const h=new DraftHistory(b),next=applyWhiteboard(b,0,boardTemplate('compare',b.scenes[0].phrases));h.push(next);assert.deepEqual(h.undo(),b);assert.deepEqual(next.scenes[0].phrases,b.scenes[0].phrases);
 assert.throws(()=>validateBrief({...b,scenes:[{...b.scenes[0],visual:'steps'}]}),/BOARD/);
});
test('measured timeline keeps board anchors and QA includes action boundaries',()=>{
 const b=brief(),audio=Object.fromEntries(b.scenes[0].phrases.map(p=>[p.id,{samples:96000,sampleRate:48000}])),t=buildTimeline(b,audio),c=compileBoard(t.scenes[0].board,t.phrases,t.scenes[0].end);
 const frames=qaFrames(t);for(const a of c.actions){assert.ok(frames.includes(Math.round(a.time*30)));assert.ok(frames.includes(Math.min(t.frames-1,Math.round((a.time+a.duration)*30))));}
});
test('whiteboard persists across project revisions and restart; orphan save leaves previous revision intact',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'m2-store-')),store=new ProjectStore(root),b=brief();await store.create(b);
 const next=applyWhiteboard(b,0,boardTemplate('compare',b.scenes[0].phrases));await store.save(b.id,1,next);
 assert.deepEqual((await new ProjectStore(root).read(b.id)).brief,next);
 next.scenes[0].phrases.pop();await assert.rejects(store.save(b.id,2,next),/ANCHOR/);
 assert.equal((await store.read(b.id)).revision,2);
});
test('removing or inserting a middle narration line never moves board anchors to another sentence',()=>{
 const b=brief(),s=b.scenes[0],removed=rewriteNarration(s,'Ý đầu.\nKết.');
 assert.deepEqual(removed.phrases.map(p=>p.id),['p1','p3']);assert.throws(()=>validateBrief({...b,scenes:[removed]}),/ANCHOR_MISSING:a2/);
 const inserted=rewriteNarration(s,'Ý đầu.\nCâu thêm.\nÝ sau.\nKết.');assert.equal(inserted.phrases[2].id,'p2');assert.equal(inserted.phrases[3].id,'p3');assert.ok(!['p1','p2','p3'].includes(inserted.phrases[1].id));
 const edited=rewriteNarration(s,'Ý đầu sửa.\nÝ sau.\nKết.');assert.deepEqual(edited.phrases.map(p=>p.id),['p1','p2','p3']);
 const ambiguous=rewriteNarration(s,'Ý đầu.\nKết đã sửa.');assert.ok(!['p2','p3'].includes(ambiguous.phrases[1].id));assert.throws(()=>validateBrief({...b,scenes:[ambiguous]}),/ANCHOR_MISSING/);
});
test('six cards and twelve milestones work; replacing a visual preserves other scenes and narration',()=>{
 const phrases=Array.from({length:6},(_,i)=>({id:'p'+i,text:'Câu '+i})),board={surface:'paper',nodes:phrases.map((p,i)=>({id:'n'+i,label:'Thẻ '+i,slot:i})),actions:phrases.flatMap(p=>['start','end'].map(edge=>({id:p.id+'-'+edge,type:'focus',targetId:'n0',phraseId:p.id,edge})))};
 validateBoard(board,phrases);const invalid=structuredClone(board);invalid.actions.push({...board.actions[0],id:'extra'});assert.throws(()=>validateBoard(invalid,phrases));invalid.actions=[];invalid.nodes.push({id:'extra',label:'Thẻ 7',slot:6});assert.throws(()=>validateBoard(invalid,phrases));
 const b=brief(),before=structuredClone(b);b.scenes.push({id:'other',title:'Giữ nguyên',visual:'kinetic',phrases:[{id:'other-p',text:'Lời cảnh khác.'}]});const source=structuredClone(b);source.scenes[0].visual='media';source.scenes[0].media={kind:'image',path:'outputs/source.png'};delete source.scenes[0].board;
 const result=applyWhiteboard(source,0,before.scenes[0].board);assert.equal(result.scenes[0].media,undefined);assert.deepEqual(result.scenes[0].phrases,source.scenes[0].phrases);assert.deepEqual(result.scenes[1],source.scenes[1]);assert.equal(source.scenes[0].visual,'media');
});
