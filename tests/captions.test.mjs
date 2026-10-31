import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import * as core from '../src/core.mjs';import {canonicalBrief,ProjectStore} from '../src/editor-store.mjs';
import {BrandStore} from '../src/brand-store.mjs';import {rewriteNarration,duplicateScene,DraftHistory,batchVariants,estimateScenes} from '../web/model.mjs';
import {splitSceneAtPhrase,splitCandidates} from '../web/clip-tools.mjs';import {contentBoardFromDraft,applyContentBoard} from '../web/content-model.mjs';
const c=await import('../web/captions.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const settings=()=>({enabled:true,style:'marker',fontSize:32,textColor:'#FFFFFF',highlightColor:'#54C5CD',position:'bottom'});
const phrase=()=>({id:'p-a',text:'AI tạo video.',speechText:'Ây ai tạo vi đi ô.',caption:{text:'AI\ntạo video.',emphasis:['AI']}});
const brief=()=>({schemaVersion:1,id:'p78-contract',title:'Biên tập phụ đề',preset:'explain',voice:'Hải Đăng',accent:'#3569CC',captions:settings(),scenes:[{id:'intro',title:'Một ý tưởng',visual:'kinetic',phrases:[phrase(),{id:'p-b',text:'Hình ảnh theo lời kể.',caption:{text:'Hình ảnh theo lời kể.'}}]}]});
const audio={ 'p-a':{samples:48000,sampleRate:48000},'p-b':{samples:96000,sampleRate:48000}};
test('five caption styles and three positions share strict settings validation',()=>{
 assert.equal(typeof c.validateCaptionSettings,'function');
 for(const style of ['box','minimal','outline','marker','editorial'])for(const position of ['bottom','middle','top'])assert.equal(c.validateCaptionSettings({...settings(),style,position}).style,style);
 for(const patch of [{style:'x'},{fontSize:19},{fontSize:45},{position:'left'},{textColor:'red;url(x)'},{fontUrl:'x'},{enabled:1}])assert.throws(()=>c.validateCaptionSettings({...settings(),...patch}),/CAPTION/);
});
test('phrase overrides are bounded optional data; line breaks and absent fields remain intentional',()=>{
 assert.equal(typeof c.validatePhraseOverrides,'function');assert.deepEqual(c.validatePhraseOverrides({text:'Gốc'}),{});
 assert.deepEqual(c.validatePhraseOverrides(phrase()),{speechText:phrase().speechText,caption:phrase().caption});
 for(const patch of [{speechText:''},{speechText:'x'.repeat(241)},{caption:{text:''}},{caption:{text:'x'.repeat(361)}},{caption:{text:'a\nb\nc\nd'}},{caption:{text:'a'.repeat(121)}},{caption:{text:'a\rb'}},{caption:{text:'a\tb'}},{caption:{text:'AI',html:'<b>AI</b>'}},{caption:{emphasis:['không có']}},{caption:{text:'AI',emphasis:Array(9).fill('AI')}}])assert.throws(()=>c.validatePhraseOverrides({...phrase(),...patch}),/CAPTION|SPEECH/);
 assert.equal(c.effectiveCaptionText({text:'gốc',caption:{text:'Dòng một\n\nDòng hai'}}),'Dòng một\nDòng hai');
});
test('literal Unicode emphasis matches whole graphemes longest first without overlap or regex',()=>{
 const p={text:'AI video + a+b 👩‍💻 tiếng Việt',caption:{emphasis:['AI','AI video','a+b','👩‍💻','tiếng Việt'.normalize('NFD')]}};
 const segments=c.captionSegments(p);assert.equal(segments.map(s=>s.text).join(''),p.text);assert.deepEqual(segments.filter(s=>s.emphasis).map(s=>s.text),['AI video','a+b','👩‍💻','tiếng Việt']);
 assert.throws(()=>c.validatePhraseOverrides({text:'Việt',caption:{emphasis:['Việt','Việt'.normalize('NFD')]}}),/CAPTION/);
 assert.throws(()=>c.validatePhraseOverrides({text:'👩‍💻',caption:{emphasis:['👩']}}),/CAPTION/);
 assert.throws(()=>c.validatePhraseOverrides({text:'q\u0301',caption:{emphasis:['q']}}),/CAPTION/);
 assert.equal(c.captionSegments({text:'<img onerror="x">'}).map(s=>s.text).join(''),'<img onerror="x">');
});
test('canonical/save/brand/duplicate/split/history/batch keep optional metadata and legacy stays unchanged',async()=>{
 const b=brief(),canonical=canonicalBrief(b);assert.deepEqual(canonical,b);const legacy=structuredClone(b);delete legacy.captions;legacy.scenes[0].phrases.forEach(p=>{delete p.caption;delete p.speechText;});assert.deepEqual(canonicalBrief(legacy),legacy);
 const duplicated=duplicateScene(b,0,'intro-copy');assert.deepEqual(duplicated.scenes[1].phrases[0].caption,b.scenes[0].phrases[0].caption);
 const t=core.buildTimeline(b,audio),split=splitSceneAtPhrase(b,0,'p-b',t,'right');assert.deepEqual(split.scenes.flatMap(s=>s.phrases),b.scenes[0].phrases);
 const stale=structuredClone(t);stale.phrases[0].speechText='Khác';assert.throws(()=>splitCandidates(b,0,stale),/STALE/);
 const h=new DraftHistory(b);h.push(duplicated);assert.deepEqual(h.undo(),b);assert.deepEqual(h.redo(),duplicated);
 for(const v of batchVariants(['portrait','landscape'],['editorial']))assert.deepEqual(canonicalBrief({...b,...v}).captions,b.captions);
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'p78-store-'));try{const store=new ProjectStore(root);await store.create(b);assert.deepEqual((await store.read(b.id)).brief,b);const brand=await new BrandStore(root).create({name:'Phụ đề mới',theme:'editorial',accent:b.accent,captions:b.captions,branding:{label:'Kênh'}});assert.deepEqual(brand.captions,b.captions);}finally{await fs.rm(root,{recursive:true,force:true});}
});
test('rewrite and P7.5 Apply retain equivalent narration overrides and reset only actual changes',()=>{
 const b=brief(),s=b.scenes[0],same=rewriteNarration(s,'  AI tạo video.  \nHình ảnh theo lời kể.'.normalize('NFD'));assert.deepEqual(same.phrases[0].caption,s.phrases[0].caption);assert.equal(same.phrases[0].speechText,s.phrases[0].speechText);
 const changed=rewriteNarration(s,'AI tạo video!\nHình ảnh theo lời kể.');assert.equal(changed.phrases[0].caption,undefined);assert.equal(changed.phrases[0].speechText,undefined);assert.deepEqual(changed.phrases[1],s.phrases[1]);
 const board=contentBoardFromDraft(b);board.items[0].layout='spotlight';assert.deepEqual(applyContentBoard(b,board).scenes[0].phrases,s.phrases);
 assert.equal(c.narrationEquivalent('A\t B','A B'),true);assert.equal(c.narrationEquivalent('AI','ai'),false);
});
test('speech request keys keep full runtime identity and caption-only never changes measured timing',()=>{
 assert.equal(typeof core.buildSpeechPhrases,'function');const b=brief(),runtime={voice:b.voice,modelHash:'a',temperature:.8},r=core.buildSpeechPhrases(b,runtime);
 assert.equal(r[0].text,phrase().speechText);assert.equal(r[0].cacheKey,core.audioCacheKey(phrase().speechText,runtime));assert.equal(b.scenes[0].phrases[0].text,'AI tạo video.');
 const changed=structuredClone(b);changed.scenes[0].phrases[0].caption.text='AI\nĐổi phụ đề';assert.equal(core.buildSpeechPhrases(changed,runtime)[0].cacheKey,r[0].cacheKey);
 for(const key of Object.keys(runtime))assert.notEqual(core.buildSpeechPhrases(b,{...runtime,[key]:'khác'})[0].cacheKey,r[0].cacheKey);
 const t=core.buildTimeline(b,audio),ct=core.buildTimeline(changed,audio),srt=core.toSrt(t);assert.match(srt,/AI\ntạo video\./);assert.ok(!srt.includes('<span'));assert.deepEqual(ct.phrases.map(p=>[p.start,p.end]),t.phrases.map(p=>[p.start,p.end]));
 b.captions.enabled=false;assert.equal(core.toSrt(core.buildTimeline(b,audio)),srt);
 const short=structuredClone(b);short.scenes[0].phrases[0].speechText='a'.repeat(120);assert.ok(estimateScenes(short)[0].end>estimateScenes(b)[0].end);
});
test('equivalent whitespace preserves valid implicit caption emphasis through narration and P7.5',()=>{
 const b=brief();b.scenes[0].phrases[0].caption={emphasis:['AI tạo']};const s=b.scenes[0],n=rewriteNarration(s,'AI   tạo video.\nHình ảnh theo lời kể.');assert.doesNotThrow(()=>canonicalBrief({...b,scenes:[n]}));assert.deepEqual(n.phrases[0],s.phrases[0]);const board=contentBoardFromDraft(b);board.items[0].narration[0]=' AI   tạo video. ';const applied=applyContentBoard(b,board);assert.doesNotThrow(()=>canonicalBrief(applied));assert.deepEqual(applied.scenes[0].phrases[0],s.phrases[0]);
});
