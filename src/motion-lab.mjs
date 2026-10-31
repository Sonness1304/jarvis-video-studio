// Three typed explanatory figures; no executable content or remote assets in briefs.
export const labStages={qr:['clean','small','large','guides'],refraction:['straw','rays','apparent'],compression:['repeat','reference','restore','limits']};
export function verifyLabRenderInputs(receipt,hashes){if(receipt.renderInputs?.timeline!==hashes.timeline||receipt.renderInputs?.composition!==hashes.composition||!/^([a-f0-9]{64})$/.test(hashes.timeline??'')||!/^([a-f0-9]{64})$/.test(hashes.composition??''))throw Error('MOTION_RENDER_INPUTS_CHANGED');}
export function validateLab(lab){
 if(!lab||Array.isArray(lab)||Object.keys(lab).some(k=>!['kind','stage','matrix'].includes(k))||!Object.hasOwn(labStages,lab.kind)||!labStages[lab.kind].includes(lab.stage))throw Error('INVALID_LAB');
 if(lab.kind==='qr'){
  const m=lab.matrix,n=m?.length;
  if(!Array.isArray(m)||n<21||n>57||(n-21)%4||m.some(r=>typeof r!=='string'||r.length!==n||!/^[01]+$/.test(r)))throw Error('INVALID_LAB_MATRIX');
 }else if(lab.matrix!==undefined)throw Error('INVALID_LAB_MATRIX');
 return lab;
}
export function labState(progress){const p=Math.max(0,Math.min(1,progress));return {progress:p,pulse:.5+.5*Math.sin(p*Math.PI*4),travel:p*96,reveal:Math.min(1,p*3)};}
export function refractionGeometry(){
 const object={x:260,y:360},surface={x:330,y:210};
 const incident=Math.atan((surface.x-object.x)/(object.y-surface.y)),refracted=Math.asin(1.333*Math.sin(incident));
 const eye={x:surface.x+150*Math.tan(refracted),y:60};
 return {object,surface,eye,incident,refracted,apparent:{x:object.x,y:surface.y+(surface.x-object.x)/Math.tan(refracted)}};
}
const text=(x,y,t,extra='')=>`<text x="${x}" y="${y}" ${extra}>${t}</text>`;
export function labSvg(lab){
 validateLab(lab);let inner='';
 if(lab.kind==='qr'){
  const n=lab.matrix.length,unit=320/(n+8),x=140+4*unit,y=72+4*unit;
  const cells=lab.matrix.flatMap((r,j)=>[...r].map((v,i)=>v==='1'?`M${i} ${j}h1v1h-1z`:'')).join('');
  const mask=lab.stage==='large'?{x:0,y:0,w:n,h:Math.ceil(n*.60)}:lab.stage==='small'?{x:Math.floor(n/2)-1,y:Math.floor(n/2)-1,w:3,h:3}:null;
  inner=`<rect x="140" y="72" width="320" height="320" rx="0" fill="white"/><g transform="translate(${x} ${y}) scale(${unit})" shape-rendering="crispEdges"><path d="${cells}" fill="#101D30"/>${mask?`<rect data-qr-mask="${mask.x},${mask.y},${mask.w},${mask.h}" x="${mask.x}" y="${mask.y}" width="${mask.w}" height="${mask.h}" fill="white"/>`:''}</g><path d="M125 84v-25h25m300 0h25v25M125 380v25h25m300 0h25v-25" stroke="#176EAA" stroke-width="4" fill="none"/><circle data-lab-pulse cx="496" cy="232" r="9" fill="${lab.stage==='large'?'#E85C3C':'#15815C'}"/>${text(300,438,lab.stage==='large'?'Che cả vùng định vị':lab.stage==='small'?'Che 3 × 3 ô ở giữa':lab.stage==='guides'?'Ô định vị giúp tìm đúng mã':'Mã QR thật • mức H','text-anchor="middle" class="lab-readout"')}${text(300,475,'Khả năng phục hồi có giới hạn','text-anchor="middle" class="lab-note"')}`;
 }
 if(lab.kind==='refraction'){
  const g=refractionGeometry(),{object:o,surface:s,eye:v,apparent:a}=g;
  inner=`<defs><linearGradient id="water"><stop stop-color="#D3F1FA"/><stop offset="1" stop-color="#A4D8EF"/></linearGradient></defs><path d="M95 105v312q0 22 22 22h327q22 0 22-22V105" fill="#F4FCFF" stroke="#5E8DAD" stroke-width="4"/><path d="M97 210h367v204q0 22-22 22H119q-22 0-22-22Z" fill="url(#water)"/><path d="M130 80 260 360" stroke="#C77522" stroke-width="15" stroke-linecap="round"/><path d="M126 80 256 360" stroke="#FFDB85" stroke-width="4"/><path d="M97 210h367" stroke="#318AB6" stroke-width="3"/>${text(104,192,'Không khí', 'class="lab-note"')}${text(104,406,'Nước', 'class="lab-note"')}`;
  if(lab.stage!=='straw')inner+=`<path d="M${s.x} 75V390" stroke="#7696AE" stroke-dasharray="6 6" stroke-width="2"/>${text(s.x+8,102,'pháp tuyến','class="lab-note"')}<path data-lab-ray d="M${o.x} ${o.y} ${s.x} ${s.y} ${v.x} ${v.y}" fill="none" stroke="#E76C34" stroke-width="5" stroke-linecap="round" pathLength="100"/><path d="M${s.x} ${s.y} ${a.x} ${a.y}" stroke="#687B93" stroke-width="3" stroke-dasharray="7 7" fill="none"/><circle cx="${o.x}" cy="${o.y}" r="7" fill="#9C5422"/><circle cx="${a.x}" cy="${a.y}" r="7" fill="#087D8C"/>${text(365,345,'Điểm thật','class="lab-note"')}${text(365,302,'Ảnh biểu kiến','class="lab-note"')}<path d="M354 339 270 360M354 299 ${a.x+8} ${a.y}" stroke="#5E8DAD" fill="none"/>`;
  if(lab.stage==='apparent')inner+=`<path d="M190 210 ${a.x} ${a.y}" stroke="#087D8C" stroke-width="9" stroke-dasharray="8 8" fill="none"/>`;
  inner+=`<circle data-lab-pulse cx="${g.eye.x}" cy="60" r="10" fill="#E76C34"/>${text(300,480,'Mô hình 2D • đường kéo dài là nét đứt','text-anchor="middle" class="lab-note"')}`;
 }
 if(lab.kind==='compression'){
  const letters='ABCABCABCABC'.split('');
  inner=`${text(40,46,'Dữ liệu gốc','class="lab-readout"')}${letters.map((l,i)=>`<g transform="translate(${40+(i%6)*86} ${80+Math.floor(i/6)*69})"><rect width="76" height="56" rx="9" fill="${['#DDEAFB','#E7DDFB','#CDEFE7'][i%3]}"/><text x="38" y="38" text-anchor="middle" class="lab-letter">${l}</text></g>`).join('')}<path d="M300 225v40m-9-10 9 10 9-10" fill="none" stroke="#687B93" stroke-width="4"/>`;
  if(lab.stage==='reference'||lab.stage==='restore')inner+=`<rect x="55" y="282" width="490" height="76" rx="14" fill="#E7DDFB"/>${text(300,330,'ABC  +  quay lại 3, chép 9','text-anchor="middle" class="lab-readout"')}`;
  if(lab.stage==='restore')inner+=`<rect x="55" y="390" width="490" height="57" rx="10" fill="#CDEFE7"/>${text(300,429,'ABCABCABCABC  ✓','text-anchor="middle" class="lab-readout"')}`;
  if(lab.stage==='repeat')inner+=`<rect data-lab-group x="40" y="80" width="248" height="56" rx="9" stroke="#8057B5" stroke-width="4" fill="none"/>${text(300,355,'Đoạn ABC xuất hiện nhiều lần','text-anchor="middle" class="lab-readout"')}`;
  if(lab.stage==='limits')inner+=`${text(300,314,'Nén lại MP4 / JPEG?','text-anchor="middle" class="lab-readout"')}${text(300,365,'Có thể chẳng nhỏ hơn','text-anchor="middle" class="lab-readout"')}`;
  inner+=`<circle data-lab-pulse cx="565" cy="46" r="8" fill="#8057B5"/>${text(300,485,'Sơ đồ nguyên lý • không phải định dạng ZIP','text-anchor="middle" class="lab-note"')}`;
 }
 return `<svg data-lab="${lab.kind}" data-stage="${lab.stage}" class="lab-figure" viewBox="0 0 600 500" role="img" aria-label="Minh họa ${lab.kind}"><rect width="600" height="500" rx="20" fill="#F9FCFF"/>${inner}</svg>`;
}
// Serialized into the same composition for draft preview, seek QA and MP4 rendering.
export function drawLab(root,progress){
 const p=Math.max(0,Math.min(1,progress));
 for(const el of root.querySelectorAll('[data-lab-pulse]')){el.style.opacity=String(.55+.45*Math.sin(p*Math.PI*4)**2);el.setAttribute('r',String(7+3*Math.sin(p*Math.PI*2)**2));}
 for(const el of root.querySelectorAll('[data-lab-ray]')){el.style.strokeDasharray='100';el.style.strokeDashoffset=String(100*(1-Math.min(1,p*2.2)));}
 for(const el of root.querySelectorAll('[data-lab-group]'))el.setAttribute('transform','translate('+(p*258)+' 0)');
}
export const labCss='.lab-figure{width:100%;height:100%;overflow:hidden;color:#182E49}.lab-figure text{font-family:Be,sans-serif;fill:#182E49}.lab-readout{font-size:24px;font-weight:700}.lab-note{font-size:18px}.lab-letter{font-size:31px;font-weight:900}';
