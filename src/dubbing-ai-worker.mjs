import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {safeChild} from './core.mjs';import {readLimited} from './editor-store.mjs';import {requestDubbingTranslation} from './dubbing-translation.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),id=process.argv[2];let result;
try{
 if(!/^job-[a-f0-9-]{36}$/.test(id??''))throw Error('DUB_REQUEST_INVALID');
 const dir=safeChild(root,'.runtime/studio/jobs/'+id),input=JSON.parse(await readLimited(path.join(dir,'dubbing-request.json'),2*1024*1024));
 if(input.action!=='translate')throw Error('DUB_REQUEST_INVALID');
 result={schemaVersion:1,action:'translate',documentId:input.doc.id,documentRevision:input.revision,sourceHash:input.doc.sourceHash,mediaApiRequests:0,mediaApiCostUsd:0};
 const progress={schemaVersion:1,jobId:id,batches:[]},write=()=>fs.writeFile(path.join(dir,'translation-progress.json'),JSON.stringify(progress));
 try{const translated=await requestDubbingTranslation(input.doc,{apiKey:process.env.JARVIS_GATEWAY_KEY,onAccepted:async({batch})=>{progress.submittedBatch=batch;await write();},onUsage:async u=>{progress.batches.push(u);await write();}});Object.assign(result,translated,{status:'VERIFIED'});}
 catch(e){Object.assign(result,{status:e.unknown?'UNKNOWN':'FAILED',error:/^DUB_[A-Z0-9_]+$/.test(e.code??'')?e.code:'DUB_TRANSLATION_FAILED',usage:progress.batches});}
 await fs.writeFile(path.join(dir,'translation-receipt.json'),JSON.stringify(result));
}catch{result={status:'FAILED',error:'DUB_TRANSLATION_FAILED'};}
console.log(JSON.stringify(result));process.exitCode=result.status==='VERIFIED'?0:1;
