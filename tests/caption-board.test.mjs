import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DraftHistory} from '../web/model.mjs';
const c=await import('../web/caption-board.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const draft=()=>({id:'p78-ui',title:'Lời kể',voice:'Hải Đăng',accent:'#3569CC',scenes:[{id:'s1',title:'Mở',visual:'kinetic',phrases:[{id:'p1',text:'AI tạo video.'},{id:'p2',text:'Giữ nhịp kể.'}]}]});
test('caption board commits a whole immutable patch and undo restores original draft',()=>{
 assert.equal(typeof c.captionBoardFromDraft,'function');const d=draft(),original=structuredClone(d),board=c.captionBoardFromDraft(d);board.settings.style='outline';board.phrases[0].caption={text:'AI\ntạo video.',emphasis:['AI']};board.phrases[1].speechText='Giữ nhịp kể tự nhiên.';const n=c.applyCaptionBoard(d,board);assert.deepEqual(d,original);assert.equal(n.scenes[0].phrases[0].id,'p1');assert.equal(n.captions.style,'outline');assert.equal(n.scenes[0].phrases[1].speechText,'Giữ nhịp kể tự nhiên.');const h=new DraftHistory(d);h.push(n);assert.deepEqual(h.undo(),d);assert.deepEqual(h.redo(),n);
});
test('caption patch cannot change source narration identity/media or accept unknown fields',()=>{
 const d=draft();for(const mutate of [b=>b.phrases[0].text='Khác',b=>b.phrases[0].id='unknown',b=>b.phrases.pop(),b=>b.phrases.push({...b.phrases[0]}),b=>b.path='../x',b=>b.phrases[0].timestamp=2,b=>b.settings.fontSize=99,b=>b.phrases[0].caption={emphasis:['không có']}]){const b=c.captionBoardFromDraft(d);mutate(b);assert.throws(()=>c.applyCaptionBoard(d,b));}assert.equal(d.scenes[0].phrases[0].text,'AI tạo video.');
});
test('caption capture rejects same revision unsaved edit, save revision and project switch',()=>{
 const d=draft(),s={project:{brief:{id:d.id},revision:3},draft:d},capture=c.captureCaptionTarget(s);assert.equal(c.captionTargetCurrent(capture,s),true);for(const mutate of [s=>s.draft.title='Khác',s=>s.project.revision++,s=>s.project.brief.id='other']){const n=structuredClone(s);mutate(n);assert.equal(c.captionTargetCurrent(capture,n),false);}
});
test('desk timing works before first export and never labels historical or absent phrases measured',()=>{
 assert.equal(typeof c.captionCueRows,'function');const d=draft();for(const measured of [null,false,{}]){const rows=c.captionCueRows({draft:d,measured,measuredEditable:false});assert.equal(rows.measured,false);assert.equal(rows.rows[0].start,.6);assert.ok(rows.rows[1].end>rows.rows[1].start);}
 const s={draft:d,measuredEditable:true,measured:{phrases:[{id:'p1',start:1,end:2},{id:'p2',start:3,end:4}]}};assert.equal(c.captionCueRows(s).measured,true);assert.equal(c.captionCueRows(s).rows[1].end,4);
 s.measured.phrases.pop();assert.equal(c.captionCueRows(s).measured,false);
});
test('desk exposes immediate edits and safe modules; compact caption controls preserve optional settings',()=>{
 const p=readFileSync(new URL('../web/p78.mjs',import.meta.url),'utf8'),p3=readFileSync(new URL('../web/p3.mjs',import.meta.url),'utf8'),server=readFileSync(new URL('../src/editor-server.mjs',import.meta.url),'utf8');assert.ok(p.includes('oninput'));assert.ok(p.includes('hasUnsavedEdits'));for(const id of ['open-captions','caption-dialog','caption-apply','caption-cancel'])assert.ok(p.includes(id));assert.ok(p3.includes('...draft.captions'));for(const route of ['/p78.mjs','/caption-board.mjs','/captions.mjs'])assert.ok(server.includes(route));
});
