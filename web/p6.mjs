import {quantizeTrim,snapToPhrase,splitCandidates,splitSceneAtPhrase,captureEdit,editCaptureCurrent,timelineForEditing} from './clip-tools.mjs';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=t=>Number(t).toFixed(2)+' s';
export function initP6({getState,change,editScene,api,act,message,onSeek}){
 let target='',capture=null,asset=null,choices=[],viewSignature='';
 const scissors='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="5" cy="6" r="3"/><circle cx="5" cy="18" r="3"/><path d="m8 8 13 13M8 16 21 3"/></svg>';
 $('clip-controls').insertAdjacentHTML('beforeend',`<button id="open-trim" class="wide cut-entry">${scissors}Mở bàn cắt clip</button>`);
 document.querySelector('.timeline-area > .section-heading').insertAdjacentHTML('afterend',`<section class="cut-toolbar" aria-label="Chỉnh nhịp"><label class="check-label snap-switch"><input id="snap-phrases" type="checkbox" checked>Snap lời đọc</label><div class="phrase-navigation"><button id="phrase-prev" aria-label="Mốc lời đọc trước">‹</button><button id="phrase-next" aria-label="Mốc lời đọc sau">›</button></div><div class="split-action"><label>Mốc chia cảnh<select id="split-phrase" aria-label="Mốc chia cảnh"></select></label><button id="split-nearest">Lấy mốc gần con trỏ</button><button id="split-scene" class="cut-entry">${scissors}Chia cảnh</button></div><label class="tail-control">Giữ hình cuối cảnh<input id="tail-hold" type="range" min="0" max="10" step="0.1"><output id="tail-value"></output></label><p id="cut-status" class="hint" role="status"></p></section><div id="phrase-markers" class="phrase-markers" aria-label="Mốc lời đọc"></div>`);
 document.body.insertAdjacentHTML('beforeend',`<dialog id="trim-dialog"><header class="trim-heading"><div><h2>Bàn cắt clip</h2><p id="trim-name" class="hint"></p></div><button id="close-trim" aria-label="Đóng bàn cắt">×</button></header><div class="source-label"><span class="source-dot"></span>Video nguồn · không tiếng<output id="source-clock">0.00 s</output></div><video id="source-video" controls muted playsinline preload="metadata"></video><label class="source-cursor-label">Con trỏ nguồn<input id="source-cursor" type="range" min="0" step="0.0333333333" value="0"></label><div class="trim-selection" aria-hidden="true"><div id="trim-selected"></div></div><div class="trim-points"><label>Điểm vào<input id="trim-in" type="range" min="0" step="0.0333333333"><output id="trim-in-value"></output></label><label>Điểm ra<input id="trim-out" type="range" min="0" step="0.0333333333"><output id="trim-out-value"></output></label></div><div class="source-actions"><button id="source-back" aria-label="Lùi một frame nguồn">−1 frame</button><button id="source-next" aria-label="Tiến một frame nguồn">+1 frame</button><button id="mark-source-in">Đặt điểm vào tại con trỏ</button><button id="mark-source-out">Đặt điểm ra tại con trỏ</button></div><p id="trim-summary" role="status"></p><p class="hint">Cắt hình nguồn, giữ nguyên lời đọc. Nguồn ngắn hơn cảnh sẽ giữ frame cuối. Chưa áp dụng thì dự án giữ nguyên.</p><footer class="trim-footer"><button id="cancel-trim">Hủy</button><button id="apply-trim" class="primary">Áp dụng điểm cắt</button></footer></dialog>`);
 const dialog=$('trim-dialog'),video=$('source-video');
 const close=()=>dialog.close();$('close-trim').onclick=$('cancel-trim').onclick=close;dialog.addEventListener('close',()=>{video.pause();video.removeAttribute('src');video.load();capture=null;asset=null;});
 $('open-trim').onclick=act(async()=>{
  const s=getState(),m=s.draft?.scenes[s.selected]?.media;if(m?.kind!=='video')throw Error('Chọn cảnh có video trước.');
  const captured=captureEdit(s),assets=await api('/api/assets');
  if(!editCaptureCurrent(captured,getState()))throw Error('Cảnh đã thay đổi khi tải nguồn. Mở bàn cắt lại.');
  const a=assets.find(a=>a.kind==='video'&&a.path===m.path&&a.sha256===m.sha256);
  if(!a)throw Error('Clip chưa có trong thư viện media hiện tại.');
  asset=a;capture=captured;$('trim-name').textContent=a.name+' · '+fmt(a.duration);
  for(const id of ['trim-in','trim-out','source-cursor'])$(id).max=a.duration;
  $('trim-in').value=m.start;$('trim-out').value=m.end;$('source-cursor').value=m.start;
  video.src='/api/assets/'+encodeURIComponent(a.id)+'/file';video.muted=true;
  video.onloadedmetadata=()=>{if(dialog.open&&capture===captured)video.currentTime=m.start;};
  dialog.showModal();localTrim();
 });
 function localTrim(){
  const start=Number($('trim-in').value),end=Number($('trim-out').value);
  $('trim-in-value').textContent=fmt(start);$('trim-out-value').textContent=fmt(end);
  $('trim-selected').style.left=100*start/(asset?.duration??1)+'%';$('trim-selected').style.width=100*Math.max(0,end-start)/(asset?.duration??1)+'%';
  try{const q=quantizeTrim(start,end,asset?.duration);$('trim-summary').textContent='Đoạn chọn '+fmt(q.end-q.start)+' · '+Math.round((q.end-q.start)*30)+' frame ở 30 fps';$('apply-trim').disabled=false;}
  catch{$('trim-summary').textContent='Giữ điểm ra sau điểm vào ít nhất 1 frame.';$('apply-trim').disabled=true;}
 }
 for(const id of ['trim-in','trim-out'])$(id).oninput=()=>{localTrim();video.pause();video.currentTime=Math.min(Number($(id).value),Math.max(0,(asset?.duration??0)-1/30));};
 const moveSource=t=>{if(asset){video.pause();video.currentTime=Math.max(0,Math.min(asset.duration-1/30,t));}};
 $('source-cursor').oninput=()=>moveSource(Number($('source-cursor').value));
 video.ontimeupdate=()=>{$('source-clock').textContent=fmt(video.currentTime);$('source-cursor').value=video.currentTime;};
 video.onerror=()=>{if(dialog.open)$('trim-summary').textContent='Chưa đọc được video nguồn. Đóng và mở lại bàn cắt để thử nguồn hiện tại.';};
 $('source-back').onclick=()=>moveSource(video.currentTime-1/30);$('source-next').onclick=()=>moveSource(video.currentTime+1/30);
 $('mark-source-in').onclick=()=>{$('trim-in').value=Math.round(video.currentTime*30)/30;localTrim();};
 $('mark-source-out').onclick=()=>{$('trim-out').value=Math.min(asset.duration,Math.round((video.currentTime+1/30)*30)/30);localTrim();};
 $('apply-trim').onclick=act(()=>{
  if(!editCaptureCurrent(capture,getState()))throw Error('Cảnh hoặc bản lưu đã đổi. Đóng và mở lại bàn cắt; điểm cắt chưa được áp dụng.');
  const q=quantizeTrim(Number($('trim-in').value),Number($('trim-out').value),asset.duration);
  editScene(s=>s.media={...s.media,...q});close();message('Đã áp dụng điểm cắt. Hoàn tác sẽ khôi phục cả hai điểm.');
 });
 $('tail-hold').oninput=()=> $('tail-value').textContent=fmt($('tail-hold').value);
 $('tail-hold').onchange=()=>editScene(s=>s.hold=Number($('tail-hold').value));
 function activeTimeline(){const s=getState();return timelineForEditing(s);}
 $('phrase-markers').onclick=ev=>{const b=ev.target.closest('[data-phrase-time]');if(b)onSeek(Number(b.dataset.phraseTime));};
 for(const [id,direction] of [['phrase-prev',-1],['phrase-next',1]])$(id).onclick=()=>{
  const s=getState(),t=s.measured??s.previewData?.timeline,starts=(t?.phrases??[]).map(p=>p.start);
  const next=direction<0?starts.filter(v=>v<s.time-.02).at(-1):starts.find(v=>v>s.time+.02);if(next!==undefined)onSeek(next);
 };
 $('split-phrase').onchange=()=>{target=$('split-phrase').value;updateStatus();};
 $('split-nearest').onclick=()=>{if(!choices.length)return;target=choices.reduce((best,c)=>Math.abs(c.time-getState().time)<Math.abs(best.time-getState().time)?c:best).phraseId;$('split-phrase').value=target;updateStatus();};
 $('split-scene').onclick=act(()=>{const s=getState(),t=activeTimeline();if(!t||!target)throw Error('Cập nhật preview đúng nháp rồi chọn mốc chia.');change(splitSceneAtPhrase(s.draft,s.selected,target,t,'scene-'+crypto.randomUUID().slice(0,12),'shot-'+crypto.randomUUID().slice(0,12)));message('Đã chia trước cụm đã chọn. Cảnh mới thêm 0,42 giây nghỉ; lời đọc giữ nguyên. Hoàn tác để ghép lại.');});
 function updateStatus(){const c=choices.find(c=>c.phraseId===target);$('cut-status').textContent=c?'Chia trước “'+c.text.slice(0,65)+'” tại '+fmt(c.time)+' · thêm 0,42 s nghỉ':getState().measured&&!getState().measuredEditable?'Bản xuất khác nháp: chỉ xem/tua. Cập nhật preview để chỉnh.':'Cập nhật preview, rồi chọn cảnh có ít nhất hai cụm đọc để chia.';$('split-scene').disabled=!c;}
 function render(){
  const s=getState();if(!s.draft)return;const scene=s.draft.scenes[s.selected],t=s.measured??s.previewData?.timeline;
  $('tail-hold').value=scene.hold??0;$('tail-value').textContent=fmt(scene.hold??0);
  try{choices=activeTimeline()?splitCandidates(s.draft,s.selected,activeTimeline()):[];}catch{choices=[];}
  if(!choices.some(c=>c.phraseId===target))target=choices[0]?.phraseId??'';
  $('split-phrase').innerHTML=choices.map(c=>`<option value="${esc(c.phraseId)}">${fmt(c.time)} · ${esc(c.text.slice(0,45))}</option>`).join('')||'<option value="">Chưa có mốc chia</option>';$('split-phrase').value=target;
  $('split-phrase').disabled=$('split-nearest').disabled=!choices.length;updateStatus();
  const signature=JSON.stringify([t?.id,t?.phrases?.map(p=>[p.id,p.start]),t?.duration,!!s.measured]);
  if(signature!==viewSignature){viewSignature=signature;$('phrase-markers').innerHTML=t?.phrases?.length?`<span>${s.measured?'Lời đo thật':'Lời · nháp'}</span><div>${t.phrases.map((p,i)=>`<button data-phrase-time="${p.start}" style="left:${100*p.start/t.duration}%" title="${esc(p.text)}" aria-label="Cụm ${i+1}: ${esc(p.text)}"><i></i><small>${i+1}</small></button>`).join('')}</div>`:'';}
  $('phrase-prev').disabled=$('phrase-next').disabled=!t?.phrases?.length;
 }
 function snap(t){const s=getState(),timeline=s.measured??s.previewData?.timeline;if(!$('snap-phrases').checked||!timeline)return t;const width=$('scrub').getBoundingClientRect().width;return snapToPhrase(t,timeline.phrases,Math.min(.25,8*timeline.duration/Math.max(1,width)));}
 function clock(){if(!getState().draft)return;const time=getState().time;for(const b of $('phrase-markers').querySelectorAll('[data-phrase-time]'))b.classList.toggle('passed',Number(b.dataset.phraseTime)<=time+.001);}
 return {render,clock,snap};
}
