import {timingSafeEqual} from 'node:crypto';import fs from 'node:fs/promises';import {safeChild} from './core.mjs';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const execute=promisify(execFile);
async function windowsPidProbe(pid){
 const script="$ErrorActionPreference='Stop';$p=Get-CimInstance Win32_Process -Filter 'ProcessId="+pid+"' -ErrorAction Stop;if($null -eq $p){'ABSENT'}else{'PRESENT'}";
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','path','pathext','temp','tmp','userprofile','programfiles'].includes(key.toLowerCase())));
 const {stdout}=await execute('C:/Program Files/PowerShell/7/pwsh.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{env,windowsHide:true,timeout:2000,maxBuffer:1024});return stdout.trim();
}
export async function desktopPidState(pid,{kill=value=>process.kill(value,0),platform=process.platform,windowsProbe=windowsPidProbe}={}){
 if(!Number.isSafeInteger(pid)||pid<=0)return 'unknown';
 try{kill(pid);return 'unknown';}catch(error){if(error.code==='ESRCH')return 'dead';if(platform!=='win32'||error.code!=='EPERM')return 'unknown';}
 try{return await windowsProbe(pid)==='ABSENT'?'dead':'unknown';}catch{return 'unknown';}
}
export class DesktopLifecycle{
 #nonce;#mutations=0;#phase='READY';#activity;#activityTimeoutMs;
 constructor({ownerNonce,activity,activityTimeoutMs=2000}){this.#nonce=/^[a-f0-9]{64}$/.test(ownerNonce??'')?Buffer.from(ownerNonce,'hex'):null;this.#activity=activity;this.#activityTimeoutMs=Number.isInteger(activityTimeoutMs)&&activityTimeoutMs>0&&activityTimeoutMs<=2000?activityTimeoutMs:2000;}
 get phase(){return this.#phase;}
 enterMutation(){if(this.#phase!=='READY')throw Error('STUDIO_SHUTTING_DOWN');this.#mutations++;let released=false;return()=>{if(!released){released=true;this.#mutations--;}};}
 async requestShutdown(nonce){
  if(!this.#nonce||!/^[a-f0-9]{64}$/.test(nonce??'')||!timingSafeEqual(this.#nonce,Buffer.from(nonce,'hex')))throw Error('DESKTOP_OWNER_DENIED');
  if(this.#phase!=='READY')throw Error('STUDIO_SHUTTING_DOWN');if(this.#mutations)throw Error('DESKTOP_BUSY');this.#phase='CHECKING';
  let timer;
  try{let activity;try{activity=await Promise.race([Promise.resolve().then(()=>this.#activity()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DESKTOP_UNKNOWN')),this.#activityTimeoutMs);})]);}catch{throw Error('DESKTOP_UNKNOWN');}if(activity!=='idle')throw Error(activity==='busy'?'DESKTOP_BUSY':'DESKTOP_UNKNOWN');this.#phase='CLOSING';return {status:'READY_TO_CLOSE'};}
  catch(e){this.#phase='READY';throw e;}
  finally{clearTimeout(timer);}
 }
}
export async function studioActivity({root,jobs,batches,content,pidState=desktopPidState}){
 if(jobs.admitting)return 'busy';
 for(const r of jobs.records.values()){if(r.status==='RUNNING')return 'busy';if(!['VERIFIED','FAILED'].includes(r.status))return 'unknown';if(r.pid&&await pidState(r.pid)!=='dead')return 'unknown';}
 const batch=batches.activity();if(batch!=='idle')return batch;
 for(const file of ['.runtime/build.lock','.runtime/gpu-job.json'])try{await fs.lstat(safeChild(root,file));return 'unknown';}catch(e){if(e.code!=='ENOENT')return 'unknown';}
 return content.activity();
}
