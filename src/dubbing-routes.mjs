import {auditionSignature} from '../web/dubbing-audition-model.mjs';
import {randomBytes,randomUUID} from 'node:crypto';import {DubbingStore} from './voice-dubbing.mjs';import {readAsset} from './assets.mjs';import {validateVoice} from '../web/voice-model.mjs';import {dubbingSignature,validateDubbing,resolveDubbingVoice} from '../web/dubbing-model.mjs';
const object=(v,allowed)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw Error('DUB_REQUEST_INVALID');};
export function dubbingRoutes({root,jobs}){
 const store=new DubbingStore(root);return async({req,res,route,body,json})=>{
  if(route==='/api/dubbing'&&req.method==='GET'){json(res,200,await store.list());return true;}
  if(route==='/api/dubbing'&&req.method==='POST'){const v=await body(req);object(v,['assetId']);const asset=await readAsset(root,v.assetId);if(asset.kind!=='video')throw Error('DUB_VIDEO_REQUIRED');json(res,201,await store.create(asset));return true;}
  const m=/^\/api\/dubbing\/(dub-[a-f0-9-]{36})(?:\/(preview|audition|transcribe|translate|speakers|export))?$/.exec(route);if(!m)return false;
  const record=await store.read(m[1]);if(req.method==='GET'&&!m[2]){json(res,200,record);return true;}if(req.method!=='POST')return false;const input=await body(req,2*1024*1024);object(input,m[2]==='audition'?['expectedRevision','segmentId','voice']:m[2]?['expectedRevision','segmentId','engine','language','transcriptConsent']:['expectedRevision','doc']);if(record.revision!==input.expectedRevision)throw Error('REVISION_CONFLICT');
  if(!m[2]){validateDubbing(input.doc);json(res,200,await store.save(m[1],input.expectedRevision,input.doc));return true;}
  if(m[2]==='translate'&&input.transcriptConsent!==true)throw Error('DUB_TRANSLATION_CONSENT_REQUIRED');
  if(m[2]==='preview'||m[2]==='audition'){const s=record.doc.segments.find(s=>s.id===input.segmentId);if(!s||!s.targetText.trim())throw Error('DUB_TARGET_REQUIRED');const voice=validateVoice(m[2]==='audition'?input.voice:resolveDubbingVoice(record.doc,s)),request={text:s.targetText,voice,signature:m[2]==='audition'?auditionSignature(record.doc,s.id,voice):dubbingSignature(record.doc,s),takeId:'take-'+randomUUID(),seed:randomBytes(4).readUInt32LE()};json(res,202,await jobs.start('voice-workbench',{projectId:record.doc.id,projectRevision:record.revision,request}));return true;}
  if(m[2]==='transcribe'&&input.engine!=='faster-whisper'||input.engine!==undefined&&(typeof input.engine!=='string'||input.engine.length>128)||input.language!==undefined&&!/^[a-z]{2,3}$/.test(input.language))throw Error('DUB_ASR_REQUEST_INVALID');
  json(res,202,await jobs.start('dubbing',{projectId:record.doc.id,projectRevision:record.revision,request:{action:m[2],doc:record.doc,revision:record.revision,...(input.engine?{engine:input.engine}:{}),...(input.language?{language:input.language}:{})}}));return true;
 };
}
