const field=(value,max=1600,empty=false)=>{if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value)||!empty&&!value.trim())throw Error('ARTCRAFT_FIELD');return value.trim();};
const ratios={portrait:'9:16',landscape:'16:9',square:'1:1'};
export function artcraftSnapshot({draft,selected,assets=[]}){
 if(!draft||!Number.isSafeInteger(selected)||selected<0||!draft.scenes?.[selected])throw Error('ARTCRAFT_SCENE_REQUIRED');
 const scene=draft.scenes[selected],aspectRatio=ratios[draft.format??'portrait'];if(!aspectRatio)throw Error('ARTCRAFT_FORMAT');
 const views=scene.shots?.length?scene.shots:[scene];
 const references=assets.filter(a=>['image','video'].includes(a.kind)&&/^[a-f0-9]{64}$/.test(a.sha256??'')&&views.some(v=>['media','image'].includes(v.visual)&&[v.media,v.image].some(r=>r?.path===a.path&&r?.sha256===a.sha256))).map(a=>({id:field(a.id,80),name:field(a.name,128),kind:a.kind,sha256:a.sha256}));
 return {project:{id:field(draft.id,80),title:field(draft.title,80)},scene:{id:field(scene.id,80),title:field(scene.title,80),narration:field((scene.phrases??[]).map(p=>p.text).join('\n'),9000,true)},aspectRatio,defaultStyle:field(draft.theme??'Phù hợp chủ đề của cảnh',80),references};
}
export function artcraftBrief(snapshot,{action,camera,style,duration,referenceIds=[]}){
 if(!Number.isFinite(duration)||duration<1||duration>60)throw Error('ARTCRAFT_DURATION');
 if(!Array.isArray(referenceIds)||referenceIds.length>snapshot.references.length||new Set(referenceIds).size!==referenceIds.length||referenceIds.some(id=>!snapshot.references.some(r=>r.id===id)))throw Error('ARTCRAFT_REFERENCE');
 const motion=field(action),view=field(camera,400),look=field(style,400);
 return {schemaVersion:1,provider:'artcraft',mode:'manual-companion',project:structuredClone(snapshot.project),scene:structuredClone(snapshot.scene),aspectRatio:snapshot.aspectRatio,durationSeconds:duration,timing:'user-target-not-measured',action:motion,camera:view,style:look,references:snapshot.references.filter(r=>referenceIds.includes(r.id)).map(r=>({...r})),prompt:[`Scene: ${snapshot.scene.title}`,`Visual action: ${motion}`,`Camera: ${view}`,`Style: ${look}`,`Frame: ${snapshot.aspectRatio}. Target duration: ${duration} seconds.`,`Show actual subject movement, not a slideshow. Keep subjects and props consistent. Do not bake in text, subtitles or narration; Jarvis adds those separately.`].join('\n'),handoff:{referenceFiles:'Select and upload files yourself in Artcraft; no media is included in this brief.',import:'PNG/JPEG/WebP or MP4, at most 64 MiB per file and 60 seconds per clip.',audio:'Âm thanh clip gốc được bỏ khi nhập; Jarvis giữ giọng và phụ đề riêng.'},mediaApiRequests:0};
}
export function artcraftText(brief){return [`ARTCRAFT — ${brief.project.title}`,`Cảnh: ${brief.scene.title} (${brief.scene.id})`,'',brief.prompt,'','Lời kể tham khảo (không dùng làm chữ trên clip):',brief.scene.narration||'Chưa có lời kể.','','Reference (chỉ metadata, tự chọn file để gửi):',...brief.references.map(r=>`${r.name} | ${r.kind} | ${r.id} | SHA256 ${r.sha256}`),'',brief.handoff.referenceFiles,brief.handoff.import,brief.handoff.audio].join('\n');}
export async function importArtcraftMedia({file,rights,upload,saveLabels}){
 if(!file)return null;
 if(typeof rights!=='string'||!rights.trim()||rights.trim().length>230||/[\x00-\x1F]/.test(rights))throw Error('RIGHTS_REQUIRED');
 if(!Number.isSafeInteger(file.size)||file.size<=0||file.size>64*1024**2)throw Error('ASSET_TOO_LARGE');
 if(!/\.(png|jpe?g|webp|mp4)$/i.test(file.name??''))throw Error('ARTCRAFT_MEDIA_TYPE');
 const asset=await upload(file,'Artcraft: '+rights.trim());
 let labelsSaved=false;try{await saveLabels({id:asset.id,expectedRevision:0,group:'Artcraft',tags:['Artcraft']});labelsSaved=true;}catch{/* Import is already committed; never repeat it because optional labels failed. */}
 return {asset,labelsSaved};
}
