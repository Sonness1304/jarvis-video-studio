export function assertResources({ram,vram,disk}){
 for(const [name,value,minimum] of [['RAM',ram,3*1024**3],['VRAM',vram,6*1024**3],['DISK',disk,30*1024**3]])if(!Number.isFinite(value)||value<minimum)throw Error('INSUFFICIENT_'+name);
 return true;
}
export function validateOutput(file,prefix){
 if(!file||file.type!=='output'||file.subfolder!==''||typeof file.filename!=='string'||!file.filename.startsWith(prefix+'_')||!/^jarvis-[a-z0-9-]+_\d+_\.(png|mp4)$/.test(file.filename))throw Error('INVALID_GPU_OUTPUT');return file;
}
export function validateClipExport(meta){
 const v=meta.streams?.find(s=>s.codec_type==='video');
 if(!v||v.codec_name!=='h264'||v.width!==320||v.height!==512||Number(v.nb_frames)!==49||v.r_frame_rate!=='24/1'||!Number.isFinite(Number(meta.format?.duration))||Math.abs(Number(meta.format.duration)-49/24)>.05)throw Error('CLIP_EXPORT_CONTRACT_FAILED');return true;
}
export function imageGraph(text,prefix,seed=20261013){
 if(typeof text!=='string'||!text.trim()||text.length>4000||/[\x00-\x08]/.test(text)||!/^jarvis-[a-z0-9-]+$/.test(prefix)||!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('INVALID_IMAGE_REQUEST');
 return {
  '1':{class_type:'CheckpointLoaderSimple',inputs:{ckpt_name:'sd_xl_base_1.0.safetensors'}},
  '2':{class_type:'CLIPTextEncode',inputs:{text,clip:['1',1]}},
  '3':{class_type:'CLIPTextEncode',inputs:{text:'watermark, text, logo, deformed, low quality',clip:['1',1]}},
  '4':{class_type:'EmptyLatentImage',inputs:{width:768,height:1024,batch_size:1}},
  '5':{class_type:'KSampler',inputs:{model:['1',0],positive:['2',0],negative:['3',0],latent_image:['4',0],seed,steps:20,cfg:6,sampler_name:'euler',scheduler:'normal',denoise:1}},
  '6':{class_type:'VAEDecode',inputs:{samples:['5',0],vae:['1',2]}},
  '7':{class_type:'SaveImage',inputs:{images:['6',0],filename_prefix:prefix}}
 };
}
export function clipGraph(text,prefix,imageName){
 imageGraph(text,prefix);if(imageName!==prefix+'.png')throw Error('INVALID_CLIP_IMAGE');
 return {
  '1':{class_type:'CheckpointLoaderSimple',inputs:{ckpt_name:'ltxv-2b-0.9.8-distilled-fp8.safetensors'}},
  '2':{class_type:'CLIPLoader',inputs:{clip_name:'t5xxl_fp8_e4m3fn_scaled.safetensors',type:'ltxv',device:'default'}},
  '3':{class_type:'CLIPTextEncode',inputs:{text,clip:['2',0]}},
  '4':{class_type:'CLIPTextEncode',inputs:{text:'text, watermark, sudden camera movement, distortion',clip:['2',0]}},
  '5':{class_type:'LoadImage',inputs:{image:imageName}},
  '6':{class_type:'LTXVImgToVideo',inputs:{positive:['3',0],negative:['4',0],vae:['1',2],image:['5',0],width:320,height:512,length:49,batch_size:1,strength:1}},
  '7':{class_type:'LTXVConditioning',inputs:{positive:['6',0],negative:['6',1],frame_rate:24}},
  '8':{class_type:'RandomNoise',inputs:{noise_seed:20261013}},
  '9':{class_type:'CFGGuider',inputs:{model:['1',0],positive:['7',0],negative:['7',1],cfg:1}},
  '10':{class_type:'KSamplerSelect',inputs:{sampler_name:'euler'}},
  '11':{class_type:'ManualSigmas',inputs:{sigmas:'1, 0.9937, 0.9875, 0.9812, 0.975, 0.9094, 0.725, 0.4219, 0'}},
  '12':{class_type:'SamplerCustomAdvanced',inputs:{noise:['8',0],guider:['9',0],sampler:['10',0],sigmas:['11',0],latent_image:['6',2]}},
  '15':{class_type:'VAEDecode',inputs:{samples:['12',1],vae:['1',2]}},
  '13':{class_type:'CreateVideo',inputs:{images:['15',0],fps:24}},
  '14':{class_type:'SaveVideo',inputs:{video:['13',0],filename_prefix:prefix,format:'mp4','format.codec':'h264'}}
 };
}
export async function submitMeasured(client,graph,id,resources){const r=await resources();assertResources(r);return {...await client.submit(graph,id),submitResources:r};}
export async function waitForJob(client,id,{deadlineMs=1800000,now=()=>performance.now(),pause=ms=>new Promise(r=>setTimeout(r,ms)),onPoll=async()=>{}}={}){
 const deadline=now()+deadlineMs;
 while(now()<deadline){
  const state=await client.history(id,{timeoutMs:Math.max(1,Math.min(10000,deadline-now()))});
  if(state.status!=='PENDING')return state;
  if(now()>=deadline)break;
  await onPoll(Math.max(1,deadline-now()));
  if(now()>=deadline)break;await pause(Math.min(5000,deadline-now()));
 }
 return {status:'UNKNOWN',error:'PILOT_DEADLINE_READ_HISTORY_BEFORE_RETRY'};
}
export class ComfyClient{
 constructor(base='http://127.0.0.1:8188'){
  const url=new URL(base);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/'||url.username||url.password||url.search||url.hash)throw Error('INVALID_BACKEND_URL');this.base=url.origin;
 }
 async request(route,{body,timeoutMs=10000}={}){
  const response=await fetch(this.base+route,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeoutMs),redirect:'error'});
  if(!response.ok)throw Error('BACKEND_HTTP_'+response.status);
  const reader=response.body.getReader();let count=0;const chunks=[];
  try{while(true){const next=await reader.read();if(next.done)break;count+=next.value.length;if(count>1024*1024){await reader.cancel();throw Error('BACKEND_BODY_OVERSIZE');}chunks.push(next.value);}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}finally{reader.releaseLock();}
 }
 async submit(graph,clientId){
  try{const reply=await this.request('/prompt',{body:{prompt:graph,client_id:clientId},timeoutMs:20000});
   if(typeof reply.prompt_id!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(reply.prompt_id))return {status:'UNKNOWN',error:'SUBMIT_REPLY_INVALID'};
   return {status:'SUBMITTED',promptId:reply.prompt_id};
  }catch(e){return {status:e.message.startsWith('BACKEND_HTTP_4')?'FAILED':'UNKNOWN',error:e.message.startsWith('BACKEND_')?e.message:'SUBMIT_TRANSPORT_UNKNOWN'};}
 }
 async history(id,options={}){
  if(!/^[-a-zA-Z0-9]{1,80}$/.test(id))throw Error('INVALID_PROMPT_ID');
  const item=(await this.request('/history/'+id,options))[id];if(!item)return {status:'PENDING'};
  if(item.status?.status_str==='error')return {status:'FAILED',error:'BACKEND_EXECUTION_FAILED'};
  if(item.status?.completed!==true||item.status?.status_str!=='success')return {status:'PENDING'};
  const files=Object.values(item.outputs??{}).flatMap(v=>[...(v.images??[]),...(v.videos??[])]);
  if(files.length!==1)throw Error('OUTPUT_MISSING_OR_DUPLICATE');return {status:'COMPLETED',output:files[0]};
 }
}
