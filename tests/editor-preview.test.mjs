import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {previewBridge} from '../src/editor-preview.mjs';
test('draft preview shows one current scene and only active caption at A B A seeks',()=>{
 const clips=[{dataset:{start:'0',duration:'3'},style:{}},{dataset:{start:'3',duration:'3'},style:{}},{dataset:{start:'1',duration:'1'},style:{}}];let handler,seek;
 const parent={postMessage(){}};const context={location:{pathname:'/preview/test/index.html'},parent,innerWidth:360,innerHeight:640,document:{body:{style:{}},querySelectorAll:q=>q==='video'?[]:clips},addEventListener:(type,fn)=>{if(type==='message')handler=fn;},window:{__timelines:{root:{seek:t=>seek=t}}}};
 vm.runInNewContext(previewBridge('http://127.0.0.1:20130',6),context);
 const draw=t=>handler({source:parent,origin:'http://127.0.0.1:20130',data:{type:'seek',time:t}});
 draw(1.5);assert.deepEqual(clips.map(c=>c.style.visibility),['visible','hidden','visible']);draw(4);assert.deepEqual(clips.map(c=>c.style.visibility),['hidden','visible','hidden']);draw(1.5);assert.equal(seek,1.5);assert.equal(clips[1].style.visibility,'hidden');
 handler({source:parent,origin:'https://evil.test',data:{type:'seek',time:4}});assert.equal(seek,1.5);
 draw(6);assert.equal(clips[1].style.visibility,'visible');
});
test('draft freezes at trim out-point, and A B A seeks return to source in-point exactly',()=>{
 let handler;const parent={postMessage(){}},video={tagName:'VIDEO',dataset:{start:'1',duration:'6',mediaStart:'2',mediaEnd:'3'},style:{},duration:8,currentTime:0,addEventListener(){}};
 vm.runInNewContext(previewBridge('http://local',8),{location:{pathname:'/preview/test/index.html'},parent,innerWidth:720,innerHeight:1280,document:{body:{style:{}},querySelectorAll:()=>[video]},addEventListener:(t,fn)=>{if(t==='message')handler=fn;},window:{}});
 const draw=time=>handler({source:parent,origin:'http://local',data:{type:'seek',time}});draw(1.25);const a=video.currentTime;draw(5);assert.ok(video.currentTime<3&&video.currentTime>=2.96);draw(1.25);assert.equal(video.currentTime,a);
});
test('landscape draft fits its own profile and seeks muted video from trim in-point',()=>{
 let handler;const parent={postMessage(){}},video={tagName:'VIDEO',dataset:{start:'1',duration:'4',mediaStart:'2'},style:{},duration:8,currentTime:0,addEventListener(){}},style={};
 vm.runInNewContext(previewBridge('http://local',6,{width:1280,height:720}),{location:{pathname:'/preview/test/index.html'},parent,innerWidth:640,innerHeight:360,document:{body:{style},querySelectorAll:()=>[video]},addEventListener:(t,fn)=>{if(t==='message')handler=fn;},window:{}});
 assert.equal(style.transform,'scale(0.5)');handler({source:parent,origin:'http://local',data:{type:'seek',time:3}});assert.equal(video.currentTime,4);
});

test('font-ready layout report is bound to preview path and preserves hidden shot and heading',async()=>{const messages=[],title={textContent:'Base',getBoundingClientRect:()=>({bottom:180})},visual={dataset:{},hidden:false,clientHeight:100,clientWidth:100,scrollHeight:100,scrollWidth:100,getBoundingClientRect:()=>({top:220}),querySelector:()=>null},panel={...visual,hidden:true,dataset:{shotId:'shot-a',shotTitle:'Shot title'},scrollHeight:125},scene={querySelector:q=>q==='h1'?title:visual,querySelectorAll:()=>[panel]},parent={postMessage:v=>messages.push(v)};vm.runInNewContext(previewBridge('http://local',4),{location:{pathname:'/preview/fresh/index.html'},parent,innerWidth:720,innerHeight:1280,requestAnimationFrame:fn=>fn(),document:{fonts:{ready:Promise.resolve()},body:{style:{}},querySelectorAll:q=>q==='.scene'?[scene]:[]},addEventListener(){},window:{}});await new Promise(resolve=>setImmediate(resolve));const report=messages.find(m=>m.type==='layout-report');assert.equal(report.previewPath,'/preview/fresh/index.html');assert.equal(report.issues[0],'shot-a: chữ vượt khung');assert.equal(panel.hidden,true);assert.equal(title.textContent,'Base');});

test('landscape title beside visual is not a vertical-overlap false alarm',async()=>{const messages=[],title={textContent:'Ngang',getBoundingClientRect:()=>({left:70,right:630,top:150,bottom:280})},visual={dataset:{},hidden:false,clientHeight:440,clientWidth:480,scrollHeight:440,scrollWidth:480,getBoundingClientRect:()=>({left:720,right:1200,top:110,bottom:550}),querySelector:()=>null},scene={querySelector:q=>q==='h1'?title:visual,querySelectorAll:()=>[]},parent={postMessage:v=>messages.push(v)};vm.runInNewContext(previewBridge('http://local',4,{width:1280,height:720}),{location:{pathname:'/preview/landscape/index.html'},parent,innerWidth:640,innerHeight:360,requestAnimationFrame:fn=>fn(),document:{fonts:{ready:Promise.resolve()},body:{style:{}},querySelectorAll:q=>q==='.scene'?[scene]:[]},addEventListener(){},window:{}});await new Promise(resolve=>setImmediate(resolve));assert.equal(messages.find(m=>m.type==='layout-report').issues.length,0);});
