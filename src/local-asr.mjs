import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';
import {safeChild} from './core.mjs';import {hashFile} from './runtime.mjs';import {readLimited} from './editor-store.mjs';import {runProcess,childEnvironment} from './process.mjs';

export async function runLocalAsr(root,{out,engine,language,duration,onSpawn=()=>{},env=process.env},{run=runProcess,freeMemory=os.freemem,appData=process.env.APPDATA,localAppData=process.env.LOCALAPPDATA}={}){
 if(engine!=='faster-whisper'||!Number.isFinite(duration)||duration<=0||duration>600||typeof language!=='string'||! /^[a-z]{2,3}$/.test(language))throw Error('ASR_REQUEST_INVALID');
 if(freeMemory()<4*1024**3)throw Error('VOICE_RAM_GATE_4GIB');
 out=safeChild(root,path.relative(root,out));const audio=path.join(out,'source.wav');
 let lock,python,runtimeLock;try{lock=JSON.parse(await readLimited(safeChild(root,'asr-runtime.lock.json')));runtimeLock='asr-runtime.lock.json';if(lock.schemaVersion!==1||lock.pythonPath!=='.venv-asr/Scripts/python.exe')throw Error('VOICE_ASR_RUNTIME_CHANGED');python=safeChild(root,lock.pythonPath);}
 catch(e){if(e.code!=='ENOENT')throw e;lock=JSON.parse(await readLimited(safeChild(root,'voicestudio-runtime.lock.json'))).asr;runtimeLock='voicestudio-runtime.lock.json';try{const location=JSON.parse(await readLimited(path.join(appData,'VoiceStudio/runtime-location.json')));python=path.join(location.root,'project/.venv/Scripts/python.exe');}catch{throw Error('VOICE_ASR_RUNTIME_MISSING');}}
 try{if(await hashFile(python)!==lock.pythonSha256)throw Error('VOICE_ASR_RUNTIME_CHANGED');}catch(e){if(e.code==='ENOENT')throw Error('VOICE_ASR_RUNTIME_MISSING');throw e;}
 const model=path.join(localAppData,'OmniVoice/hf_cache/models--Systran--faster-whisper-small/snapshots',lock.modelRevision),nonce=randomUUID(),audioSha256=await hashFile(audio);
 const requestFile=path.join(out,'asr-request.json'),resultFile=path.join(out,'asr-result.json');await fs.writeFile(requestFile,JSON.stringify({nonce,audio,audioSha256,model,duration,language,runtimeLock}),{flag:'wx'});
 const isolated=childEnvironment(root,{paths:{chrome:''}});for(const key of Object.keys(isolated))if(env[key]!==undefined)isolated[key]=env[key];Object.assign(isolated,{HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1'});
 let spawned=false;
 try{await run(python,['-I','-X','utf8',safeChild(root,'src/local_asr.py'),requestFile],{cwd:root,env:isolated,log:path.join(out,'asr.log'),timeoutMs:duration>60?1500000:600000,onSpawn:pid=>{spawned=!!pid;onSpawn(pid);}});}
 catch(error){if(spawned&&!/^PROCESS_FAILED_/.test(error.message)){const unknown=Error('VOICE_OUTCOME_UNKNOWN');unknown.code='VOICE_OUTCOME_UNKNOWN';throw unknown;}throw error;}
 const result=JSON.parse(await readLimited(resultFile,2*1024*1024));
 if(result.schemaVersion!==1||result.nonce!==nonce||result.audioSha256!==audioSha256)throw Error('VOICE_ASR_RESULT_INVALID');
 if(result.status==='FAILED')throw Error(/^[A-Z0-9_]{1,80}$/.test(result.error??'')?result.error:'VOICE_ASR_FAILED');
 if(result.status!=='VERIFIED'||result.engine!==engine||result.modelRevision!==lock.modelRevision||result.device!=='cpu'||result.computeType!=='int8'||!Array.isArray(result.segments)||result.segments.length>1000)throw Error('VOICE_ASR_RESULT_INVALID');
 return result;
}
