import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';
import {safeChild} from './core.mjs';import {readLimited} from './editor-store.mjs';import {hashFile} from './runtime.mjs';import {runProcess,childEnvironment} from './process.mjs';
import {validateDubbing,upgradeDubbing,applySpeakerSuggestions} from '../web/dubbing-model.mjs';
export async function runLocalSpeakers(root,{out,doc,onSpawn=()=>{}},{run=runProcess,freeMemory=os.freemem}={}){
 validateDubbing(doc);if(!doc.segments.length)throw Error('DUB_NO_SEGMENTS');if(freeMemory()<1024**3)throw Error('DUB_SPEAKER_RAM_GATE_1GIB');
 const lock=JSON.parse(await readLimited(safeChild(root,'speaker-runtime.lock.json')));if(lock.schemaVersion!==1||lock.pythonPath!=='.venv/Scripts/python.exe')throw Error('DUB_SPEAKER_RUNTIME_CHANGED');
 for(const [relative,sha] of [[lock.pythonPath,lock.pythonSha256],...Object.entries(lock.files)])if(await hashFile(safeChild(root,relative))!==sha)throw Error('DUB_SPEAKER_RUNTIME_CHANGED');
 const audio=path.join(out,'source.wav'),nonce=randomUUID(),audioSha256=await hashFile(audio),file=path.join(out,'speakers-request.json');
 await fs.writeFile(file,JSON.stringify({nonce,audio,audioSha256,segments:doc.segments.map(({id,start,end})=>({id,start,end}))}),{flag:'wx'});
 let spawned=false;try{await run(safeChild(root,lock.pythonPath),['-I','-X','utf8',safeChild(root,'src/dubbing_speakers.py'),file],{cwd:root,env:childEnvironment(root,{paths:{chrome:''}}),log:path.join(out,'speakers.log'),timeoutMs:600000,onSpawn:pid=>{spawned=!!pid;onSpawn(pid);}});}catch(e){if(spawned&&!/^PROCESS_FAILED_/.test(e.message))throw Object.assign(Error('VOICE_OUTCOME_UNKNOWN'),{code:'VOICE_OUTCOME_UNKNOWN'});throw e;}
 const result=JSON.parse(await readLimited(path.join(out,'speakers-result.json'),2*1024*1024));
 if(result.schemaVersion!==1||result.nonce!==nonce||result.audioSha256!==audioSha256)throw Error('DUB_SPEAKER_RESULT_INVALID');
 if(result.status==='FAILED')throw Error(/^DUB_[A-Z0-9_]{1,70}$/.test(result.error??'')?result.error:'DUB_SPEAKER_FAILED');
 if(result.status!=='VERIFIED'||result.method!=='local-cue-encoder-v1-experimental'||result.reviewRequired!==true||result.quality!=='UNVERIFIED')throw Error('DUB_SPEAKER_RESULT_INVALID');
 const proposed=applySpeakerSuggestions(upgradeDubbing(doc),result);return {speakers:proposed.speakers,segments:proposed.segments,method:result.method,quality:'UNVERIFIED',reviewRequired:true};
}
