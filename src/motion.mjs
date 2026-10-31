// Absolute-time motion: safe to render a frame, seek backwards, or jump between scenes.
export function motionState(scene,phrases,time){
 const clamp=(x,min=0,max=1)=>Math.min(max,Math.max(min,x));
 const elapsed=clamp(time-scene.start,0,scene.end-scene.start);
 const local=phrases.filter(p=>p.sceneId===scene.id);
 const activePhrase=local.findIndex(p=>time>=p.start&&time<p.end);
 const p=local[activePhrase],progress=clamp(elapsed/(scene.end-scene.start));
 return {progress,activePhrase,wave:p?(p.waveform??[]).map(v=>clamp(v)):Array(34).fill(0),waveProgress:p?clamp((time-p.start)/(p.end-p.start)):0,
  head:38*Math.sin(elapsed*Math.PI/1.8),paper:18*progress,ink:progress,
  reel:elapsed*15,pen:(elapsed%2)/2,edit:clamp(elapsed/Math.max(1,(scene.end-scene.start)*.48)),lamp:activePhrase>=0};
}
export function timingBlocks(scene,phrases){
 const duration=scene.end-scene.start;
 return phrases.filter(p=>p.sceneId===scene.id).map(p=>({left:100*(p.start-scene.start)/duration,width:100*(p.end-p.start)/duration}));
}
