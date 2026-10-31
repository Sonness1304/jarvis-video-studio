import {auditionContext,applyAudition} from './dubbing-audition-model.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const voiceKey=voice=>JSON.stringify(voice);
export const auditionMarkup=`<details id="dub-audition"><summary>So giọng trước khi tạo toàn bộ</summary><p>Chọn câu thoại có ngữ điệu rõ, nghe A/B rồi mới dùng cho nhân vật. Giọng riêng đã lưu cũng xuất hiện trong danh sách.</p><label>Câu nghe thử<select id="dub-audition-segment"></select></label><button type="button" id="dub-audition-source">Đến câu gốc</button><p id="dub-audition-text"></p><div class="split">${['a','b'].map(slot=>`<fieldset><legend>Giọng ${slot.toUpperCase()}</legend><label>Giọng nghe thử<select id="dub-audition-voice-${slot}"></select></label><button type="button" id="dub-audition-run-${slot}">Tạo mẫu ${slot.toUpperCase()}</button><div id="dub-audition-result-${slot}"></div><button type="button" id="dub-audition-use-${slot}">Dùng giọng ${slot.toUpperCase()}</button></fieldset>`).join('')}</div><p class="hint">Viết lời như hội thoại, ngắt nghỉ theo ý và giữ cảm xúc gốc. Giọng thử chưa được chọn tự động; cần nghe từng câu. Chưa đồng bộ khẩu hình.</p></details>`;
export function initDubbingAudition({getRecord,getVoices,run,assertIdle,remember,replaceDoc,renderAll,act,message}){
 const $=id=>document.getElementById(id),candidates={};let segmentId='';
 function current(){const d=getRecord()?.doc,s=d?.segments.find(s=>s.id===segmentId);if(!s?.targetText.trim())throw Error('DUB_AUDITION_TARGET');return {d,s};}
 function unavailable(el,value){el.dataset??={};el.dataset.auditionUnavailable=String(value);el.disabled=value;}
 function render(){
  const d=getRecord()?.doc,segments=d?.segments.filter(s=>s.targetText.trim())??[],select=$('dub-audition-segment');
  if(!segments.some(s=>s.id===segmentId))segmentId=segments[0]?.id??'';
  select.innerHTML=segments.map(s=>`<option value="${s.id}">${s.start.toFixed(1)}s · ${esc(s.targetText.slice(0,65))}</option>`).join('');select.value=segmentId;
  $('dub-audition-text').textContent=segments.find(s=>s.id===segmentId)?.targetText??'Dịch hoặc nhập lời Việt trước khi so giọng.';
  unavailable($('dub-audition-source'),!segmentId);
  for(const slot of ['a','b']){
   const pick=$('dub-audition-voice-'+slot),saved=pick.value;
   const voices=getVoices();
   pick.innerHTML='<option value="">Chọn giọng để nghe</option>'+voices.map(v=>`<option value="${esc(voiceKey(v.identity))}">${esc(v.label)}</option>`).join('');pick.value=voices.some(v=>voiceKey(v.identity)===saved)?saved:'';
   const candidate=candidates[slot],valid=!!candidate&&!!d&&!!segmentId&&candidate.context===auditionContext(d,segmentId);
   $('dub-audition-result-'+slot).innerHTML=candidate?(valid?`<p>${esc(candidate.label)} · ${candidate.job.result.duration.toFixed(2)}s</p><audio controls preload="none" src="/api/artifacts/${candidate.job.id}/audio"></audio>`:'<p>Câu hoặc phân vai đã đổi. Mẫu cũ vẫn trong lịch sử tác vụ.</p>'):'';
   unavailable($('dub-audition-use-'+slot),!valid);unavailable($('dub-audition-run-'+slot),!segmentId);
  }
 }
 $('dub-audition-segment').onchange=()=>{assertIdle();segmentId=$('dub-audition-segment').value;render();};
 $('dub-audition-source').onclick=act(()=>{assertIdle();const {s}=current();$('dub-source-preview').currentTime=s.start;message('Đã đến câu gốc. Bấm phát video để nghe đối chiếu.');});
 for(const slot of ['a','b']){
  $('dub-audition-run-'+slot).onclick=act(async()=>{
   assertIdle();const {d,s}=current(),value=$('dub-audition-voice-'+slot).value,choice=getVoices().find(v=>voiceKey(v.identity)===value);if(!choice)throw Error('Chọn giọng nghe thử trước.');
   const context=auditionContext(d,s.id),voice=structuredClone(choice.identity);delete candidates[slot];
   const job=await run('audition',{segmentId:s.id,voice});
   if(context!==auditionContext(getRecord().doc,s.id))throw Error('DUB_AUDITION_STALE');
   candidates[slot]={context,voice,job,label:choice.label};renderAll();
  });
  $('dub-audition-use-'+slot).onclick=act(()=>{assertIdle();const {d,s}=current(),next=applyAudition(d,s.id,candidates[slot]);remember();replaceDoc(next);renderAll();message(s.speakerId?'Đã chọn giọng cho nhân vật và giữ bản nghe thử của câu này. Các câu có giọng riêng khác vẫn được giữ.':'Đã chọn giọng và bản đọc cho riêng câu này.');});
 }
 return {render};
}
