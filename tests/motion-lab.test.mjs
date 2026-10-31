import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLab,labState,labSvg,refractionGeometry,verifyLabRenderInputs,drawLab} from '../src/motion-lab.mjs';
import {validateBrief,buildTimeline,buildSpeechPhrases} from '../src/core.mjs';
import {canonicalBrief} from '../src/editor-store.mjs';
import {renderHtml} from '../src/composition.mjs';
import {editSceneValue} from '../web/model.mjs';
import {applyContentBoard,contentBoardFromDraft} from '../web/content-model.mjs';
import {encodeBoard,restoreBoard,boardFromCandidate} from '../web/content-board.mjs';
const brief=()=>({schemaVersion:1,id:'lab-test',title:'Khúc xạ',preset:'explain',voice:'Hải Đăng',accent:'#156BA0',scenes:[{id:'light',title:'Ánh sáng đổi hướng',visual:'motion-lab',lab:{kind:'refraction',stage:'rays'},phrases:[{id:'p1',text:'Ánh sáng đổi hướng khi ra khỏi nước.'}]}]});
test('typed primitives reject unknown/script payloads, malformed QR and detached lab data',()=>{
 assert.doesNotThrow(()=>validateBrief(brief()));assert.deepEqual(canonicalBrief(brief()),brief());
 for(const lab of [{kind:'html',stage:'rays'},{kind:'refraction',stage:'rays',js:'alert(1)'},{kind:'qr',stage:'clean',matrix:['10']},{kind:'qr',stage:'clean',matrix:Array(21).fill('x'.repeat(21))}])assert.throws(()=>validateLab(lab),/INVALID_LAB/);
 const b=brief();b.scenes[0].visual='script';assert.throws(()=>validateBrief(b),/INVALID_LAB/);
});
test('state is absolute-time, bounded and seek A-B-A stable, geometry obeys Snell',()=>{
 assert.deepEqual(labState(.2),labState(.2));assert.notDeepEqual(labState(.2),labState(.7));
 assert.equal(labState(-1).progress,0);assert.equal(labState(2).progress,1);
 const g=refractionGeometry();assert.ok(Math.abs(1.333*Math.sin(g.incident)-Math.sin(g.refracted))<1e-12);
 assert.ok(g.refracted>g.incident);assert.ok(g.apparent.y<g.object.y&&g.apparent.y>g.surface.y);
});
test('proof rejects stale timeline/HTML and actual draw resets when seeking backwards',()=>{
 const hashes={timeline:'a'.repeat(64),composition:'b'.repeat(64)},r={renderInputs:hashes};assert.doesNotThrow(()=>verifyLabRenderInputs(r,hashes));assert.throws(()=>verifyLabRenderInputs(r,{...hashes,composition:'c'.repeat(64)}),/MOTION_RENDER_INPUTS_CHANGED/);
 const el={style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;}},root={querySelectorAll:selector=>selector==='[data-lab-pulse]'?[el]:[]};drawLab(root,.2);const a=JSON.stringify(el);drawLab(root,.35);assert.notEqual(JSON.stringify(el),a);drawLab(root,.2);assert.equal(JSON.stringify(el),a);
});
test('composition keeps lab contract and animation shared by estimated preview and measured render',()=>{
 const b=brief(),t=buildTimeline(b,{p1:{samples:192000,sampleRate:48000}}),html=renderHtml(t);
 assert.match(html,/data-lab="refraction"/);assert.match(html,/drawLab/);assert.match(html,/Mô hình 2D/);
 const before=buildSpeechPhrases(b,{voice:'Hải Đăng',modelHash:'abc'});b.scenes[0].lab.stage='apparent';
 assert.deepEqual(buildSpeechPhrases(b,{voice:'Hải Đăng',modelHash:'abc'}),before);
 assert.ok(labSvg({kind:'refraction',stage:'rays'}).includes('pháp tuyến'));
});
test('media attachment removes only obsolete lab data, retaining the original for undo',()=>{
 const b=brief(),next=editSceneValue(b,0,s=>{s.visual='media';s.media={kind:'image',path:'outputs/asset-test/media.png',sha256:'a'.repeat(64),fit:'contain'};});
 assert.equal(next.scenes[0].lab,undefined);assert.equal(b.scenes[0].lab.kind,'refraction');assert.doesNotThrow(()=>canonicalBrief(next));
});
test('content board protects lab figures until explicit replacement, then removes obsolete contract',()=>{
 const b=brief(),board=contentBoardFromDraft(b);board.items[0].layout='kinetic';board.items[0].content={body:'Nội dung mới'};
 assert.deepEqual(applyContentBoard(b,board).scenes,b.scenes);
 board.items[0].replaceProtectedVisual=true;const next=applyContentBoard(b,board);assert.equal(next.scenes[0].lab,undefined);assert.doesNotThrow(()=>canonicalBrief(next));
});
test('protected board round-trips and explicit narration edits keep the original lab figure',()=>{
 const b=brief(),board=contentBoardFromDraft(b),value={projectId:b.id,revision:1,baseHash:'a'.repeat(64),attemptId:null,board};
 assert.deepEqual(restoreBoard(encodeBoard(value),b.id).board,JSON.parse(JSON.stringify(board)));
 board.items[0].replaceProtectedVisual=true;board.items[0].narration=['Ánh sáng khúc xạ qua mặt nước.'];const next=applyContentBoard(b,board);assert.deepEqual(next.scenes[0].lab,b.scenes[0].lab);assert.equal(next.scenes[0].phrases[0].text,board.items[0].narration[0]);assert.doesNotThrow(()=>canonicalBrief(next));
});
