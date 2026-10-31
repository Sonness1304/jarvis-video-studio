import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash,randomUUID} from 'node:crypto';import {spawnSync} from 'node:child_process';
import {childEnvironment} from '../src/process.mjs';
test('native TTS regenerates a corrupt own cache WAV instead of repeating the parse failure',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),c=JSON.parse(fs.readFileSync(path.join(root,'runtime-config.json')));
 const key=createHash('sha256').update(randomUUID()).digest('hex'),dir=path.join(root,'.cache/audio');fs.mkdirSync(dir,{recursive:true});const wav=path.join(dir,key+'.wav'),bad=Buffer.from('not a valid WAV');fs.writeFileSync(wav,bad);fs.writeFileSync(path.join(dir,key+'.json'),JSON.stringify({cacheKey:key,samples:1,sampleRate:48000,sha256:createHash('sha256').update(bad).digest('hex')}));
 const request='.runtime/cache-native-'+key+'.json',result='.runtime/cache-native-'+key+'-result.json';fs.writeFileSync(path.join(root,request),JSON.stringify({voice:'Hải Đăng',phrases:[{id:'native-cache',text:'Xin chào bạn.',cacheKey:key}],resultFile:result}));
 const run=spawnSync(path.join(root,c.paths.python),['src/tts.py','synthesize',request],{cwd:root,env:childEnvironment(root,c),windowsHide:true,encoding:'utf8',timeout:60000});assert.equal(run.status,0,run.stderr);
 const m=JSON.parse(fs.readFileSync(path.join(root,result)));assert.equal(m.generated,1);assert.ok(m.audio['native-cache'].samples>4800);assert.equal(createHash('sha256').update(fs.readFileSync(wav)).digest('hex'),m.audio['native-cache'].sha256);
});
