import test from 'node:test';import assert from 'node:assert/strict';
import {renderHtml} from '../src/composition.mjs';
import {buildTimeline} from '../src/core.mjs';
test('composition is seekable, local, escapes text and retains exact measured duration',()=>{
 const b={schemaVersion:1,id:'literal',title:'<script>alert(1)</script>',preset:'explain',voice:'Hải Đăng',accent:'#3569CC',scenes:[{id:'opening',title:'<img onerror=x>',visual:'script',phrases:[{id:'p1',text:'Xin chào & hẹn gặp lại.'}]}]};
 const t=buildTimeline(b,{p1:{samples:48000,sampleRate:48000}});const h=renderHtml(t);
 assert.ok(h.includes('data-duration="'+t.duration+'"'));assert.ok(h.includes('paused:true'));assert.ok(h.includes('window.__timelines'));
 assert.match(h,/<audio id="voice-master"/);
 assert.ok(!h.includes('<script>alert(1)'));assert.ok(!h.includes('<img onerror=x>'));assert.ok(h.includes('&lt;img onerror=x&gt;'));assert.ok(!h.includes('https://'));assert.ok(!h.includes('setInterval('));assert.equal(h,renderHtml(t));
});
test('small caption metadata has readable contrast on its actual light surfaces',()=>{
 const b={schemaVersion:1,id:'readable',title:'Tiêu đề',preset:'explain',voice:'Hải Đăng',accent:'#3569CC',scenes:[{id:'opening',title:'Lời kể',visual:'script',phrases:[{id:'p1',text:'Xin chào.'}]}]};const h=renderHtml(buildTimeline(b,{p1:{samples:48000,sampleRate:48000}}));
 const luminance=hex=>{const v=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];};
 for(const [selector,bg] of [['paper-stamp','#FFFFFF'],['footer','#F0F4FC']]){const css=h.match(new RegExp('\\.'+selector+'\\{([^}]+)\\}'))[1];const fg=css.match(/color:(#[0-9a-f]{6})/i)[1];const ratio=(luminance(bg)+.05)/(luminance(fg)+.05);assert.ok(ratio>=4.5,selector+' contrast '+ratio);}
});
