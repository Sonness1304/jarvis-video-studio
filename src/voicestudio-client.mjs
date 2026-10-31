const MAX=20*1024**2;
const fail=code=>{const e=Error(code);e.code=code;throw e;};
export class VoiceStudioClient{
 constructor({baseUrl='http://127.0.0.1:3900',fetchImpl=fetch,timeoutMs=120000}={}){
  let u;try{u=new URL(baseUrl);}catch{fail('INVALID_VOICE_ORIGIN');}
  if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!u.port)fail('INVALID_VOICE_ORIGIN');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>600000)fail('INVALID_VOICE_TIMEOUT');
  this.baseUrl=u.origin;this.fetch=fetchImpl;this.timeoutMs=timeoutMs;this.quarantined=false;
 }
 async request(route,{method='GET',body,headers={},audio=false}={}){
  if(method==='POST'&&this.quarantined)fail('VOICE_QUARANTINED');
  let res;try{res=await this.fetch(this.baseUrl+route,{method,body,headers,redirect:'error',signal:AbortSignal.timeout(this.timeoutMs)});}catch{
   if(method==='POST'){this.quarantined=true;fail('VOICE_OUTCOME_UNKNOWN');}fail('VOICE_UNAVAILABLE');
  }
  if(!res.ok){await res.body?.cancel();if(method==='POST'&&res.status>=500){this.quarantined=true;fail('VOICE_OUTCOME_UNKNOWN');}fail('VOICE_HTTP_'+res.status);}
  if(Number(res.headers.get('content-length'))>MAX){await res.body?.cancel();fail('VOICE_RESPONSE_SIZE');}
  if(audio&&!/^(audio\/(?:wav|x-wav)|application\/octet-stream)(?:;|$)/i.test(res.headers.get('content-type')??'')){await res.body?.cancel();fail('VOICE_AUDIO_TYPE');}
  const reader=res.body?.getReader();if(!reader)fail('VOICE_EMPTY_RESPONSE');const parts=[];let n=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>MAX){await reader.cancel();fail('VOICE_RESPONSE_SIZE');}parts.push(Buffer.from(value));}}
  catch(e){if(e.code)throw e;if(method==='POST'){this.quarantined=true;fail('VOICE_OUTCOME_UNKNOWN');}throw e;}finally{reader.releaseLock();}
  const bytes=Buffer.concat(parts);if(audio)return bytes;try{return JSON.parse(bytes.toString('utf8'));}catch{fail('VOICE_INVALID_JSON');}
 }
 async status(){
  let health;try{health=await this.request('/health');}catch(e){if(e.code==='VOICE_HTTP_503')return {ready:false,status:'starting',voices:[],models:[]};throw e;}
  if(health.version!=='0.5.6')fail('VOICE_VERSION_UNSUPPORTED');if(health.status!=='ok')return {ready:false,status:'starting',voices:[],models:[]};
  const models=await this.request('/v1/models'),bank=await this.request('/v1/audio/voices'),engines=await this.request('/engines'),inventory=await this.request('/models');
  if(!Array.isArray(models.data)||!Array.isArray(bank.voices)||models.data.length>500||bank.voices.length>500)fail('VOICE_CATALOG_INVALID');
  const voices=bank.voices.map(v=>{if(typeof v.voice_id!=='string'||!v.voice_id||v.voice_id.length>128||typeof v.name!=='string'||v.name.length>200)fail('VOICE_CATALOG_INVALID');return {voice_id:v.voice_id,name:v.name,type:v.type,language:v.language};});
  const installed=Array.isArray(inventory.models)?inventory.models.filter(m=>m.installed===true):[];
  return {ready:true,status:this.quarantined?'UNKNOWN':'ready',version:health.version,voices,models:models.data.map(m=>({id:String(m.id).slice(0,128),kind:m.voicestudio?.kind??'unknown',alias:m.voicestudio?.alias_for_active_engine===true,weightsReady:installed.some(row=>Array.isArray(row.engines)&&row.engines.includes(m.id))})),asr:engines.asr?{active:engines.asr.active,activeModel:engines.asr.active_model,device:engines.asr.backends?.find(b=>b.id===engines.asr.active)?.effective_device,weightsReady:installed.some(m=>m.repo_id===engines.asr.active_model)}:null,quarantined:this.quarantined};
 }
 async speech({engine,voiceId,text,language='vi'}){
  if(['omnivoice','omnivoice-subprocess','tts-1','tts-1-hd','gpt-4o-mini-tts'].includes(engine))fail('VOICE_NONCOMMERCIAL_ENGINE_USE_VIENEU');
  if(typeof text!=='string'||!text.trim()||text.length>240||[engine,voiceId].some(s=>typeof s!=='string'||!s||s.length>128))fail('VOICE_REQUEST_INVALID');
  return this.request('/v1/audio/speech',{method:'POST',body:JSON.stringify({model:engine,voice:voiceId,input:text,response_format:'wav',language}),headers:{'content-type':'application/json'},audio:true});
 }
 async transcribe(file,{engine,language}={}){
  if(!Buffer.isBuffer(file)||!file.length||file.length>64*1024**2||typeof engine!=='string'||!engine||engine.length>128)fail('VOICE_ASR_REQUEST_INVALID');
  const body=new FormData();body.set('file',new Blob([file],{type:'audio/wav'}),'source.wav');body.set('model',engine);body.set('response_format','verbose_json');if(language)body.set('language',language);
  return this.request('/v1/audio/transcriptions',{method:'POST',body});
 }
}
