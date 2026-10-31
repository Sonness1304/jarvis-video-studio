import {cloneBoard} from './whiteboard-model.mjs';
import {effectiveSpeechText,narrationEquivalent} from './captions.mjs';
const copy=v=>structuredClone(v);
export function savedDraftState(currentRecord,currentDraft,snapshot,response){
 if(currentRecord?.brief.id!==snapshot.id||response?.brief.id!==snapshot.id||currentRecord.revision>response.revision)return {apply:false};
 return {apply:true,dirty:JSON.stringify(currentDraft)!==JSON.stringify(snapshot)};
}
export const artifactResponseCurrent=(capture,current)=>capture.generation===current.generation&&capture.projectId===current.projectId&&capture.request===current.request;
const index=(b,i)=>{if(!Number.isInteger(i)||i<0||i>=b.scenes.length)throw Error('INVALID_SCENE_INDEX');};
export function editSceneValue(brief,i,fn){index(brief,i);const next=copy(brief),scene=next.scenes[i];fn(scene);if(scene.visual!=='motion-lab')delete scene.lab;if(scene.visual!=='whiteboard')delete scene.board;return next;}
export function reorderScene(b,from,to){index(b,from);index(b,to);const c=copy(b);c.scenes.splice(to,0,c.scenes.splice(from,1)[0]);return c;}
export function duplicateScene(b,i,id){index(b,i);if(b.scenes.length>=20)throw Error('TOO_MANY_SCENES');const c=copy(b),scene=copy(c.scenes[i]);scene.id=id;const ids=new Map(scene.phrases.map((p,n)=>[p.id,id+'-p'+n]));scene.phrases.forEach(p=>p.id=ids.get(p.id));scene.shots?.forEach((s,n)=>{s.id=id+'-s'+n;s.phraseId=ids.get(s.phraseId);});if(scene.board)scene.board=cloneBoard(scene.board,ids,id);c.scenes.splice(i+1,0,scene);return c;}
export function removeScene(b,i){index(b,i);if(b.scenes.length===1)throw Error('LAST_SCENE');const c=copy(b);c.scenes.splice(i,1);return c;}
export class DraftHistory{
 constructor(value){this.states=[copy(value)];this.position=0;}
 get value(){return copy(this.states[this.position]);}get canUndo(){return this.position>0;}get canRedo(){return this.position<this.states.length-1;}
 push(value){this.states.splice(this.position+1);this.states.push(copy(value));if(this.states.length>50)this.states.shift();this.position=this.states.length-1;return this.value;}
 undo(){if(this.canUndo)this.position--;return this.value;}redo(){if(this.canRedo)this.position++;return this.value;}
}
export function estimateScenes(b){let time=.6;return b.scenes.map(s=>{const start=time;for(const p of s.phrases)time+=Math.max(1.2,effectiveSpeechText(p).length/12)+.18;time+=.42+(s.hold??0);return {id:s.id,title:s.title,start,end:time,hold:s.hold??0};});}
export function waveformGeometry(t){if(!t||!Number.isFinite(t.duration)||t.duration<=0)return [];return (t.phrases??[]).flatMap(p=>{if(!Array.isArray(p.waveform)||!p.waveform.length)return [];return p.waveform.map((v,i)=>({x:1000*(p.start+(p.end-p.start)*i/p.waveform.length)/t.duration,width:1000*(p.end-p.start)/p.waveform.length/t.duration,amplitude:Math.max(0,Math.min(1,Number(v)||0))}));});}
export function batchVariants(formats,themes){const out=[...new Set(formats)].flatMap(format=>[...new Set(themes)].map(theme=>({format,theme})));if(!out.length||out.length>12)throw Error('INVALID_VARIANTS');return out;}
const searchKey=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().trim();
export function searchRecords(records,query){const q=searchKey(query);return records.filter(r=>!q||searchKey([r.title,r.name,r.id].join(' ')).includes(q));}
export function projectPage(records,{query='',page=1}={}){const found=searchRecords(records,query),pages=Math.max(1,Math.ceil(found.length/24)),current=Math.min(pages,Math.max(1,Number.isSafeInteger(page)?page:1));return {items:found.slice((current-1)*24,current*24),total:found.length,page:current,pages};}
const activeJob=j=>['RUNNING','UNKNOWN'].includes(j.status);
export const jobOutputKind=j=>['voice','voice-workbench'].includes(j.kind)?'audio':j.kind==='dubbing'?(j.request?.action==='export'?'dubbing-video':'transcript'):'video';
export function visibleJobs(jobs,{projectId,voice,all=false,limit=20}={}){return [...jobs.filter(activeJob),...jobs.filter(j=>!activeJob(j)&&(all||(projectId&&j.projectId===projectId)||(voice&&j.kind==='voice'&&j.voice===voice))).slice(0,limit)];}
const activeBatch=b=>!['VERIFIED','PARTIAL'].includes(b.status);
export function visibleBatches(batches,{projectId,all=false}={}){return [...batches.filter(activeBatch),...batches.filter(b=>!activeBatch(b)&&(all||(projectId&&b.projectId===projectId)))];}
export function jobError(code){if(code==='JOB_UNKNOWN')return 'Chưa xác định kết quả sau khi app dừng. Kiểm tra kết quả trước khi chạy tiếp.';if(code==='REVISION_CONFLICT')return 'Bản lưu đã thay đổi. Giữ nháp và kiểm tra dự án trước khi lưu lại.';return 'Tác vụ chưa hoàn tất. Mở chi tiết để kiểm tra; bản lưu và media vẫn được giữ.';}

export function rewriteNarration(scene,text,usedIds=[]){
 const next=structuredClone(scene),used=new Set([...usedIds,...scene.phrases.map(p=>p.id)]);
 function fresh(i){let id=scene.id.slice(0,30)+'-p'+i;while(used.has(id))id=scene.id.slice(0,30)+'-p'+(++i);used.add(id);return id;}
 const lines=text.split('\n').map(v=>v.trim()).filter(Boolean),claimed=new Set();
 // Reserve unchanged whiteboard phrases before assigning edited lines, so deletion/insertion
 // cannot quietly transfer an animation anchor to a different sentence.
 const matches=scene.board?lines.map(line=>{const old=scene.phrases.find(p=>!claimed.has(p.id)&&narrationEquivalent(p.text,line));if(old)claimed.add(old.id);return old;}):[];
 next.phrases=lines.map((text,i)=>{let old=matches[i];if(!old&&(!scene.board||lines.length===scene.phrases.length)){const candidate=scene.phrases[i];if(candidate&&!claimed.has(candidate.id)){old=candidate;claimed.add(old.id);}}return old&&narrationEquivalent(old.text,text)?structuredClone(old):{id:old?.id??fresh(i),text};});
 if(next.shots){next.shots=next.shots.filter(s=>next.phrases.some(p=>p.id===s.phraseId));if(!next.shots.length)delete next.shots;}return next;
}
