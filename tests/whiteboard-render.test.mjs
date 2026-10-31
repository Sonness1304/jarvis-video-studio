import test from 'node:test';import assert from 'node:assert/strict';
import {boardSvg,wrapBoardLabel} from '../src/whiteboard.mjs';
import {boardTemplate,compileBoard,boardState} from '../web/whiteboard-model.mjs';
import {renderHtml} from '../src/composition.mjs';import {buildTimeline} from '../src/core.mjs';
test('label wrapping rejects overflow instead of truncating content',async()=>{
 const measure=async s=>s.length*11;assert.deepEqual(await wrapBoardLabel('Một ý chính',measure),['Một ý chính']);
 assert.deepEqual(await wrapBoardLabel('a'.repeat(25),measure),['a'.repeat(20),'a'.repeat(5)]);
 await assert.rejects(wrapBoardLabel('a'.repeat(70),measure),/BOARD_LABEL_OVERFLOW/);
});
test('SVG escapes text and embeds all effects using absolute time',()=>{
 const phrases=[{id:'p',text:'Một ý.'}],board=boardTemplate('process',phrases);board.nodes[0].label='</script><script>&';
 const s={id:'scene',title:'Bảng',visual:'whiteboard',board,phrases},b={schemaVersion:1,id:'test',title:'Test',preset:'explain',voice:'Hải Đăng',accent:'#3569CC',scenes:[s]};
 assert.match(boardSvg(board),/&lt;script&gt;&amp;/);assert.doesNotMatch(boardSvg(board),/<script>/);
 const t=buildTimeline(b,{p:{samples:144000,sampleRate:48000}}),html=renderHtml(t);assert.match(html,/drawBoard/);assert.match(html,/wb-node/);assert.match(html,/boardState/);assert.doesNotMatch(html,/<\/script><script>&/);
 const c=compileBoard(board,t.phrases,t.duration);assert.equal(boardState(c,0).effects.a1,0);assert.equal(boardState(c,2).effects.a1,1);assert.deepEqual(boardState(c,0),boardState(c,-1));
});
