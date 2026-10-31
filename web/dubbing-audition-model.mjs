import {validateVoice} from './voice-model.mjs';
import {validateDubbing,dubbingSignature,resolveDubbingVoice,slotPlan} from './dubbing-model.mjs';
function segment(doc,id){validateDubbing(doc);const s=doc.segments.find(s=>s.id===id);if(!s?.targetText.trim())throw Error('DUB_AUDITION_TARGET');return s;}
export function auditionContext(doc,id){
 const s=segment(doc,id),{selection,fitApproved,...speech}=s;
 return JSON.stringify({id:doc.id,sourceHash:doc.sourceHash,sourceAssetId:doc.sourceAssetId,speech,speaker:doc.speakers?.find(p=>p.id===s.speakerId),voice:resolveDubbingVoice(doc,s)});
}
export function auditionSignature(doc,id,voice){validateVoice(voice);return dubbingSignature(doc,{...segment(doc,id),voice});}
export function applyAudition(doc,id,candidate){
 if(!candidate||candidate.context!==auditionContext(doc,id))throw Error('DUB_AUDITION_STALE');
 const {job,voice}=candidate,signature=auditionSignature(doc,id,voice),current=segment(doc,id);
 if(!/^job-[a-z0-9-]{1,48}$/.test(job?.id??'')||job.kind!=='voice-workbench'||job.projectId!==doc.id||job.status!=='VERIFIED'||job.request?.signature!==signature||job.result?.signature!==signature||job.request?.text!==current.targetText||JSON.stringify(job.request?.voice)!==JSON.stringify(voice))throw Error('DUB_AUDITION_INVALID');
 slotPlan(current,job.result.duration);
 const next=structuredClone(doc),s=next.segments.find(s=>s.id===id),speaker=next.speakers?.find(p=>p.id===s.speakerId);
 if(speaker){speaker.voice=structuredClone(voice);delete s.voice;}else s.voice=structuredClone(voice);
 for(const row of next.segments){const before=doc.segments.find(p=>p.id===row.id);if(dubbingSignature(doc,before)!==dubbingSignature(next,row)){delete row.selection;delete row.fitApproved;}}
 s.selection={jobId:job.id,signature};s.fitApproved=false;return validateDubbing(next);
}
