import sharp from 'sharp';import path from 'node:path';
import {boardState} from '../web/whiteboard-model.mjs';
const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function wrapBoardLabel(label,measure){
 const lines=[];let line='';
 for(const word of label.trim().split(/\s+/)){
  if(await measure(line?line+' '+word:word)<=220){line=line?line+' '+word:word;continue;}
  if(line){lines.push(line);line='';}
  for(const char of word){if(await measure(line+char)>220){if(!line)throw Error('BOARD_LABEL_OVERFLOW');lines.push(line);line='';}line+=char;}
 }
 if(line)lines.push(line);if(lines.length>3)throw Error('BOARD_LABEL_OVERFLOW');return lines;
}
export async function measureBoardLabels(t,root,config){
 const result={},cache=new Map();
 const measure=async text=>{if(!cache.has(text)){const m=await sharp({text:{text:e(text),font:'Be Vietnam Pro Bold 22',fontfile:path.join(root,config.paths.fontBold),dpi:72}}).metadata();cache.set(text,m.width+2);}return cache.get(text);};
 for(const s of t.scenes.filter(s=>s.visual==='whiteboard')){result[s.id]={};for(const n of s.board.nodes){try{result[s.id][n.id]=await wrapBoardLabel(n.label,measure);}catch{throw Error('BOARD_LABEL_OVERFLOW:'+s.id+':'+n.id);}}}return result;
}
const box=slot=>({x:34+(slot%2)*288,y:40+Math.floor(slot/2)*155,w:252,h:125});
export function boardSvg(board,labels={}){
 const dark=board.surface==='dark',ink=dark?'#E7F2EB':'#213B36',paper=dark?'#172E2A':'#FBF8EE',card=dark?'#223F38':'#FFFFFF';
 const nodes=board.nodes.map(n=>{const b=box(n.slot),lines=labels[n.id]??[n.label];return `<g class="wb-node" data-wb-node="${e(n.id)}" transform="translate(${b.x} ${b.y})"><rect class="wb-card" width="252" height="125" rx="12" fill="${card}" stroke="${ink}" stroke-opacity=".22" stroke-width="1.5"/><rect class="wb-focus" x="-3" y="-3" width="258" height="131" rx="15" fill="none" stroke="var(--accent)" stroke-width="4" opacity="0"/><text x="17" y="24" font-size="12" fill="${ink}" opacity=".5">${String(n.slot+1).padStart(2,'0')}</text><text data-wb-label="${e(n.id)}" text-anchor="middle" fill="${ink}" font-size="22" font-weight="700">${lines.map((line,i)=>`<tspan x="126" y="${70-(lines.length-1)*13.5+i*27}">${e(line)}</tspan>`).join('')}</text>${board.actions.filter(a=>a.targetId===n.id&&['underline','circle'].includes(a.type)).map(a=>a.type==='underline'?`<path data-wb-effect="${e(a.id)}" d="M18 110 Q118 115 232 109" pathLength="1" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>`:`<ellipse data-wb-effect="${e(a.id)}" cx="126" cy="62" rx="125" ry="65" pathLength="1" fill="none" stroke="var(--accent)" stroke-width="3"/>`).join('')}</g>`;}).join('');
 const arrows=board.actions.filter(a=>a.type==='arrow').map(a=>{const from=box(board.nodes.find(n=>n.id===a.targetId).slot),to=box(board.nodes.find(n=>n.id===a.toId).slot),dx=to.x-from.x,dy=to.y-from.y,angle=Math.atan2(dy,dx),distance=Math.hypot(dx,dy),offset=Math.min(dx?126/Math.abs(Math.cos(angle)):Infinity,dy?62.5/Math.abs(Math.sin(angle)):Infinity)+8,len=Math.max(1,distance-2*offset);return `<g transform="translate(${from.x+126+Math.cos(angle)*offset} ${from.y+62.5+Math.sin(angle)*offset}) rotate(${angle*180/Math.PI})"><path data-wb-effect="${e(a.id)}" d="M0 0 H${len}" pathLength="1" stroke="var(--accent)" stroke-width="3" fill="none"/><path data-wb-arrowhead="${e(a.id)}" d="M${len-7} -5 L${len} 0 L${len-7} 5" stroke="var(--accent)" stroke-width="3" fill="none"/></g>`;}).join('');
 return `<svg class="wb-figure" viewBox="0 0 608 520" role="img" aria-label="Bảng minh họa"><rect x="1" y="1" width="606" height="518" rx="18" fill="${paper}" stroke="${ink}" stroke-opacity=".2"/>${Array.from({length:12},(_,i)=>`<path d="M18 ${28+i*42} H590" stroke="${ink}" opacity=".04"/>`).join('')}${nodes}${arrows}<text x="34" y="505" font-size="12" fill="${ink}" opacity=".55">MỘT Ý · MỘT ĐIỂM NHÌN</text></svg>`;
}
export function drawBoard(el,board,time){
 const state=boardState(board,time);
 for(const node of el.querySelectorAll('[data-wb-node]')){const s=state.nodes[node.dataset.wbNode];node.style.opacity=s.opacity;node.querySelector('.wb-focus').style.opacity=s.focus;}
 for(const effect of el.querySelectorAll('[data-wb-effect]')){const p=state.effects[effect.dataset.wbEffect]??0;effect.style.strokeDasharray='1';effect.style.strokeDashoffset=String(1-p);effect.style.opacity=p>0?'1':'0';}
 for(const head of el.querySelectorAll('[data-wb-arrowhead]'))head.style.opacity=state.effects[head.dataset.wbArrowhead]>=.99?'1':'0';
}
export const boardCss='.wb-figure{width:100%;height:100%;overflow:visible;font-family:Be,sans-serif}.wb-figure text{font-family:Be,sans-serif}';
