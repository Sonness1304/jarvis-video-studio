import {spawn,execFileSync} from 'node:child_process';import {createWriteStream,writeSync,ftruncateSync} from 'node:fs';import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';import {finished} from 'node:stream/promises';import {safeChild} from './core.mjs';
export const strictDecodeArgs=file=>['-v','error','-xerror','-i',file,'-map','0:v:0','-map','0:a:0','-f','null','-'];
function processAlive(pid){try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw Error('OWNER_LIVENESS_UNKNOWN');}}
async function relatedProcesses(root,lease,checkRoot=false){
 if(process.platform!=='win32')throw Error('RECOVERY_PLATFORM_UNVERIFIED');
 const script="$ErrorActionPreference='Stop'; $ids=@($env:JARVIS_VIDEO_CHILD_PIDS -split ',' | Where-Object { $_ } | ForEach-Object { [int]$_ }); $own=[int]$env:JARVIS_VIDEO_OWNER_PID; $current=[int]$env:JARVIS_VIDEO_RECOVERY_PID; $found=@(Get-CimInstance Win32_Process -Filter \"Name='node.exe' OR Name='python.exe' OR Name='ffmpeg.exe' OR Name='chrome-headless-shell.exe'\" | Where-Object { $_.ProcessId -ne $current -and (($env:JARVIS_VIDEO_CHECK_ROOT -eq '1' -and $_.CommandLine -and $_.CommandLine.IndexOf($env:JARVIS_VIDEO_ROOT,[StringComparison]::OrdinalIgnoreCase) -ge 0) -or ($ids -contains $_.ProcessId) -or ($ids -contains $_.ParentProcessId) -or $_.ParentProcessId -eq $own) }); @{related=($found.Count -gt 0)} | ConvertTo-Json -Compress";
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['systemroot','windir','path','pathext','temp','tmp','userprofile','localappdata','appdata','programfiles'].includes(k.toLowerCase())));
 Object.assign(env,{JARVIS_VIDEO_ROOT:path.resolve(root),JARVIS_VIDEO_CHECK_ROOT:checkRoot?'1':'0',JARVIS_VIDEO_CHILD_PIDS:lease.children.join(','),JARVIS_VIDEO_OWNER_PID:String(lease.pid),JARVIS_VIDEO_RECOVERY_PID:String(process.pid)});
 try{return JSON.parse(execFileSync('pwsh',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{env,windowsHide:true,encoding:'utf8',timeout:15000,maxBuffer:16384})).related!==false;}catch{throw Error('RELATED_PROCESS_PROBE_FAILED');}
}
function validateLease(lease){if(!lease||!Number.isInteger(lease.pid)||lease.pid<=0||!/^[-a-f0-9]{36}$/.test(lease.nonce)||!Array.isArray(lease.children)||lease.children.length>32||lease.children.some(p=>!Number.isInteger(p)||p<=0))throw Error('INVALID_BUILD_LOCK');return lease;}
async function readLease(file){const stat=await fs.stat(file);if(stat.size>4096)throw Error('INVALID_BUILD_LOCK');return validateLease(JSON.parse(await fs.readFile(file,'utf8')));}
export async function acquireBuildLock(root){
 await fs.mkdir(safeChild(root,'.runtime'),{recursive:true});const file=safeChild(root,'.runtime/build.lock');let handle;
 try{await fs.lstat(safeChild(root,'.runtime/gpu-job.json'));throw Error('GPU_JOB_PENDING');}catch(e){if(e.code!=='ENOENT')throw e;}
 try{handle=await fs.open(file,'wx');}catch(error){if(error.code==='EEXIST')throw Error('BUILD_ALREADY_LOCKED');throw error;}
 const lease={pid:process.pid,nonce:randomUUID(),startedAt:new Date().toISOString(),children:[]};
 const save=()=>{const data=Buffer.from(JSON.stringify(lease));writeSync(handle.fd,data,0,data.length,0);ftruncateSync(handle.fd,data.length);};save();
 const release=async()=>{await handle.close();const current=await readLease(file);if(current.nonce!==lease.nonce)throw Error('BUILD_LOCK_OWNER_CHANGED');if(await relatedProcesses(root,lease))throw Error('BUILD_LOCK_RETAINED_RELATED_PROCESSES');await fs.unlink(file);};
 release.recordChild=pid=>{if(pid&&lease.children.length<32){lease.children.push(pid);save();}};return release;
}
export async function recoverBuildLock(root,{isAlive=processAlive,relatedProcesses:probe=relatedProcesses}={}){
 const file=safeChild(root,'.runtime/build.lock'),lease=await readLease(file);
 if(await isAlive(lease.pid))throw Error('BUILD_LOCK_OWNER_ALIVE');if(await probe(root,lease,true))throw Error('BUILD_LOCK_RELATED_PROCESSES');
 const current=await readLease(file);if(current.nonce!==lease.nonce)throw Error('BUILD_LOCK_OWNER_CHANGED');
 const archive='lock-archive/lock-'+lease.nonce+'.json';await fs.mkdir(safeChild(root,'.runtime/lock-archive'),{recursive:true});await fs.rename(file,safeChild(root,'.runtime/'+archive));
 return {status:'VERIFIED',archive,deletedProcesses:0};
}
export function childEnvironment(root,config){
 const allowed=['SystemRoot','WINDIR','PATH','PATHEXT','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA','COMSPEC','PROGRAMFILES','PROGRAMFILES(X86)','ProgramData'];
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>allowed.some(x=>x.toLowerCase()===k.toLowerCase())));
 Object.assign(env,{PYTHONIOENCODING:'utf-8',PYTHONUTF8:'1',HF_HOME:root+'/.cache/huggingface',HF_HUB_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1',ORT_DISABLE_TELEMETRY:'1',HYPERFRAMES_NO_TELEMETRY:'1',DO_NOT_TRACK:'1',HYPERFRAMES_BROWSER_PATH:config.paths.chrome,HYPERFRAMES_FFMPEG_PATH:root+'/'+config.paths.ffmpeg,HYPERFRAMES_FFPROBE_PATH:root+'/'+config.paths.ffprobe,HYPERFRAMES_EXTRACT_CACHE_DIR:root+'/.cache/frames'});return env;
}
export async function runProcess(exe,args,{cwd,env,log,timeoutMs=600000,onSpawn=()=>{}}){
 const handle=await fs.open(log,'wx');
 return await new Promise((resolve,reject)=>{
  const output=createWriteStream(log,{fd:handle.fd,autoClose:false});const flushed=finished(output,{cleanup:true});void flushed.catch(()=>{});let bytes=0,child=null,timer=null,settled=false;
  const finish=async(error,code=0,signal=null)=>{if(settled)return;settled=true;clearTimeout(timer);if(!output.destroyed)output.end();try{await flushed;}catch(e){error??=Error('LOG_WRITE_FAILED_'+e.code);}try{await handle.close();}catch(e){error??=e;}if(error)reject(error);else if(code!==0)reject(Error('PROCESS_FAILED_'+code+'_'+signal));else resolve({exitCode:code,log,bytes});};
  output.on('error',error=>{child?.kill();void finish(Error('LOG_WRITE_FAILED_'+error.code));});
  try{child=spawn(exe,args,{cwd,env,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});onSpawn(child.pid);}catch(e){child?.kill();void finish(e);return;}
  timer=setTimeout(()=>{child.kill();void finish(Error('PROCESS_TIMEOUT'));},timeoutMs);
  const collect=data=>{if(!output.destroyed&&bytes<4*1024*1024)output.write(data.subarray(0,4*1024*1024-bytes));bytes+=data.length;};
  child.stdout.on('data',collect);child.stderr.on('data',collect);
  child.on('error',err=>void finish(err));child.on('close',(code,signal)=>void finish(null,code,signal));
 });
}
