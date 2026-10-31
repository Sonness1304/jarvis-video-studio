import {styleLibrary} from '../web/style-library-model.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {validateBrief,safeChild} from './core.mjs';import {hashFile} from './runtime.mjs';
export const catalog={schemaVersion:1,templates:[
 {id:'explain-short',name:'Explain an Idea',beats:['The Question','The Explanation','Takeaway'],preset:'explain'},
 {id:'story-short',name:'Short Story',beats:['Introduction','The Pivot','Conclusion'],preset:'story'},
 {id:'knowledge-map',name:'Knowledge Diagram',beats:['The Problem','Connecting Ideas','Application'],preset:'explain',visuals:['kinetic','diagram','steps']},
 {id:'product-demo',name:'Tool & Workflow Demo',beats:['Benefits','How It Works','Results'],preset:'product',visuals:['product-card','diagram','metric']},
 {id:'narrative-notes',name:'Narrative Journal',beats:['Beginning','Turning Point','Reflection'],preset:'story',visuals:['story-card','quote','story-card']},
 {id:'listicle',name:'Quick Tips & Checklist',beats:['Overview','Key Takeaways','Next Steps'],preset:'social',visuals:['kinetic','steps','quote']},
 {id:'product-showcase',name:'Product Showcase',beats:['The Challenge','Key Highlights','Call to Action'],preset:'product',visuals:['kinetic','spotlight','steps']},
 {id:'quote-story',name:'One Quote, One Insight',beats:['The Quote','Context','Takeaway'],preset:'story',visuals:['quote','kinetic','quote']},
 {id:'comparison',name:'Side-by-Side Comparison',beats:['The Dilemma','Contrast','Decision'],preset:'explain',visuals:['kinetic','compare','steps']},
 {id:'data-story',name:'Data-Driven Story',beats:['The Number','Context','Conclusion'],preset:'explain',visuals:['metric','steps','kinetic']},
 {id:'photo-story',name:'Visual Journey & Photo Essay',beats:['The Hook','Visual Story','Closing'],preset:'story',visuals:['quote','spotlight','kinetic']}
],themes:styleLibrary.map(({id,name})=>({id,name}))};
export async function readVoices(root){
 if(root instanceof URL)root=fileURLToPath(root);
 try {
  const config=JSON.parse(await fs.readFile(path.join(root,'runtime-config.json'),'utf8'));
  const file=safeChild(root,config.paths.voices);
  if(await hashFile(file)===config.hashes.voices){
   const bank=JSON.parse(await fs.readFile(file,'utf8'));
   if(bank.presets&&typeof bank.presets==='object'){
    return Object.entries(bank.presets).map(([name,v])=>({name,description:v.description,gender:v.gender,region:v.region,style:v.style,aliases:v.aliases??[]}));
   }
  }
 } catch {}
 try {
  const metaFile=safeChild(root,'assets/voices_metadata.json');
  const meta=JSON.parse(await fs.readFile(metaFile,'utf8'));
  if(Array.isArray(meta)&&meta.length)return meta;
 } catch {}
 return [
  {name:'Hải Đăng',description:'Nam · Bắc · Tự nhiên',gender:'Nam',region:'Bắc',style:'tu_nhien',aliases:['Minh Quân']},
  {name:'Thục Đoan',description:'Nữ · Nam · Truyền cảm',gender:'Nữ',region:'Nam',style:'truyen_cam',aliases:[]}
 ];
}
export function canonicalVoice(name,voices){
 const direct=voices.find(v=>v.name===name);if(direct)return direct.name;
 const alias=voices.find(v=>v.aliases.includes(name));if(alias)return alias.name;throw Error('UNKNOWN_PRESET_VOICE');
}
export function newBrief({template,theme,voice,id},voices){
 const selected=catalog.templates.find(t=>t.id===template);if(!selected)throw Error('UNKNOWN_TEMPLATE');
 if(!catalog.themes.some(t=>t.id===theme))throw Error('INVALID_THEME');
 const story=selected.preset==='story';
 const scenes=selected.visuals?selected.visuals.map((v,i)=>['beat-'+i,selected.beats[i],v,['Write your opening thought here.','Replace sample text with your verified insights.','Conclude with a key takeaway for the audience.'][i]]):story?[
  ['opening','A Spark of Curiosity','script','Every great story starts with a simple observation.'],
  ['turn','Finding the Rhythm','timeline','When pacing and visuals align, complex concepts become effortless to understand.'],
  ['ending','The Complete Picture','output','Code-driven motion graphics bring clarity to short-form storytelling.']
 ]:[
  ['question','Where Does Storytelling Begin?','script','To make an engaging video, start with a single compelling idea.'],
  ['answer','Voice Drives the Visuals','voice','Structure clear narration cues, then align kinetic typography and animation to speech.'],
  ['result','Preview, Polish, Export','output','Review live playback, adjust timing frame-by-frame, and export high-definition MP4.']
 ];
 return validateBrief({schemaVersion:1,id,title:selected.name,preset:selected.preset,template,theme,voice:canonicalVoice(voice,voices),accent:styleLibrary.slice(5).find(s=>s.id===theme)?.accent??(theme==='dark-cinema'?'#80D5EA':theme==='paper-story'?'#375B38':theme==='bold-pop'?'#B24024':'#3569CC'),scenes:scenes.map(([id,title,visual,text],i)=>({id,title,visual,hold:0,...(selected.visuals?{content:{kicker:'Nội dung mẫu',body:'Sửa nội dung theo chủ đề của bạn.',items:['Ý thứ nhất','Ý thứ hai','Ý thứ ba'],metric:'42',label:'Số liệu minh họa'}}:{}),phrases:[{id:'phrase-'+i,text}]}))});
}
export async function writeNewBrief(root,relative,brief){
 const target=safeChild(root,relative);validateBrief(brief);
 await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,JSON.stringify(brief,null,2)+'\n',{flag:'wx'});
 return {status:'VERIFIED',executionStatus:'UNVERIFIED',brief:relative,id:brief.id};
}
