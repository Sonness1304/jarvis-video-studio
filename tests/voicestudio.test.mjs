import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {VoiceStudioClient} from '../src/voicestudio-client.mjs';
test('connector refuses foreign origins, credentials, paths and invalid ports before networking',()=>{
 for(const baseUrl of ['https://example.com','http://evil.test:3900','http://127.0.0.1:3900/api','http://user@127.0.0.1:3900','http://127.0.0.1:3900/?x=1'])assert.throws(()=>new VoiceStudioClient({baseUrl}),/INVALID_VOICE_ORIGIN/);
});
test('stable discovery checks health and real voice_id; never treats startup as ready',async t=>{
 let starting=false;const server=http.createServer((req,res)=>{res.setHeader('content-type','application/json');if(req.url==='/health'){res.statusCode=starting?503:200;res.end(JSON.stringify({status:starting?'starting':'ok',version:'0.5.6'}));}else if(req.url==='/v1/models')res.end(JSON.stringify({data:[{id:'test-engine'}]}));else res.end(JSON.stringify({voices:[{voice_id:'v1',name:'Test',type:'preset',language:'vi'}],engines:[]}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const c=new VoiceStudioClient({baseUrl:'http://127.0.0.1:'+server.address().port});
 const status=await c.status();assert.equal(status.ready,true);assert.equal(status.voices[0].voice_id,'v1');starting=true;assert.equal((await c.status()).ready,false);
});
test('redirect/version mismatch fail closed and lost POST outcome stays UNKNOWN without retry',async()=>{
 let calls=0;const redirect=new VoiceStudioClient({fetchImpl:async()=>new Response('',{status:302,headers:{location:'http://evil.test'}})});await assert.rejects(redirect.status(),/VOICE_HTTP_302/);
 const mismatch=new VoiceStudioClient({fetchImpl:async()=>Response.json({status:'ok',version:'0.5.7'})});await assert.rejects(mismatch.status(),/VOICE_VERSION/);
 const c=new VoiceStudioClient({fetchImpl:async()=>{calls++;throw Error('socket lost');}});await assert.rejects(c.speech({engine:'engine',voiceId:'v1',text:'Chào'}),e=>e.code==='VOICE_OUTCOME_UNKNOWN');assert.equal(calls,1);assert.equal(c.quarantined,true);await assert.rejects(c.speech({engine:'engine',voiceId:'v1',text:'Chào'}),/VOICE_QUARANTINED/);assert.equal(calls,1);
});
test('speech uses explicit IDs and bounded WAV response, never accepts HTML',async()=>{
 let payload;const c=new VoiceStudioClient({fetchImpl:async(url,init)=>{payload=JSON.parse(init.body);return new Response('html',{headers:{'content-type':'text/html'}});}});
 await assert.rejects(c.speech({engine:'engine',voiceId:'v1',text:'Chào'}),/VOICE_AUDIO_TYPE/);assert.equal(payload.model,'engine');assert.equal(payload.voice,'v1');assert.equal(payload.response_format,'wav');
 const huge=new VoiceStudioClient({fetchImpl:async()=>new Response('',{headers:{'content-type':'audio/wav','content-length':String(21*1024**2)}})});await assert.rejects(huge.speech({engine:'e',voiceId:'v',text:'Chào'}),/VOICE_RESPONSE_SIZE/);
});
test('POST5xx means remote compute outcome unknown and quarantines further submissions',async()=>{
 const c=new VoiceStudioClient({fetchImpl:async()=>Response.json({detail:'ASR timeout may still run'},{status:504})});await assert.rejects(c.speech({engine:'e',voiceId:'v',text:'Chào'}),e=>e.code==='VOICE_OUTCOME_UNKNOWN');assert.equal(c.quarantined,true);
});
test('OpenAI aliases and ASR models are never presented as a real TTS engine; noncommercial default is guarded',async()=>{
 const c=new VoiceStudioClient({fetchImpl:async url=>url.endsWith('/health')?Response.json({status:'ok',version:'0.5.6'}):url.endsWith('/v1/models')?Response.json({data:[{id:'tts-1',voicestudio:{kind:'tts',alias_for_active_engine:true}},{id:'faster-whisper',voicestudio:{kind:'stt',alias_for_active_engine:false}},{id:'kitten',voicestudio:{kind:'tts',alias_for_active_engine:false}}]}):url.endsWith('/engines')?Response.json({asr:{active:'faster-whisper',active_model:'Systran/faster-whisper-small'},tts:{backends:[]}}):Response.json({voices:[],engines:[]})});
 const s=await c.status();assert.deepEqual(s.models.filter(m=>m.kind==='tts'&&!m.alias).map(m=>m.id),['kitten']);assert.equal(s.asr.active,'faster-whisper');await assert.rejects(c.speech({engine:'omnivoice',voiceId:'demo0001',text:'Chào'}),/VOICE_NONCOMMERCIAL/);
});
test('opening the companion shows its window and restores caller preload settings',async()=>{
 const {execFileSync}=await import('node:child_process');const {fileURLToPath}=await import('node:url');const file=fileURLToPath(new URL('../scripts/start-voicestudio.ps1',import.meta.url)).replaceAll("'","''");
 const ps=`$ErrorActionPreference='Stop';$env:OMNIVOICE_PRELOAD_CAPTURE_ASR='caller';$env:OMNIVOICE_PRELOAD_WATERMARK='caller';$env:OMNIVOICE_PRELOAD_TTS_ASR='caller';$env:OMNIVOICE_BACKEND_CMD='caller-command';function Test-Path { param($LiteralPath) return $true };function Get-Content { param($LiteralPath,[switch]$Raw) return '{"root":"C:/VoiceStudio-fixture"}' };function Start-Process { param($FilePath,$WindowStyle) if($WindowStyle -ne 'Normal'){throw 'COMPANION_WINDOW_HIDDEN'};$argv=ConvertFrom-Json $env:OMNIVOICE_BACKEND_CMD;if($argv.Count -ne 5 -or $argv[1] -ne '-X' -or $argv[2] -ne 'utf8' -or $argv[3] -notlike '*voicestudio_bootstrap.py' -or $argv[4] -notlike '*VoiceStudio*project'){throw 'BACKEND_OVERRIDE_INVALID'};foreach($n in @('OMNIVOICE_PRELOAD_CAPTURE_ASR','OMNIVOICE_PRELOAD_WATERMARK','OMNIVOICE_PRELOAD_TTS_ASR')){if([Environment]::GetEnvironmentVariable($n,'Process') -ne '0'){throw 'PRELOAD_NOT_SCOPED'}} }; & '${file}';foreach($n in @('OMNIVOICE_PRELOAD_CAPTURE_ASR','OMNIVOICE_PRELOAD_WATERMARK','OMNIVOICE_PRELOAD_TTS_ASR')){if([Environment]::GetEnvironmentVariable($n,'Process') -ne 'caller'){throw 'CALLER_ENV_CHANGED'}};if($env:OMNIVOICE_BACKEND_CMD -ne 'caller-command'){throw 'CALLER_COMMAND_CHANGED'};'WINDOW_AND_ENV_OK'`;
 assert.match(execFileSync('C:/Program Files/PowerShell/7/pwsh.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(ps,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true}),/WINDOW_AND_ENV_OK/);
});
