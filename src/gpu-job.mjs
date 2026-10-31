import fs from 'node:fs/promises';import {safeChild} from './core.mjs';
import {createHash} from 'node:crypto';import {hashFile} from './runtime.mjs';
export async function writeOwnedArtifact(root,relative,payload){
 const file=safeChild(root,relative);
 try{await fs.writeFile(file,payload,{flag:'wx'});return {reused:false};}
 catch(e){if(e.code!=='EEXIST')throw e;}
 if((await fs.stat(file)).size!==payload.length||await hashFile(file)!==createHash('sha256').update(payload).digest('hex'))throw Error('GPU_ARTIFACT_CHANGED');return {reused:true};
}
const validId=x=>typeof x==='string'&&/^jarvis-[a-f0-9-]{36}$/.test(x);
const pending=root=>safeChild(root,'.runtime/gpu-job.json');
export async function createGpuIntent(root,record){
 if(!validId(record.clientId)||record.receipt!=='outputs/'+record.clientId+'/receipt.json')throw Error('INVALID_GPU_INTENT');
 await fs.writeFile(pending(root),JSON.stringify(record)+'\n',{flag:'wx'});
}
export async function readGpuIntent(root){
 const file=pending(root);if((await fs.stat(file)).size>4096)throw Error('GPU_INTENT_OVERSIZE');
 const record=JSON.parse(await fs.readFile(file,'utf8'));if(!validId(record.clientId)||record.receipt!=='outputs/'+record.clientId+'/receipt.json')throw Error('INVALID_GPU_INTENT');return record;
}
export async function resolveGpuIntent(root,clientId,status){
 if(!['VERIFIED','FAILED'].includes(status))throw Error('GPU_JOB_NOT_TERMINAL');
 const current=await readGpuIntent(root);if(current.clientId!==clientId)throw Error('GPU_INTENT_OWNER_CHANGED');
 const archive=safeChild(root,'.runtime/gpu-job-archive');await fs.mkdir(archive,{recursive:true});
 await fs.rename(pending(root),safeChild(root,'.runtime/gpu-job-archive/'+clientId+'.json'));
}
export async function findGpuPrompt(client,clientId){
 const queue=await client.request('/queue'),history=await client.request('/history?max_items=100');
 const rows=[...(queue.queue_running??[]),...(queue.queue_pending??[]),...Object.values(history).map(x=>x.prompt)];
 const matching=rows.filter(x=>Array.isArray(x)&&x[3]?.client_id===clientId).map(x=>x[1]);
 const ids=[...new Set(matching)];if(ids.length>1)throw Error('GPU_JOB_IDENTITY_DUPLICATE');return ids[0]??null;
}
