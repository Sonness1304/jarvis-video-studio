import test from 'node:test';import assert from 'node:assert/strict';import {formatProfile} from '../src/formats.mjs';import {newBrief} from '../src/studio.mjs';import {validateBrief,buildTimeline,validateExport} from '../src/core.mjs';import {canonicalBrief} from '../src/editor-store.mjs';import {renderHtml} from '../src/composition.mjs';
const brief=()=>newBrief({template:'listicle',theme:'editorial',voice:'Hải Đăng',id:'demo'},[{name:'Hải Đăng',aliases:[]}]);
test('three formats flow from brief to native HTML dimensions and export validation',()=>{
 for(const format of ['portrait','landscape','square']){const b={...brief(),format,transition:'fade',branding:{label:'Thương hiệu',subline:'',footer:''},captions:{enabled:false,style:'minimal',fontSize:30}};canonicalBrief(b);const audio=Object.fromEntries(b.scenes.flatMap(s=>s.phrases.map(p=>[p.id,{samples:48000,sampleRate:48000}]))),t=buildTimeline(b,audio),f=formatProfile(format),html=renderHtml(t);assert.equal(t.width,f.width);assert.equal(t.height,f.height);assert.ok(html.includes('data-width="'+f.width+'"'));assert.ok(html.includes('Thương hiệu'));assert.ok(!html.includes('class="caption clip"'));
 const metadata={streams:[{codec_type:'video',codec_name:'h264',width:f.width,height:f.height,r_frame_rate:'30/1',duration:t.duration},{codec_type:'audio',codec_name:'aac',duration:t.duration}],format:{duration:t.duration}};assert.equal(validateExport(metadata,t.duration,f),true);
 }assert.throws(()=>validateBrief({...brief(),format:'bad'}),/INVALID_FORMAT/);assert.throws(()=>validateBrief({...brief(),transition:'eval'}),/INVALID_TRANSITION/);
});
test('last native video remains visible through the final tail frames',()=>{
 const b=brief();b.scenes=b.scenes.slice(0,1);b.scenes[0].visual='media';b.scenes[0].media={kind:'video',path:'outputs/asset-a/media.mp4',sha256:'a'.repeat(64),start:0,end:2};const audio=Object.fromEntries(b.scenes[0].phrases.map(p=>[p.id,{samples:48000,sampleRate:48000}])),t=buildTimeline(b,audio),html=renderHtml(t);assert.match(html,new RegExp('id="media-video-0"[^>]+data-duration="'+t.duration+'"'));
});
test('native timed video is a stage sibling, never nested in another timed scene',()=>{
 const b=brief();b.scenes[0].visual='media';b.scenes[0].media={kind:'video',path:'outputs/asset-a/media.mp4',sha256:'a'.repeat(64),start:.1,end:1.8};const audio=Object.fromEntries(b.scenes.flatMap(s=>s.phrases.map(p=>[p.id,{samples:48000,sampleRate:48000}]))),html=renderHtml(buildTimeline(b,audio));
 assert.ok([...html.matchAll(/<section\b[\s\S]*?<\/section>/g)].every(m=>!m[0].includes('<video')));assert.ok(html.includes('data-media-end="1.8"'));
});
test('music and trimmed video fields reject path escape and impossible windows',()=>{
 const b=brief();b.music={assetId:'asset-a',path:'outputs/asset-a/music.wav',sha256:'a'.repeat(64),gainDb:-18,duckDb:-12};canonicalBrief(b);
 assert.throws(()=>validateBrief({...b,music:{...b.music,gainDb:9}}),/INVALID_MUSIC/);
 b.scenes[0].visual='media';b.scenes[0].media={kind:'video',path:'outputs/asset-a/media.mp4',sha256:'a'.repeat(64),start:0,end:2,fit:'contain'};canonicalBrief(b);
 for(const end of [-1,61,NaN])assert.throws(()=>validateBrief({...b,scenes:[{...b.scenes[0],media:{...b.scenes[0].media,end}}]}),/INVALID_MEDIA/);
});
