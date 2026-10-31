import * as k from '../vendor/anatomy/iso-kit.mjs';
// A render loom: rails constrain a sheet while a print head reveals frames. Metaphor, not live telemetry.
const base={x:-132,y:-80,w:264,d:160,r:4};
const P=k.fitProjection([...k.boxCorners(base,-20,0),[-90,-50,120],[100,60,90]],600,480,{pad:40,azimuth:43,elevation:32});
export const loomAxes={head:k.axisVector(P,[1,0,0]),paper:k.axisVector(P,[0,1,0])};
export function loom(){
 const parts=[];const slab=(name,p,z,h,tone='mid',lit=false)=>parts.push({depth:k.depthOf([p.x+p.w/2,p.y+p.d/2,z+h/2],P),svg:k.solidSvg(k.slabOf(p,z,h,P,4,0.7),{tone,lit,className:name})});
 for(const [x,y] of k.corners(base,15))slab('foot',{x:x-6,y:y-6,w:12,d:12,r:1},-20,8);
 slab('bench',base,-12,12);
 for(const [x,y] of k.corners(base,10)){slab('fastener',{x:x-2,y:y-2,w:4,d:4,r:0},0,1,'hi');}
 for(const x of [-95,88]){
  slab('anchor',{x:x-10,y:-40,w:22,d:80,r:2},0,8);
  for(const y of [-32,27])slab('post',{x:x-3,y,w:7,d:7,r:1},8,96);
  slab('bridge',{x:x-6,y:-38,w:12,d:78,r:1},104,8);
 }
 for(const y of [-29,29]){
  slab('rail',{x:-90,y,w:182,d:5,r:1},76,6,'hi');
  for(const x of [-81,-61,61,81])slab('rail-pin',{x,y:y-1,w:3,d:7,r:0},82,1,'lo');
 }
 slab('print-head',{x:-24,y:-33,w:48,d:72,r:3},83,20,'hi',true);
 slab('faceplate',{x:-17,y:-27,w:34,d:60,r:1},103,2,'hi',true);
 for(const y of [-20,-10,0,10,20])slab('vent',{x:-11,y,w:22,d:3,r:0},105,0.4,'lo');
 slab('paper-bed',{x:-64,y:-25,w:128,d:50,r:1},1,6,'hi');
 slab('sheet',{x:-60,y:-22,w:120,d:44,r:0},7,0.6,'hi',true);
 for(let x=-56;x<52;x+=12)slab('ink-frame',{x,y:-18,w:8,d:36,r:0},7.6,0.1,'lo');
 slab('control-panel',{x:67,y:42,w:36,d:24,r:2},0,13);
 for(let i=0;i<3;i++)slab('key',{x:73+i*8,y:47,w:5,d:8,r:1},13,2,i===0?'hi':'mid',i===0);
 parts.sort((a,b)=>a.depth-b.depth);
 const ticks=k.topTicks(-115,110,6,5,64,1,[3,6],P);
 return `<svg class="iso-svg machine" viewBox="0 0 600 480" aria-label="Máy dệt khung hình minh họa"><ellipse cx="300" cy="405" rx="225" ry="47" fill="#213D6420"/>${parts.map(x=>x.svg).join('')}${k.lineSvg(ticks.minor,{tone:'lo'})}${k.lineSvg(ticks.major,{tone:'mid'})}</svg>`;
}
