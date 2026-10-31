import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';
import {ContentAttempts,contentProcessIdentity} from './content-attempts.mjs';import {atomicJson} from './editor-atomic.mjs';import {requestContent} from './content-ai.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),store=new ContentAttempts(root),id=process.argv[2];
try{
 const request=await store.request(id),identity=contentProcessIdentity(process.pid);
 if(!identity)throw Error('CONTENT_OWNER_UNKNOWN');
 await atomicJson(root,store.file(id,'owner.json'),{...identity,nonce:request.nonce,childNonce:randomUUID()});
 await store.update(id,{status:'RUNNING'});let usage=null,actualModel=null;
 try{
  const result=await requestContent({input:{contentBrief:request.contentBrief,sceneCount:request.sceneCount},model:request.model,apiKey:process.env.JARVIS_GATEWAY_KEY,
   onAccepted:()=>atomicJson(root,store.file(id,'accepted.json'),{requestHash:request.requestHash,acceptedAt:new Date().toISOString()}),
   onUsage:async v=>{usage=v.usage;actualModel=v.actualModel;await atomicJson(root,store.file(id,'usage.json'),v);}});
  await store.publish(id,{status:'VERIFIED',nonce:request.nonce,requestHash:request.requestHash,...result});
 }catch(e){await store.publish(id,{status:e.unknown?'UNKNOWN':'FAILED',nonce:request.nonce,requestHash:request.requestHash,error:/^CONTENT_[A-Z0-9_]+$/.test(e.code??e.message)?e.code??e.message:'CONTENT_FAILED',fallbackEligible:e.fallbackEligible===true,usage,actualModel});}
}catch{process.exitCode=1;}finally{delete process.env.JARVIS_GATEWAY_KEY;}
