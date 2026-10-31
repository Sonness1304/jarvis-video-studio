import {validateBoard} from './whiteboard-model.mjs';
import {rewriteNarration} from './model.mjs';

export const contentLayouts=['kinetic','steps','spotlight','quote','compare','metric','diagram','product-card','story-card'];
export const isProtectedContentScene=s=>!!s&&(s.visual==='media'||s.visual==='whiteboard'||s.visual==='motion-lab'||!!s.shots);
export const contentRoles=['hook','context','explain','example','evidence','conclusion'];
export const contentStructures=[
 {id:'explain',name:'Giải thích kiến thức',hint:'Câu hỏi → cơ chế → ví dụ → điều cần nhớ',layouts:['kinetic','diagram','steps']},
 {id:'tutorial',name:'Hướng dẫn',hint:'Kết quả → chuẩn bị → từng bước → kiểm tra',layouts:['product-card','steps','diagram']},
 {id:'product',name:'Demo công cụ',hint:'Vấn đề → thao tác → kết quả → lời mời',layouts:['spotlight','product-card','compare']},
 {id:'story',name:'Kể chuyện',hint:'Bối cảnh → trở ngại → điểm chuyển → kết',layouts:['story-card','quote','kinetic']},
 {id:'comparison',name:'So sánh',hint:'Câu hỏi → tiêu chí → lựa chọn → kết luận',layouts:['compare','steps','diagram']},
 {id:'data',name:'Kể bằng số liệu',hint:'Số có nguồn → ý nghĩa → đối chiếu → kết',layouts:['metric','diagram','compare']}
];
const fail=code=>{throw Error(code);};
const object=(v,keys,code)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))fail(code);};
const text=(v,max,empty=false)=>typeof v==='string'&&v.length<=max&&(empty||v.trim().length>0)&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v);
export function validateRole(value){if(!contentRoles.includes(value))fail('INVALID_CONTENT_ROLE');return value;}
export function validateContentBrief(v){
 object(v,['subject','audience','goal','targetSeconds','structure','sourceNotes'],'INVALID_CONTENT_BRIEF');
 if(!text(v.subject,120)||!text(v.audience,180,true)||!text(v.goal,300,true)||!text(v.sourceNotes,6000,true)||!Number.isInteger(v.targetSeconds)||v.targetSeconds<15||v.targetSeconds>180||!contentStructures.some(s=>s.id===v.structure))fail('INVALID_CONTENT_BRIEF');
 return structuredClone(v);
}
export function validateBoardContent(v){
 object(v,['kicker','body','items','metric','label'],'INVALID_CONTENT');
 for(const [key,max] of [['kicker',60],['body',180],['metric',20],['label',70]])if(v[key]!==undefined&&!text(v[key],max))fail('INVALID_CONTENT');
 if(v.items!==undefined&&(!Array.isArray(v.items)||v.items.length<1||v.items.length>5||v.items.some(x=>!text(x,70))))fail('INVALID_CONTENT');
 return structuredClone(v);
}
export function missingContent(scene){
 const c=scene.content??{},missing=[];
 if(scene.layout==='metric'&&(!c.metric||!c.label))missing.push('Cần số liệu thật và nhãn có nguồn');
 if(['steps','compare','diagram'].includes(scene.layout)&&!c.items?.length)missing.push('Cần các ý chính cho sơ đồ');
 if(scene.layout==='media'&&!scene.media)missing.push('Chọn ảnh hoặc clip đã kiểm chứng');
 return missing;
}
export function validateContentCandidate(v){
 object(v,['schemaVersion','title','scenes'],'INVALID_CANDIDATE');
 if(v.schemaVersion!==1||!text(v.title,80)||!Array.isArray(v.scenes)||v.scenes.length<3||v.scenes.length>6||new TextEncoder().encode(JSON.stringify(v)).length>65536)fail('INVALID_CANDIDATE');
 const out=structuredClone(v);
 for(const s of out.scenes){
  object(s,['role','title','narration','layout','content','reason','needsInput'],'INVALID_CANDIDATE_SCENE');validateRole(s.role);
  if(!text(s.title,70)||!Array.isArray(s.narration)||s.narration.length<1||s.narration.length>3||s.narration.some(n=>!text(n,240))||![...contentLayouts,'media'].includes(s.layout)||!text(s.reason,240,true)||!Array.isArray(s.needsInput)||s.needsInput.length>8||s.needsInput.some(n=>!text(n,240)))fail('INVALID_CANDIDATE_SCENE');
  validateBoardContent(s.content);s.needsInput=[...new Set([...s.needsInput,...missingContent(s)])];
 }
 return out;
}
export function layoutChoices(structure,role){
 validateRole(role);const s=contentStructures.find(s=>s.id===structure);if(!s)fail('INVALID_CONTENT_BRIEF');
 return [...new Set([...(role==='hook'?['kinetic','spotlight']:role==='conclusion'?['kinetic','story-card']:[]),...s.layouts])].slice(0,3);
}
export function contentBoardFromDraft(draft){return {title:draft.title,contentBrief:structuredClone(draft.contentBrief),items:draft.scenes.map((s,i)=>({targetSceneId:s.id,accept:true,replaceProtectedVisual:false,role:s.role??(i===0?'hook':i===draft.scenes.length-1?'conclusion':'explain'),title:s.title,narration:s.phrases.map(p=>p.text),layout:s.visual,content:structuredClone(s.content??{}),media:structuredClone(s.media),reason:'Bản nháp hiện tại',needsInput:[]}))};}
export function applyContentBoard(draft,board){
 const out=structuredClone(draft),seen=new Set(),used=new Set(draft.scenes.flatMap(s=>[s.id,...s.phrases.map(p=>p.id),...(s.shots??[]).map(s=>s.id)]));
 if(!Array.isArray(board.items)||board.items.length>20)fail('INVALID_CONTENT_BOARD');
 if(board.contentBrief!==undefined)out.contentBrief=validateContentBrief(board.contentBrief);
 if(board.title!==undefined){if(!text(board.title,80))fail('INVALID_CONTENT_TITLE');out.title=board.title;}
 const fresh=()=>{let id;do{id='content-'+crypto.randomUUID().slice(0,12);}while(used.has(id));used.add(id);return id;};
 for(const item of board.items.filter(x=>x.accept)){
  const index=item.targetSceneId===null?-1:out.scenes.findIndex(s=>s.id===item.targetSceneId);
  if(item.targetSceneId!==null&&index<0)fail('CONTENT_TARGET_MISSING');
  if(seen.has(item.targetSceneId)&&item.targetSceneId!==null)fail('DUPLICATE_TARGET');seen.add(item.targetSceneId);
  const old=index<0?null:out.scenes[index];
  if(isProtectedContentScene(old)&&!item.replaceProtectedVisual)continue;
  validateRole(item.role);if(!text(item.title,70)||!Array.isArray(item.narration)||item.narration.length<1||item.narration.length>30||item.narration.some(n=>!text(n,240)))fail('INVALID_CONTENT_SCENE');
  if(![...contentLayouts,'media','script','voice','timeline','render','edit','output'].includes(item.layout)&&!(['motion-lab','whiteboard'].includes(item.layout)&&old?.visual===item.layout))fail('INVALID_CONTENT_LAYOUT');
  validateBoardContent(item.content??{});if(missingContent(item).length||item.needsInput?.length)fail('CONTENT_REQUIRED');
  let scene=old??{id:fresh(),hold:0,phrases:[]};scene=rewriteNarration(scene,item.narration.join('\n'),[...used]);scene.role=item.role;scene.title=item.title;scene.visual=item.layout;scene.content=structuredClone(item.content??{});
  if(item.layout!=='motion-lab')delete scene.lab;if(item.layout!=='whiteboard')delete scene.board;
  if(item.layout==='media'){scene.media=structuredClone(item.media);delete scene.shots;}else{delete scene.media;if(item.replaceProtectedVisual)delete scene.shots;}
  if(scene.visual==='whiteboard')validateBoard(scene.board,scene.phrases);scene.phrases.forEach(p=>used.add(p.id));
  if(index<0){if(out.scenes.length>=20)fail('TOO_MANY_SCENES');out.scenes.push(scene);}else out.scenes[index]=scene;
 }
 return out;
}
export function captureContentTarget(state){return {projectId:state.project.brief.id,revision:state.project.revision,draftJson:JSON.stringify(state.draft)};}
export function contentTargetCurrent(capture,state){return !!capture&&capture.projectId===state.project?.brief.id&&capture.revision===state.project?.revision&&capture.draftJson===JSON.stringify(state.draft);}
export async function draftContentHash(json){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(json)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
