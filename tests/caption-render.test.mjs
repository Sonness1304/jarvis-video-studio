import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {buildTimeline,toSrt} from '../src/core.mjs';import {renderHtml} from '../src/composition.mjs';import {previewBridge} from '../src/editor-preview.mjs';
const fixture=(style='marker',position='bottom',format='portrait')=>{const b={schemaVersion:1,id:'captions',title:'Phụ đề',preset:'explain',voice:'Hải Đăng',accent:'#3569CC',format,captions:{enabled:true,style,fontSize:44,position,textColor:'#FFFFFF',highlightColor:'#54C5CD'},scenes:[{id:'intro',title:'Lời kể',visual:'kinetic',phrases:[{id:'p1',text:'AI tạo video.',caption:{text:'AI\ntạo video.',emphasis:['AI']}}]}]};return buildTimeline(b,{p1:{samples:48000,sampleRate:48000}});};
test('five caption treatments use escaped segments, manual lines and trusted placement in all formats',()=>{
 for(const format of ['portrait','landscape','square'])for(const position of ['bottom','middle','top'])for(const style of ['box','minimal','outline','marker','editorial']){const t=fixture(style,position,format),html=renderHtml(t);assert.ok(html.includes(`data-caption-style="${style}"`));assert.ok(html.includes(`data-caption-position="${position}"`));assert.match(html,/data-caption-id="p1"/);assert.match(html,/<span class="caption-emphasis">AI<\/span>\ntạo video\./);assert.ok(html.includes('#54C5CD'));assert.ok(html.includes('white-space:pre-wrap'));assert.ok(html.includes('captionCues'));
 }const t=fixture();t.phrases[0].caption={text:'</script><img onerror="boom">'};const html=renderHtml(t);assert.ok(html.includes('&lt;/script&gt;&lt;img'));assert.ok(!html.includes('<img onerror="boom">'));t.captions.enabled=false;assert.ok(!renderHtml(t).includes('data-caption-id="p1"'));assert.ok(toSrt(t).includes('00:00:00,600'));
});
test('fontready caption reports identify hidden overflowing cue and restore its style',async()=>{
 const messages=[],saved={visibility:'hidden',transform:'translateY(8px)'},cue={dataset:{captionId:'p1'},style:saved,clientHeight:90,clientWidth:400,scrollHeight:150,scrollWidth:400,getBoundingClientRect:()=>({left:56,right:664,top:1100,bottom:1240})};
 const parent={postMessage:m=>messages.push(m)},root={classList:{toggle(){}}};
 vm.runInNewContext(previewBridge('http://local',4),{location:{pathname:'/preview/captions/index.html'},parent,innerWidth:720,innerHeight:1280,matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>fn(),document:{fonts:{ready:Promise.resolve()},body:{style:{}},getElementById:()=>root,querySelectorAll:q=>q==='[data-caption-id]'?[cue]:[]},addEventListener(){},window:{}});
 await new Promise(resolve=>setImmediate(resolve));const report=messages.find(m=>m.type==='layout-report');assert.ok(report.issues.some(s=>s.includes('p1')&&s.includes('phụ đề')));assert.equal(cue.style.visibility,'hidden');assert.equal(cue.style.transform,'translateY(8px)');
});
test('legacy dark-cinema box and absent settings retain theme contrast until color explicitly chosen',()=>{
 for(const settings of [undefined,{enabled:true,style:'box',fontSize:27}]){const t=fixture('box');t.theme='dark-cinema';t.captions=settings;const html=renderHtml(t);assert.ok(html.includes('color:#142535'));assert.ok(!html.includes('color:#FFFFFF!important'));}
 const t=fixture('box');t.theme='dark-cinema';assert.ok(renderHtml(t).includes('color:#FFFFFF!important'));
});
