export function validateImageMotion(m){
 if(!m||typeof m!=='object'||Array.isArray(m)||Object.keys(m).some(k=>!['preset','strength'].includes(k))||!['still','push-in','pull-out','pan-left','pan-right'].includes(m.preset)||!['gentle','medium','strong'].includes(m.strength))throw Error('INVALID_IMAGE_MOTION');
 return m;
}
// Self-contained: serialized into the exact same composition for preview and export.
export function imageMotion(m,progress){
 if(!Number.isFinite(progress))throw Error('INVALID_MOTION_PROGRESS');
 const p=Math.max(0,Math.min(1,progress)),e=p*p*(3-2*p),d={gentle:.04,medium:.08,strong:.12}[m.strength];
 if(m.preset==='push-in')return {scale:1+d*e,x:0,y:0};
 if(m.preset==='pull-out')return {scale:1+d*(1-e),x:0,y:0};
 if(m.preset==='pan-left'||m.preset==='pan-right')return {scale:1+d,x:(m.preset==='pan-left'?1:-1)*d*50*(1-2*e),y:0};
 return {scale:1,x:0,y:0};
}
export function applyImageMotion(media,preset,strength,fit){
 if(media?.kind!=='image'||!['cover','contain'].includes(fit))throw Error('INVALID_IMAGE_MOTION');
 const next={...media,fit};if(preset==='default')delete next.motion;else next.motion=validateImageMotion({preset,strength});return next;
}
