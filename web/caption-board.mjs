import {validateCaptionSettings,validatePhraseOverrides,effectiveSpeechText} from './captions.mjs';
const keys=(v,allowed)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw Error('INVALID_CAPTION_BOARD');};
export function captionBoardFromDraft(draft){return {settings:structuredClone(draft.captions??{enabled:true,style:'box',fontSize:27}),phrases:draft.scenes.flatMap(s=>s.phrases.map(p=>structuredClone(p)))};}
export function captureCaptionTarget({project,draft}){return {projectId:project.brief.id,revision:project.revision,draftJson:JSON.stringify(draft)};}
export const captionTargetCurrent=(capture,state)=>!!capture&&capture.projectId===state.project?.brief.id&&capture.revision===state.project?.revision&&capture.draftJson===JSON.stringify(state.draft);
export function applyCaptionBoard(draft,board){
 keys(board,['settings','phrases']);const settings=validateCaptionSettings(board.settings),old=draft.scenes.flatMap(s=>s.phrases);
 if(!Array.isArray(board.phrases)||board.phrases.length!==old.length)throw Error('INVALID_CAPTION_BOARD');
 const next=structuredClone(draft),phrases=next.scenes.flatMap(s=>s.phrases);next.captions=settings;
 for(const [i,p] of board.phrases.entries()){keys(p,['id','text','caption','speechText']);if(p.id!==old[i].id||p.text!==old[i].text)throw Error('INVALID_CAPTION_TARGET');const overrides=validatePhraseOverrides(p);delete phrases[i].caption;delete phrases[i].speechText;Object.assign(phrases[i],overrides);}
 return next;
}
export function captionResetCount(before,after){const old=new Map(before.scenes.flatMap(s=>s.phrases).map(p=>[p.id,p]));return after.scenes.flatMap(s=>s.phrases).filter(p=>{const previous=old.get(p.id);return previous&&(previous.caption!==undefined||previous.speechText!==undefined)&&p.caption===undefined&&p.speechText===undefined;}).length;}
export function captionCueRows(state){
 const phrases=state.draft.scenes.flatMap(s=>s.phrases),candidate=state.measuredEditable&&state.measured?.phrases;
 const measured=Array.isArray(candidate)&&candidate.length===phrases.length&&phrases.every((p,i)=>candidate[i].id===p.id&&Number.isFinite(candidate[i].start)&&Number.isFinite(candidate[i].end));
 let time=.6,index=0;const rows=[];for(const s of state.draft.scenes){for(const p of s.phrases){const real=measured?candidate[index]:null,start=real?.start??time,end=real?.end??start+Math.max(1.2,effectiveSpeechText(p).length/12);rows.push({sceneId:s.id,sceneTitle:s.title,phraseId:p.id,text:p.text,index:index++,start,end});time=end+.18;}time+=.42+(s.hold??0);}return {measured,rows};
}
