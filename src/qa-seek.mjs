import {compileBoard} from '../web/whiteboard-model.mjs';
export function seekCases(timeline){
 return timeline.scenes.map((s,i)=>{const start=i===0?0:s.start,end=i===timeline.scenes.length-1?timeline.duration:s.end,duration=end-start;
  if(s.visual==='whiteboard'){const actions=compileBoard(s.board,timeline.phrases.filter(p=>p.sceneId===s.id),s.end).actions,a=actions[0]?.time??start,b=actions.length?Math.min(end-1/30,actions.at(-1).time+actions.at(-1).duration):start;return {sceneId:s.id,visual:s.visual,motionExpected:actions.length>0,times:[a,b,a]};}
  const a=start+Math.min(1,duration*.2),b=start+duration*.65;return {sceneId:s.id,visual:s.visual,motionExpected:!(s.visual==='media'&&s.media?.kind==='image'&&s.media.motion?.preset==='still'&&!s.shots),times:[a,b,a]};
 });
}
