const fail=code=>{throw Error(code);};
const object=(v,keys,code)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))fail(code);};
export const captionStyles=[{id:'box',name:'Nền hộp'},{id:'minimal',name:'Chữ gọn'},{id:'outline',name:'Viền rõ'},{id:'marker',name:'Nhấn từ'},{id:'editorial',name:'Dải phụ đề'}];
export function validateCaptionSettings(v){
 object(v,['enabled','style','fontSize','textColor','highlightColor','position'],'INVALID_CAPTIONS');
 if(typeof v.enabled!=='boolean'||!captionStyles.some(s=>s.id===v.style)||!Number.isFinite(v.fontSize)||v.fontSize<20||v.fontSize>44)fail('INVALID_CAPTIONS');
 for(const k of ['textColor','highlightColor'])if(v[k]!==undefined&&(typeof v[k]!=='string'||!/^#[a-f0-9]{6}$/i.test(v[k])))fail('INVALID_CAPTIONS');
 if(v.position!==undefined&&!['bottom','middle','top'].includes(v.position))fail('INVALID_CAPTIONS');return structuredClone(v);
}
export const effectiveSpeechText=p=>p.speechText??p.text;
export const effectiveCaptionText=p=>(p.caption?.text??p.text).normalize('NFC').split('\n').filter(v=>v.trim()).join('\n');
export const narrationEquivalent=(a,b)=>a.normalize('NFC').trim().replace(/[ \t\r\n]+/g,' ')===b.normalize('NFC').trim().replace(/[ \t\r\n]+/g,' ');
function keywordMatches(text,words){
 const graphemes=[...new Intl.Segmenter('vi',{granularity:'grapheme'}).segment(text)];
 const boundaries=new Map([[0,0]]);let folded='',offset=0;
 for(const g of graphemes){folded+=g.segment.toLowerCase();offset=g.index+g.segment.length;boundaries.set(folded.length,offset);}
 const candidates=[];
 for(const word of words){const key=word.normalize('NFC').toLowerCase();let at=0,found=false;
  while((at=folded.indexOf(key,at))!==-1){const end=at+key.length;if(boundaries.has(at)&&boundaries.has(end)){found=true;candidates.push({start:boundaries.get(at),end:boundaries.get(end)});}at+=Math.max(1,key.length);}
  if(!found)fail('INVALID_CAPTION_EMPHASIS');
 }
 const chosen=[];for(const c of candidates.sort((a,b)=>(b.end-b.start)-(a.end-a.start)||a.start-b.start))if(!chosen.some(x=>c.start<x.end&&c.end>x.start))chosen.push(c);
 return chosen.sort((a,b)=>a.start-b.start);
}
export function validatePhraseOverrides(p){
 const out={};if(p.speechText!==undefined){const v=p.speechText;if(typeof v!=='string'||!v.trim()||v.length>240||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v))fail('INVALID_SPEECH_TEXT');out.speechText=v;}
 if(p.caption!==undefined){const v=p.caption;object(v,['text','emphasis'],'INVALID_CAPTION');const caption={};
  if(v.text!==undefined){if(typeof v.text!=='string'||!v.text.trim()||v.text.length>360||/[\x00-\x09\x0B-\x1F\x7F]/.test(v.text))fail('INVALID_CAPTION_TEXT');const lines=v.text.normalize('NFC').split('\n').filter(s=>s.trim());if(lines.length>3||lines.some(s=>s.length>120))fail('INVALID_CAPTION_TEXT');caption.text=lines.join('\n');}
  if(v.emphasis!==undefined){if(!Array.isArray(v.emphasis)||v.emphasis.length>8||v.emphasis.some(s=>typeof s!=='string'||!s.trim()||s.length>40||/[\x00-\x1F\x7F]/.test(s)))fail('INVALID_CAPTION_EMPHASIS');const words=v.emphasis.map(s=>s.normalize('NFC'));if(new Set(words.map(s=>s.toLowerCase())).size!==words.length)fail('INVALID_CAPTION_EMPHASIS');keywordMatches(effectiveCaptionText({...p,caption}),words);caption.emphasis=words;}
  out.caption=caption;
 }return out;
}
export function captionSegments(p){
 const checked=validatePhraseOverrides(p),text=effectiveCaptionText({...p,...checked}),matches=keywordMatches(text,checked.caption?.emphasis??[]),segments=[];let at=0;
 for(const m of matches){if(m.start>at)segments.push({text:text.slice(at,m.start),emphasis:false});segments.push({text:text.slice(m.start,m.end),emphasis:true});at=m.end;}
 if(at<text.length)segments.push({text:text.slice(at),emphasis:false});return segments;
}
export function captionPresentation(settings,{width,height,accent}){
 const v=settings===undefined?{enabled:true,style:'box',fontSize:27}:validateCaptionSettings(settings);
 const darkText=['minimal','marker'].includes(v.style);
 return {style:v.style,textColor:v.textColor??(v.style==='box'?null:darkText?'inherit':'#FFFFFF'),highlightColor:v.highlightColor??accent,position:v.position??'bottom',fontSize:v.fontSize,width,height};
}
