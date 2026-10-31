import {validateContentCandidate,validateContentBrief,validateRole,validateBoardContent,missingContent,contentLayouts,applyContentBoard,contentTargetCurrent,isProtectedContentScene} from './content-model.mjs';
export function boardFromCandidate(draft,value){
 const candidate=validateContentCandidate(value),ordinary=draft.scenes.filter(s=>!isProtectedContentScene(s));
 return {title:candidate.title,contentBrief:structuredClone(draft.contentBrief),items:candidate.scenes.map((s,i)=>({...s,targetSceneId:ordinary[i]?.id??null,accept:true,replaceProtectedVisual:false}))};
}
export function boardIssue(item){if(!item.accept)return '';return [...missingContent(item),...(item.needsInput??[])].join('; ');}
export function applyBoard(capture,state,board){if(!contentTargetCurrent(capture,state))throw Error('CONTENT_STALE');return applyContentBoard(state.draft,board);}
export function attemptMatchesTarget(attempt,target){return !!attempt&&attempt.projectId===target.projectId&&attempt.projectRevision===target.revision&&attempt.draftHash===target.baseHash;}
export function recordBoardInput(state,index,field,value){const s=state.board.items[index];if(!s)throw Error('CONTENT_TARGET_MISSING');s[field]=value;state.edits++;state.unsent=true;}
const keys=(v,allowed)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw Error('CONTENT_CACHE_INVALID');};
function validateCache(v,projectId){
 keys(v,['projectId','revision','baseHash','attemptId','board']);if(v.projectId!==projectId||!/^[a-z][a-z0-9_-]{0,47}$/.test(v.projectId??'')||!Number.isSafeInteger(v.revision)||v.revision<1||!/^[a-f0-9]{64}$/.test(v.baseHash??'')||v.attemptId!==null&&!/^content-[a-f0-9-]{36}$/.test(v.attemptId??''))throw Error('CONTENT_CACHE_INVALID');
 const b=v.board;keys(b,['title','contentBrief','items']);if(typeof b.title!=='string'||!b.title.trim()||b.title.length>80||!Array.isArray(b.items)||b.items.length>20)throw Error('CONTENT_CACHE_INVALID');if(b.contentBrief!==undefined)validateContentBrief(b.contentBrief);
 for(const s of b.items){
  keys(s,['targetSceneId','accept','replaceProtectedVisual','role','title','narration','layout','content','media','reason','needsInput']);
  if(s.targetSceneId!==null&&!/^[a-z][a-z0-9_-]{0,47}$/.test(s.targetSceneId??'')||typeof s.accept!=='boolean'||typeof s.replaceProtectedVisual!=='boolean'||typeof s.title!=='string'||!s.title.trim()||s.title.length>70||!Array.isArray(s.narration)||s.narration.length<1||s.narration.length>30||s.narration.some(v=>typeof v!=='string'||!v.trim()||v.length>240)||![...contentLayouts,'whiteboard','motion-lab','media','script','voice','timeline','render','edit','output'].includes(s.layout))throw Error('CONTENT_CACHE_INVALID');
  validateRole(s.role);validateBoardContent(s.content);if(s.reason!==undefined&&(typeof s.reason!=='string'||s.reason.length>240))throw Error('CONTENT_CACHE_INVALID');if(!Array.isArray(s.needsInput)||s.needsInput.length>8||s.needsInput.some(v=>typeof v!=='string'||v.length>240))throw Error('CONTENT_CACHE_INVALID');
  if(s.media!==undefined){keys(s.media,['kind','path','sha256','fit','start','end','motion']);if(!['image','video'].includes(s.media.kind)||typeof s.media.path!=='string'||!/^outputs\/[a-zA-Z0-9_./-]+\.(png|mp4)$/.test(s.media.path)||!/^[a-f0-9]{64}$/.test(s.media.sha256??''))throw Error('CONTENT_CACHE_INVALID');}
 }
 return v;
}
export function encodeBoard(value){validateCache(value,value.projectId);const source=JSON.stringify(value);if(new TextEncoder().encode(source).length>65536)throw Error('CONTENT_CACHE_TOO_LARGE');return source;}
export function restoreBoard(source,projectId){if(typeof source!=='string'||new TextEncoder().encode(source).length>65536)throw Error('CONTENT_CACHE_TOO_LARGE');try{return validateCache(JSON.parse(source),projectId);}catch{throw Error('CONTENT_CACHE_INVALID');}}
export function cacheBoard(storage,key,value){try{storage.setItem(key,encodeBoard(value));return {persisted:true};}catch{return {persisted:false};}}
