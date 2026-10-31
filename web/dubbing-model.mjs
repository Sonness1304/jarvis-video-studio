import {validateVoice} from './voice-model.mjs';
const fail=()=>{throw Error('DUB_DOCUMENT_INVALID');};
const str=(v,max,empty=false)=>typeof v==='string'&&(empty||v.trim())&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
export function validateDubbing(d){
 if(!d||![1,2].includes(d.schemaVersion)||!/^dub-[a-f0-9-]{36}$/.test(d.id??'')||!/^asset-[a-z0-9-]{1,48}$/.test(d.sourceAssetId??'')||!/^[a-f0-9]{64}$/.test(d.sourceHash??'')||!Number.isFinite(d.duration)||d.duration<=0||d.duration>(d.schemaVersion===2?600:60)||!Array.isArray(d.segments)||d.segments.length>(d.schemaVersion===2?1000:100))fail();
 const speakers=new Set();if(d.schemaVersion===2){
  if(!Array.isArray(d.speakers)||d.speakers.length>20||!d.background||!['unselected','voice-only','separate'].includes(d.background.mode))fail();
  if(d.background.mode==='separate'&&(!/^asset-[a-z0-9-]{1,48}$/.test(d.background.assetId??'')||!Number.isFinite(d.background.gain)||d.background.gain<0||d.background.gain>1))fail();
  for(const p of d.speakers){if(!p||!/^speaker-[a-z0-9-]{1,48}$/.test(p.id??'')||speakers.has(p.id)||!str(p.label,80))fail();if(p.voice)validateVoice(p.voice);speakers.add(p.id);}
 }
 if(d.voice!==undefined)validateVoice(d.voice);let end=0;const ids=new Set();for(const s of d.segments){if(!s||!/^segment-[a-z0-9-]{1,48}$/.test(s.id??'')||ids.has(s.id)||!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<end||s.end<=s.start||s.end>d.duration||!str(s.sourceText,240,true)||!str(s.targetText,240,true))fail();if(s.speakerId!==undefined&&(d.schemaVersion!==2||!speakers.has(s.speakerId)))fail();if(s.voice)validateVoice(s.voice);if(s.selection&&(!/^job-[a-z0-9-]{1,48}$/.test(s.selection.jobId??'')||!str(s.selection.signature,2048)))fail();if(s.fitApproved!==undefined&&typeof s.fitApproved!=='boolean')fail();end=s.end;ids.add(s.id);}return d;
}
const seconds=t=>{const m=/^(\d{2}):([0-5]\d):([0-5]\d)[,.](\d{3})$/.exec(t);if(!m)fail();return Number(m[1])*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/1000;};
export function parseSrt(text,duration,schemaVersion=1){
 if(typeof text!=='string'||text.length>131072)fail();const blocks=text.replace(/^\uFEFF/,'').trim().split(/\r?\n\s*\r?\n/);const segments=blocks.map((b,i)=>{const lines=b.split(/\r?\n/);if(/^\d+$/.test(lines[0]))lines.shift();const times=lines.shift()?.split(/\s+-->\s+/);if(times?.length!==2)fail();const sourceText=lines.join(' ');return {id:'segment-'+(i+1),start:seconds(times[0]),end:seconds(times[1]),sourceText,targetText:''};});validateDubbing({schemaVersion,...(schemaVersion===2?{speakers:[],background:{mode:'unselected'}}:{}),id:'dub-11111111-1111-4111-8111-111111111111',sourceAssetId:'asset-check',sourceHash:'a'.repeat(64),duration,segments});return segments;
}
export function slotPlan(s,duration){
 const slot=s.end-s.start;if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(slot)||slot<=0)fail();if(duration>slot*1.1)throw Error('DUB_OVERFLOW');const speed=duration>slot?duration/slot:1;return {start:s.start,slot,speed,pad:Math.max(0,slot-duration/speed)};
}
export function updateSegment(doc,id,patch){
 if(!patch||Object.keys(patch).some(k=>!['sourceText','targetText','start','end'].includes(k)))fail();const next=structuredClone(doc),s=next.segments.find(s=>s.id===id);if(!s)fail();const sourceChanged=patch.sourceText!==undefined&&patch.sourceText!==s.sourceText;Object.assign(s,patch);delete s.selection;if(sourceChanged)s.targetText='';validateDubbing(next);return next;
}
export const dubbingSignature=(doc,segment)=>JSON.stringify({schemaVersion:1,text:segment.targetText,voice:resolveDubbingVoice(doc,segment)});
export const dubbingCapture=record=>({id:record.doc.id,revision:record.revision,snapshot:JSON.stringify(record.doc)});
export const dubbingCurrent=(capture,record)=>!!record&&capture.id===record.doc.id&&capture.revision===record.revision&&capture.snapshot===JSON.stringify(record.doc);
const stamp=t=>{const ms=Math.round(t*1000);return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(n=>String(n).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0');};
export function toDubbingSrt(doc,source=false){validateDubbing(doc);return doc.segments.map((s,i)=>`${i+1}\n${stamp(s.start)} --> ${stamp(s.end)}\n${(source?s.sourceText:s.targetText).replaceAll('-->','→')}\n`).join('\n');}

export function resolveDubbingVoice(doc,segment){return segment.voice??doc.speakers?.find(p=>p.id===segment.speakerId)?.voice??doc.voice;}
export function upgradeDubbing(doc){validateDubbing(doc);return structuredClone(doc.schemaVersion===2?doc:{...doc,schemaVersion:2,speakers:[],background:{mode:'unselected'}});}
function invalidateChanged(before,next){for(const s of next.segments){const old=before.segments.find(p=>p.id===s.id);if(!old||dubbingSignature(before,old)!==dubbingSignature(next,s)){delete s.selection;delete s.fitApproved;}}return validateDubbing(next);}
export function updateDubbingSpeaker(doc,id,patch){if(!patch||Object.keys(patch).some(k=>!['label','voice'].includes(k)))fail();const next=upgradeDubbing(doc),speaker=next.speakers.find(p=>p.id===id);if(!speaker)fail();Object.assign(speaker,patch);return invalidateChanged(doc,next);}
export function assignDubbingSpeaker(doc,id,speakerId){const next=upgradeDubbing(doc),s=next.segments.find(p=>p.id===id);if(!s)fail();if(speakerId)s.speakerId=speakerId;else delete s.speakerId;return invalidateChanged(doc,next);}
export function updateDubbingDefaultVoice(doc,voice){const next=structuredClone(doc);next.voice=voice;return invalidateChanged(doc,next);}

export function validateTranslationCandidate(doc,value){validateDubbing(doc);const invalid=()=>{throw Error('DUB_TRANSLATION_INVALID');};if(!value||value.schemaVersion!==1||Object.keys(value).some(k=>!['schemaVersion','segments'].includes(k))||!Array.isArray(value.segments)||value.segments.length!==doc.segments.length)invalid();for(const [i,row] of value.segments.entries())if(!row||Object.keys(row).some(k=>!['id','targetText'].includes(k))||row.id!==doc.segments[i].id||!str(row.targetText,240))invalid();return value;}
export function applyTranslationCandidate(doc,value){validateTranslationCandidate(doc,value);const next=structuredClone(doc);for(const [i,row] of value.segments.entries())next.segments[i].targetText=row.targetText;return invalidateChanged(doc,next);}

export function recoverableDubbingJob(record,job){return !!record&&job?.kind==='dubbing'&&job.status==='VERIFIED'&&['translate','speakers'].includes(job.request?.action)&&job.result?.action===job.request.action&&job.result.documentId===record.doc.id&&job.result.documentRevision===job.request.revision&&job.result.sourceHash===record.doc.sourceHash&&JSON.stringify(job.request.doc)===JSON.stringify(record.doc);}
export function applySpeakerSuggestions(doc,result){const next=upgradeDubbing(doc);if(!Array.isArray(result.speakers)||!Array.isArray(result.assignments)||result.assignments.length!==next.segments.length)throw Error('DUB_SPEAKER_RESULT_INVALID');next.speakers=structuredClone(result.speakers);for(const [i,a] of result.assignments.entries()){if(a.id!==next.segments[i].id||a.speakerId!==null&&!result.speakers.some(p=>p.id===a.speakerId))throw Error('DUB_SPEAKER_RESULT_INVALID');if(a.speakerId)next.segments[i].speakerId=a.speakerId;else delete next.segments[i].speakerId;}return invalidateChanged(doc,next);}
