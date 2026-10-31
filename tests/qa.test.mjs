import test from 'node:test';import assert from 'node:assert/strict';
import {verifyQaIdentity,frameSelectExpression} from '../src/qa.mjs';
import {spawnSync} from 'node:child_process';import fs from 'node:fs';
test('QA refuses a replaced or failed export instead of reusing its old VERIFIED receipt',()=>{
 const receipt={status:'VERIFIED',artifacts:{video:{sha256:'a',bytes:10}}};assert.equal(verifyQaIdentity(receipt,'a',10),true);
 for(const [r,h,size] of [[receipt,'b',10],[receipt,'a',9],[{...receipt,status:'FAILED'},'a',10]])assert.throws(()=>verifyQaIdentity(r,h,size));
});
test('frame selection refuses invalid frame numbers before calling FFmpeg',()=>{
 for(const value of [[],[-1],[NaN],['2'],[1.5]])assert.throws(()=>frameSelectExpression(value),/INVALID_QA_FRAMES/);
 assert.equal(frameSelectExpression([0]),'eq(n\\,0)');
});
test('long video QA selects the correct frames without FFmpeg parser-depth failure',{skip:!fs.existsSync('.tools/ffmpeg/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe')},()=>{
 const frames=Array.from({length:162},(_,i)=>i*7),r=spawnSync('.tools/ffmpeg/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe',['-nostdin','-v','error','-f','lavfi','-i','color=c=black:s=16x16:r=30:d=0.8','-vf','select='+frameSelectExpression(frames),'-fps_mode','vfr','-f','framemd5','-'],{encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:65536});
 assert.equal(r.status,0,r.stderr);const selected=r.stdout.split('\n').filter(line=>/^0,/.test(line)).map(line=>Number(line.split(',')[2]));assert.deepEqual(selected,[0,7,14,21]);
});
