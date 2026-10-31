const fail=code=>{throw Error(code);};
const validId=id=>typeof id==='string'&&/^[a-z][a-z0-9_-]{0,47}$/.test(id);
export function captureEdit(s){return {generation:s.editGeneration,projectId:s.project?.brief.id,revision:s.project?.revision,sceneId:s.draft?.scenes[s.selected]?.id,media:JSON.stringify(s.draft?.scenes[s.selected]?.media)};}
export function editCaptureCurrent(capture,state){return !!capture?.projectId&&!!capture.sceneId&&JSON.stringify(capture)===JSON.stringify(captureEdit(state));}
export function timelineForEditing(s){
 if(!s.measured)return s.previewData?.timeline??null;
 if(!s.measuredEditable)return null;
 // Export preparation rewrites paths/trim to rendered intermediates. Editing uses the
 // original source media from the saved matching revision, never those intermediates.
 const saved=s.project?.brief;
 if(!saved||saved.id!==s.measured.id||saved.scenes.length!==s.measured.scenes?.length||saved.scenes.some((v,i)=>v.id!==s.measured.scenes[i].id))return null;
 return {...s.measured,scenes:s.measured.scenes.map((v,i)=>({...v,media:structuredClone(saved.scenes[i].media)}))};
}
export function quantizeTrim(start,end,duration){
 if(![start,end,duration].every(Number.isFinite)||duration<=0||duration>60.001||start<0||end>duration+.001||end<=start)fail('INVALID_TRIM');
 const first=Math.round(start*30),last=Math.min(Math.round(end*30),Math.floor((duration+1e-6)*30));
 if(last-first<1)fail('TRIM_MIN_FRAME');return {start:first/30,end:last/30};
}
export function snapToPhrase(time,phrases,tolerance){
 if(!Number.isFinite(time)||!Number.isFinite(tolerance)||tolerance<0||tolerance>.25)fail('INVALID_SNAP');
 let best=time,distance=tolerance+1e-9;
 for(const p of phrases??[])if(Number.isFinite(p.start)&&p.start>=0&&Math.abs(p.start-time)<distance){best=p.start;distance=Math.abs(p.start-time);}
 return best;
}
function checkedTimeline(brief,index,timeline){
 if(!Number.isInteger(index)||index<0||index>=brief.scenes.length)fail('INVALID_SPLIT');
 if(!timeline||timeline.id!==brief.id||timeline.voice!==brief.voice||timeline.scenes?.length!==brief.scenes.length||!Array.isArray(timeline.phrases)||!Number.isFinite(timeline.duration))fail('STALE_SPLIT_TIMELINE');
 const ordered=brief.scenes.flatMap(s=>s.phrases.map(p=>({...p,sceneId:s.id})));
 if(ordered.length!==timeline.phrases.length)fail('STALE_SPLIT_TIMELINE');
 for(const [i,p] of ordered.entries()){
  const t=timeline.phrases[i];if(t.id!==p.id||t.text!==p.text||t.speechText!==p.speechText||JSON.stringify(t.caption)!==JSON.stringify(p.caption)||t.sceneId!==p.sceneId||!Number.isFinite(t.start)||!Number.isFinite(t.end)||t.end<=t.start||(i&&t.start<timeline.phrases[i-1].end))fail('STALE_SPLIT_TIMELINE');
 }
 for(const [i,s] of brief.scenes.entries()){
  const t=timeline.scenes[i];if(t.id!==s.id||(t.hold??0)!==(s.hold??0)||t.visual!==s.visual||JSON.stringify(t.media)!==JSON.stringify(s.media)||!Number.isFinite(t.start)||!Number.isFinite(t.end)||t.end<=t.start)fail('STALE_SPLIT_TIMELINE');
  const phrases=timeline.phrases.filter(p=>p.sceneId===s.id);if(phrases.some(p=>p.start<t.start-1e-6||p.end>t.end+1e-6))fail('STALE_SPLIT_TIMELINE');
 }
 return timeline.scenes[index];
}
export function splitCandidates(brief,index,timeline){
 checkedTimeline(brief,index,timeline);const scene=brief.scenes[index];
 return scene.phrases.slice(1).map(p=>({phraseId:p.id,text:p.text,time:timeline.phrases.find(t=>t.id===p.id).start}));
}
export function splitSceneAtPhrase(brief,index,phraseId,timeline,newSceneId,inheritedShotId){
 const selected=checkedTimeline(brief,index,timeline),scene=brief.scenes[index];
 if(brief.scenes.length>=20)fail('SPLIT_SCENE_LIMIT');if(timeline.duration+.42>180.001)fail('SPLIT_DURATION_LIMIT');
 const at=scene.phrases.findIndex(p=>p.id===phraseId);if(at<=0)fail('INVALID_SPLIT_BOUNDARY');
 const ids=new Set(brief.scenes.flatMap(s=>[s.id,...s.phrases.map(p=>p.id),...(s.shots??[]).map(s=>s.id)]));
 const requireFresh=id=>{if(!validId(id)||ids.has(id))fail('SPLIT_IDENTITY');ids.add(id);};requireFresh(newSceneId);
 const left=structuredClone(scene),right=structuredClone(scene);right.id=newSceneId;left.phrases=left.phrases.slice(0,at);right.phrases=right.phrases.slice(at);left.hold=0;
 if(scene.shots){
  const positions=new Map(scene.phrases.map((p,i)=>[p.id,i]));left.shots=left.shots.filter(s=>positions.get(s.phraseId)<at);right.shots=right.shots.filter(s=>positions.get(s.phraseId)>=at);
  if(right.shots[0]?.phraseId!==phraseId){
   requireFresh(inheritedShotId);const inherited=structuredClone(left.shots.at(-1));inherited.id=inheritedShotId;inherited.phraseId=phraseId;right.shots.unshift(inherited);
   if(brief.scenes.reduce((n,s)=>n+(s.shots?.length??0),0)>=40)fail('SPLIT_SHOT_LIMIT');
  }
 }
 if(scene.visual==='media'&&scene.media?.kind==='video'){
  const p=timeline.phrases.find(p=>p.id===phraseId),m=scene.media,cut=Math.round((m.start+p.start-(index===0?0:selected.start))*30)/30;
  if(cut-m.start<1/30-1e-6||m.end-cut<1/30-1e-6)fail('SPLIT_FROZEN_SOURCE');left.media.end=cut;right.media.start=cut;
 }
 const result=structuredClone(brief);result.scenes.splice(index,1,left,right);return result;
}
