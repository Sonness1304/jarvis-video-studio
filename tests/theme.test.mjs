import test from 'node:test';import assert from 'node:assert/strict';
import {themeCss} from '../src/themes.mjs';import {renderHtml} from '../src/composition.mjs';
import {buildTimeline} from '../src/core.mjs';
test('three styles change framing and type while remaining deterministic and bounded',()=>{
 const b={schemaVersion:1,id:'theme-proof',title:'Một câu chuyện',preset:'story',voice:'Thục Đoan',accent:'#3569CC',scenes:[{id:'open',title:'Một ý tưởng nhỏ',visual:'script',phrases:[{id:'p',text:'Xin chào.'}]}]};
 const rendered=['editorial','dark-cinema','paper-story'].map(theme=>renderHtml(buildTimeline({...b,theme},{p:{samples:48000,sampleRate:48000}})));
 assert.equal(new Set(rendered).size,3);assert.match(rendered[1],/data-style="dark-cinema"/);assert.match(rendered[2],/data-style="paper-story"/);
 assert.match(themeCss('dark-cinema'),/letter-spacing/);assert.match(themeCss('paper-story'),/border-left/);
 assert.throws(()=>themeCss('bad'),/INVALID_THEME/);for(const h of rendered)assert.ok(!h.includes('setInterval'));
});
test('cinema light cards use a dark ink and retain enough room for delivery copy',()=>{
 const css=themeCss('dark-cinema');const card=css.match(/\.reel-core,\.deliverables b\{color:(#[a-f0-9]{6})/i);
 assert.ok(card,'light card text needs its own ink rather than pale accent');
 const rgb=card[1].slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const l=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];assert.ok(1.05/(l+.05)>=4.5);
 const height=Number(css.match(/\.visual\{[^}]*height:(\d+)px/)[1]);assert.ok(height>=486,'delivery content needs at least measured 486px');
});
test('new dark themes keep legacy light surfaces legible with independent dark ink',()=>{
 for(const theme of ['chalk-talk','midnight-tech']){
  const css=themeCss(theme),card=css.match(/\.paper,\.editing,\.edit-card,\.film-screen\{color:(#[a-f0-9]{6})/i);
  assert.ok(card,theme+': legacy light surfaces must not inherit the light page ink');
  const rgb=card[1].slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4),l=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];assert.ok(1.05/(l+.05)>=4.5,theme);
 }
});
