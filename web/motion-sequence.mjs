import {validateImageMotion} from './image-motion.mjs';
export const motionPresets={
 explain:{name:'Giải thích',hint:'Dẫn mắt theo từng ý',moves:['push-in','pan-left','pan-right','still']},
 story:{name:'Kể chuyện',hint:'Tiến vào rồi mở câu chuyện',moves:['push-in','pan-right','pan-left','pull-out']},
 product:{name:'Sản phẩm',hint:'Đặt điểm nhìn, nhấn chi tiết',moves:['still','push-in','pan-left','pull-out']},
 social:{name:'Mạng xã hội',hint:'Đổi hướng giữa các cảnh',moves:['push-in','pan-left','pull-out','pan-right']}
};
export const motionNames={still:'Đứng yên','push-in':'Tiến gần','pull-out':'Lùi xa','pan-left':'Lia trái','pan-right':'Lia phải'};
export const motionLabel=m=>m?motionNames[m.preset]+' · '+({gentle:'Êm',medium:'Cân bằng',strong:'Nổi bật'}[m.strength]):'Mặc định';
export const suggestMotionPreset=brief=>Object.hasOwn(motionPresets,brief?.preset)?brief.preset:'explain';
export function motionSequence(brief,{preset,energy,overwrite}){
 if(!Object.hasOwn(motionPresets,preset)||!['gentle','medium','strong'].includes(energy)||typeof overwrite!=='boolean')throw Error('INVALID_SEQUENCE_OPTIONS');
 let position=0;const rows=brief.scenes.map((s,index)=>{
  const row={id:s.id,title:s.title,index,before:s.media?.motion,status:'skip',reason:s.visual==='media'&&s.media?.kind==='video'?'Clip giữ nguyên':s.shots?'Storyboard giữ nguyên':'Bố cục giữ nguyên'};
  if(s.visual!=='media'||s.media?.kind!=='image'||s.shots)return row;
  const after=validateImageMotion({preset:motionPresets[preset].moves[position++%motionPresets[preset].moves.length],strength:energy});
  if(s.media.motion&&!overwrite)return {...row,status:'protected',reason:'Giữ chỉnh tay'};
  const same=s.media.motion?.preset===after.preset&&s.media.motion?.strength===after.strength;
  return {...row,after,status:same?'same':'change',reason:same?'Đã khớp':'Sẽ áp dụng'};
 });
 return {rows,images:position,changes:rows.filter(r=>r.status==='change').length,protected:rows.filter(r=>r.status==='protected').length,skipped:rows.filter(r=>r.status==='skip').length};
}
export function applySequence(brief,options){const plan=motionSequence(brief,options),next=structuredClone(brief);for(const row of plan.rows)if(row.status==='change')next.scenes[row.index].media.motion=structuredClone(row.after);return next;}
export function captureSequence(s){return {projectId:s.project?.brief.id,revision:s.project?.revision,draft:JSON.stringify(s.draft)};}
export const sequenceCurrent=(capture,s)=>!!capture?.projectId&&!!s.draft&&JSON.stringify(capture)===JSON.stringify(captureSequence(s));
