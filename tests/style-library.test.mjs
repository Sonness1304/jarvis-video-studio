import test from 'node:test';
import assert from 'node:assert/strict';
import {styleLibrary,styleGroups,findStyles,applyStyle,captureStyle,styleCurrent,readFavorites,writeFavorites} from '../web/style-library-model.mjs';
import {catalog,newBrief} from '../src/studio.mjs';
import {themeCss} from '../src/themes.mjs';
import {canonicalBrief} from '../src/editor-store.mjs';
import {DraftHistory} from '../web/model.mjs';
import {styleArt} from '../web/style-art.mjs';
const voices=[{name:'Hải Đăng',aliases:[]}];
const brief=()=>newBrief({template:'knowledge-map',theme:'editorial',voice:'Hải Đăng',id:'style-test'},voices);
test('all 12 styles roundtrip canonical validation, catalog and renderer',()=>{
 assert.equal(styleLibrary.length,12);assert.equal(new Set(styleLibrary.map(s=>s.id)).size,12);
 assert.deepEqual(catalog.themes.map(s=>s.id),styleLibrary.map(s=>s.id));
 for(const s of styleLibrary){assert.ok(styleGroups.some(g=>g.id===s.group));assert.match(s.accent,/^#[\da-f]{6}$/i);assert.ok(s.prompt.length>40&&s.limit.length>30);assert.equal(canonicalBrief(applyStyle(brief(),s.id)).theme,s.id);assert.equal(typeof themeCss(s.id),'string');}
 assert.throws(()=>themeCss('bogus'),/INVALID_THEME/);
});
test('every style respects accent opt-in and has structurally distinct artwork',()=>{
 const drawings=new Set();for(const s of styleLibrary){const b=brief();assert.equal(applyStyle(b,s.id).accent,b.accent);assert.equal(applyStyle(b,s.id,{useAccent:true}).accent,s.accent);drawings.add(styleArt(s.id).replace(/#[0-9a-fA-F]{6}/g,'COLOR'));assert.equal(newBrief({template:'listicle',theme:s.id,voice:'Hải Đăng',id:'test'},voices).theme,s.id);}
 assert.equal(drawings.size,12);assert.throws(()=>styleArt('unknown'),/INVALID_STYLE/);
});
test('theme-only apply preserves every other field and never mutates input',()=>{
 const b=brief();b.scenes[0].content.body='Nội dung người dùng';b.branding={name:'Studio'};
 const snapshot=structuredClone(b),after=applyStyle(b,'comic-ink');assert.deepEqual(b,snapshot);
 assert.deepEqual(after,{...snapshot,theme:'comic-ink'});after.scenes[0].content.body='Mới';assert.equal(b.scenes[0].content.body,'Nội dung người dùng');
 assert.equal(applyStyle(b,'comic-ink',{useAccent:true}).accent,styleLibrary.find(s=>s.id==='comic-ink').accent);
 assert.throws(()=>applyStyle(b,'bogus'),/INVALID_STYLE/);
});
test('single history step fully undoes and redoes style and optional color',()=>{
 const b=brief(),history=new DraftHistory(b),next=applyStyle(b,'botanical',{useAccent:true});history.push(next);assert.deepEqual(history.undo(),b);assert.deepEqual(history.redo(),next);
});
test('whole draft, project and revision stale captures prevent overwrite',()=>{
 const state={project:{brief:{id:'style-test'},revision:2},draft:brief()},cap=captureStyle(state);assert.equal(styleCurrent(cap,state),true);
 for(const mutate of [s=>s.draft.scenes[0].title='Sửa',s=>s.project.revision++,s=>s.project.brief.id='other',s=>s.draft.accent='#ffffff']){const next=structuredClone(state);mutate(next);assert.equal(styleCurrent(cap,next),false);}
 assert.equal(styleCurrent(null,state),false);assert.equal(styleCurrent(cap,{draft:null,project:null}),false);
});
test('search is accent insensitive and filters compose',()=>{
 const name=styleLibrary.find(s=>s.id==='paper-story').name;
 assert.ok(findStyles({query:name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d')}).some(s=>s.id==='paper-story'));
 assert.equal(findStyles({favoritesOnly:true,favorites:['comic-ink']})[0].id,'comic-ink');
 assert.equal(findStyles({query:'ZZZ-NOT-FOUND'}).length,0);
 const first=styleLibrary[0];assert.equal(findStyles({group:first.group}).every(s=>s.group===first.group),true);
});
test('favorites storage is bounded, optional and rejects malformed or unknown entries',()=>{
 for(const value of ['null','{}','[1,"bogus"]','x',' '.repeat(5000)])assert.deepEqual(readFavorites({getItem:()=>value}),[]);
 assert.deepEqual(readFavorites({getItem:()=>{throw Error('denied');}}),[]);
 assert.deepEqual(readFavorites({getItem:()=>'["comic-ink","comic-ink","editorial","bogus"]'}),['comic-ink','editorial']);
 let saved;assert.equal(writeFavorites({setItem:(k,v)=>saved=v},['comic-ink','bogus']),true);assert.deepEqual(JSON.parse(saved),['comic-ink']);
 assert.equal(writeFavorites({setItem:()=>{throw Error('denied');}},['comic-ink']),false);
});
