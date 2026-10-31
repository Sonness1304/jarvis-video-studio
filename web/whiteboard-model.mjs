export const boardTypes=['reveal','underline','circle','focus','arrow'];
export const boardPresets={process:'Quy trình',compare:'Đối chiếu',cause:'Nguyên nhân → kết quả'};
const fail=message=>{throw Error(message);};
const id=v=>typeof v==='string'&&/^[a-z][a-z0-9_-]{0,47}$/.test(v);
const keys=(v,allowed)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))fail('INVALID_BOARD');};
export function validateBoard(board,phrases){
 keys(board,['surface','nodes','actions']);
 if(!['paper','dark'].includes(board.surface)||!Array.isArray(board.nodes)||board.nodes.length<2||board.nodes.length>6||!Array.isArray(board.actions)||board.actions.length>12)fail('INVALID_BOARD');
 const nodes=new Set(),slots=new Set(),actions=new Set(),milestones=new Set();
 for(const n of board.nodes){keys(n,['id','label','slot']);if(!id(n.id)||nodes.has(n.id)||!Number.isInteger(n.slot)||n.slot<0||n.slot>5||slots.has(n.slot)||typeof n.label!=='string'||!n.label.trim()||n.label.length>70||/[\x00-\x1f\x7f]/.test(n.label))fail('INVALID_BOARD_NODE');nodes.add(n.id);slots.add(n.slot);}
 const order=a=>phrases.findIndex(p=>p.id===a.phraseId)*2+(a.edge==='end'?1:0);
 for(const a of board.actions){keys(a,['id','type','targetId','toId','phraseId','edge']);if(!id(a.id)||actions.has(a.id)||!boardTypes.includes(a.type)||!nodes.has(a.targetId))fail('INVALID_BOARD_ACTION');actions.add(a.id);
  if(!phrases.some(p=>p.id===a.phraseId)||!['start','end'].includes(a.edge))fail('BOARD_ANCHOR_MISSING:'+a.id);
  const at=order(a);if(milestones.has(at))fail('BOARD_MILESTONE_CONFLICT');milestones.add(at);
  if(a.type==='arrow'){if(!nodes.has(a.toId)||a.toId===a.targetId)fail('INVALID_BOARD_ARROW');}else if(a.toId!==undefined)fail('INVALID_BOARD_ACTION');
 }
 const reveals=new Map();for(const a of board.actions.filter(a=>a.type==='reveal')){if(reveals.has(a.targetId))fail('BOARD_DUPLICATE_REVEAL');reveals.set(a.targetId,order(a));}
 for(const a of board.actions.filter(a=>a.type!=='reveal'))for(const target of [a.targetId,...(a.type==='arrow'?[a.toId]:[])])if(reveals.has(target)&&reveals.get(target)>=order(a))fail('BOARD_TARGET_HIDDEN:'+target);
 return board;
}
export function boardTemplate(preset,phrases){
 if(!Object.hasOwn(boardPresets,preset)||!phrases?.length)fail('INVALID_BOARD_TEMPLATE');
 const labels=preset==='compare'?['Trước khi chỉnh','Sau khi chỉnh','Điều cần nhìn']:preset==='cause'?['Nguyên nhân','Điều thay đổi','Kết quả']:['Ý chính','Ví dụ cụ thể','Điều cần nhớ'];
 const slots=preset==='compare'?[0,1,4]:[0,2,4],nodes=labels.map((label,i)=>({id:'n'+(i+1),label,slot:slots[i]}));
 const actions=phrases.slice(0,3).map((p,i)=>({id:'a'+(i+1),type:i===0?'underline':i===1?'circle':'focus',targetId:nodes[i].id,phraseId:p.id,edge:'start'}));
 return {surface:'paper',nodes,actions};
}
export function compileBoard(board,phrases,sceneEnd){
 validateBoard(board,phrases);
 const actions=board.actions.map(a=>{const p=phrases.find(p=>p.id===a.phraseId);if(!Number.isFinite(p.start)||!Number.isFinite(p.end)||p.start<0||p.end<=p.start)fail('INVALID_BOARD_TIMING');return {...a,time:p[a.edge]};}).sort((a,b)=>a.time-b.time);
 for(let i=0;i<actions.length;i++){const a=actions[i],next=actions[i+1]?.time??sceneEnd;if(!Number.isFinite(sceneEnd)||a.time>sceneEnd||next<a.time||(i>0&&a.time<=actions[i-1].time))fail('INVALID_BOARD_TIMING');a.duration=Math.min(.4,next-a.time);}
 const reveals=new Map(actions.filter(a=>a.type==='reveal').map(a=>[a.targetId,a.time]));
 for(const a of actions.filter(a=>a.type!=='reveal'))for(const target of [a.targetId,...(a.type==='arrow'?[a.toId]:[])])if(reveals.has(target)&&reveals.get(target)>=a.time)fail('BOARD_TARGET_HIDDEN:'+target);
 return {...structuredClone(board),actions};
}
// Self-contained so preview and native export embed the same absolute-time evaluator.
export function boardState(board,time){
 const nodes=Object.fromEntries(board.nodes.map(n=>[n.id,{opacity:board.actions.some(a=>a.type==='reveal'&&a.targetId===n.id)?0:1,focus:0}])),effects={};let focused=null;
 for(const a of board.actions){const x=time<a.time?0:a.duration===0?1:Math.max(0,Math.min(1,(time-a.time)/a.duration)),p=x*x*(3-2*x);effects[a.id]=p;
  if(a.type==='reveal')nodes[a.targetId].opacity=p;
  if(a.type==='focus'&&time>=a.time)focused={id:a.targetId,progress:p};
 }
 if(focused)nodes[focused.id].focus=focused.progress;
 return {nodes,effects};
}
export function applyWhiteboard(brief,index,board){
 const next=structuredClone(brief),scene=next.scenes[index];if(!scene)fail('INVALID_SCENE_INDEX');validateBoard(board,scene.phrases);
 scene.visual='whiteboard';scene.board=structuredClone(board);delete scene.media;delete scene.shots;delete scene.lab;delete scene.content;return next;
}
export function cloneBoard(board,phraseIds,prefix){
 const out=structuredClone(board),nodes=new Map(out.nodes.map((n,i)=>[n.id,prefix.slice(0,36)+'-n'+i]));
 out.nodes.forEach(n=>n.id=nodes.get(n.id));out.actions.forEach((a,i)=>{a.id=prefix.slice(0,36)+'-a'+i;a.targetId=nodes.get(a.targetId);if(a.toId)a.toId=nodes.get(a.toId);a.phraseId=phraseIds.get(a.phraseId)??a.phraseId;});return out;
}
