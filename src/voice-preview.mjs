import fs from 'node:fs/promises';import path from 'node:path';import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {canonicalVoice,readVoices} from './studio.mjs';import {preflight,hashFile} from './runtime.mjs';
import {audioCacheKey,safeChild} from './core.mjs';import {childEnvironment,acquireBuildLock,runProcess} from './process.mjs';
export function voiceSettings(voice,{config,models,installed}){
 return {voice,modelHash:createHash('sha256').update(JSON.stringify(models)).digest('hex'),voicesHash:config.hashes.voices,python:installed.python,vieneu:installed.dependencies.vieneu,onnx:installed.dependencies.onnxruntime,phonemizer:installed.dependencies['sea-g2p'],dependenciesHash:config.hashes.pythonLock,sdkEngineHash:config.hashes.vieneuEngine,sdkWrapperHash:config.hashes.vieneuWrapper,backend:'onnx-cpu-fp32',temperature:0.8,threads:4};
}
export async function previewVoice(root,name){
 const voice=canonicalVoice(name,await readVoices(root));const release=await acquireBuildLock(root);
 try{
  const runtime=await preflight(root),{config}=runtime,env=childEnvironment(root,config);
  const relative='outputs/voice-preview-'+randomUUID(),out=safeChild(root,relative);await fs.mkdir(out);
  const text='Xin chào! Đây là giọng đọc thử cho xưởng video Jarvis. Một câu chuyện rõ ràng bắt đầu từ điều bạn muốn chia sẻ.';
  const request={voice,phrases:[{id:'sample',text,cacheKey:audioCacheKey(text,voiceSettings(voice,runtime))}],resultFile:relative+'/tts-result.json'};
  const write=(name,value)=>fs.writeFile(path.join(out,name),JSON.stringify(value,null,2)+'\n');
  const receipt={schemaVersion:1,status:'RUNNING',voice,text,mediaApiRequests:0,mediaApiCostUsd:0,source:{head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8',windowsHide:true}).trim()},runtime:voiceSettings(voice,runtime)};
  await write('receipt.json',receipt);await write('tts-request.json',request);
  try{
   await runProcess(path.join(root,config.paths.python),['src/tts.py','synthesize',relative+'/tts-request.json'],{cwd:root,env,log:path.join(out,'tts.log'),onSpawn:release.recordChild});
   const result=JSON.parse(await fs.readFile(path.join(out,'tts-result.json'),'utf8')),a=result.audio?.sample;
   if(!a||await hashFile(safeChild(root,a.file))!==a.sha256)throw Error('PREVIEW_AUDIO_CHANGED');
   await fs.copyFile(safeChild(root,a.file),path.join(out,'sample.wav'));
   await runProcess(path.join(root,config.paths.ffmpeg),['-v','error','-xerror','-i',path.join(out,'sample.wav'),'-map','0:a:0','-f','null','-'],{cwd:root,env,log:path.join(out,'decode.log'),onSpawn:release.recordChild});
   Object.assign(receipt,{status:'VERIFIED',duration:a.samples/a.sampleRate,generated:result.generated,audio:{path:relative+'/sample.wav',sha256:a.sha256},audioUserApproval:'UNVERIFIED'});await write('receipt.json',receipt);return receipt;
  }catch(e){receipt.status='FAILED';receipt.error=e.message;await write('receipt.json',receipt);throw e;}
 }finally{await release();}
}
