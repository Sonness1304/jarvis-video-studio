import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {validateBrief,buildTimeline,toSrt,audioCacheKey,validateExport,safeChild,escapeHtml,qaFrames} from '../src/core.mjs';
const brief=()=>({schemaVersion:1,id:'pilot',title:'Từ kịch bản đến video',preset:'explain',voice:'Minh Quân',accent:'#477CFF',scenes:[{id:'intro',title:'Một ý tưởng',visual:'script',phrases:[{id:'p1',text:'Xin chào, đây là một video thử.'},{id:'p2',text:'Hình ảnh đi cùng lời kể.'}]}]});
test('reject malformed input before launching anything',()=>{
 for(const change of [b=>b.scenes=[],b=>b.id='../escape',b=>b.voice='',b=>b.accent='red; url(x)',b=>b.scenes[0].phrases[0].text='x'.repeat(241),b=>b.scenes[0].visual='../../x',b=>b.scenes[0].phrases[1].id='p1']){const b=brief();change(b);assert.throws(()=>validateBrief(b));}
 assert.equal(validateBrief(brief()).id,'pilot');
});
test('timeline rounds cumulative boundaries instead of accumulating scene drift',()=>{
 const b=brief();b.scenes[0].phrases=Array.from({length:30},(_,i)=>({id:'p'+i,text:'Câu thử.'}));
 const audio=Object.fromEntries(b.scenes[0].phrases.map(p=>[p.id,{samples:10001,sampleRate:48000,sha256:'a'.repeat(64),file:'voice.wav'}]));
 const t=buildTimeline(b,audio);assert.equal(t.frames,Math.round(t.duration*30));
 for(const p of t.phrases){assert.equal(p.startFrame,Math.round(p.start*30));assert.equal(p.endFrame,Math.round(p.end*30));assert.ok(p.end>p.start);}
 assert.throws(()=>buildTimeline(b,{}));
});
test('SRT uses phrase timings, safe literal text, no invented word alignment',()=>{
 const t=buildTimeline(brief(),{p1:{samples:48000,sampleRate:48000},p2:{samples:96000,sampleRate:48000}});
 t.phrases[0].text='<script> tiếng Việt\n\n00:00 --> 99:99';
 const s=toSrt(t);assert.match(s,/00:00:00,600 --> 00:00:01,600/);assert.match(s,/tiếng Việt/);assert.ok(!s.includes('<script>'));assert.equal((s.match(/ --> /g)||[]).length,2);
});
test('audio keys retain visual edits and invalidate actual model/voice settings',()=>{
 const a={modelHash:'a',runtime:'b',voice:'Minh Quân'};const key=audioCacheKey('Xin chào',a);
 assert.equal(key,audioCacheKey('Xin chào',{...a}));
 for(const k of Object.keys(a))assert.notEqual(key,audioCacheKey('Xin chào',{...a,[k]:'changed'}));
 assert.notEqual(key,audioCacheKey('Chào bạn',a));
});
test('export cannot verify missing/wrong/truncated video or audio',()=>{
 const metadata={format:{duration:'10'},streams:[{codec_type:'video',codec_name:'h264',width:720,height:1280,r_frame_rate:'30/1',duration:'10'},{codec_type:'audio',codec_name:'aac',duration:'10'}]};
 assert.equal(validateExport(metadata,10),true);
 for(const m of [{...metadata,streams:[metadata.streams[0]]},{...metadata,streams:[metadata.streams[0],{...metadata.streams[1],duration:'8'}]},{...metadata,streams:[{...metadata.streams[0],width:1080},metadata.streams[1]]}])assert.throws(()=>validateExport(m,10));
});
test('scoped paths reject traversal, absolute and existing symlink escape',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'jarvis-video-test-'));assert.equal(safeChild(root,'outputs/a.mp4'),path.join(root,'outputs','a.mp4'));
 for(const p of ['../outside','/absolute','C:\\Windows\\Temp','outputs/../../x'])assert.throws(()=>safeChild(root,p));
 const outside=mkdtempSync(path.join(tmpdir(),'jarvis-video-out-'));symlinkSync(outside,path.join(root,'link'),'junction');assert.throws(()=>safeChild(root,'link/file'));
});
test('HTML literal text is escaped and QA frame coverage clamps deduplicates',()=>{
 assert.equal(escapeHtml('<img src=x onerror="bad"> &'), '&lt;img src=x onerror=&quot;bad&quot;&gt; &amp;');
 const t=buildTimeline(brief(),{p1:{samples:48000,sampleRate:48000},p2:{samples:96000,sampleRate:48000}});const frames=qaFrames(t);
 assert.equal(new Set(frames).size,frames.length);assert.ok(frames.every(f=>f>=0&&f<t.frames));assert.ok(frames.includes(t.scenes[0].startFrame));
});
test('scoped paths reject dangling junctions without following their targets',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'jarvis-dangling-'));
 try{symlinkSync(path.join(root,'missing'),path.join(root,'link'),'junction');assert.throws(()=>safeChild(root,'link/new.json'),/SYMLINK_PATH/);assert.equal(safeChild(root,'new/path.json'),path.join(root,'new/path.json'));}
 finally{rmSync(root,{recursive:true,force:true});}
});
