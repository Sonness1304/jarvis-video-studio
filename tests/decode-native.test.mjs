import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import * as processes from '../src/process.mjs';
const strictDecodeArgs=processes.strictDecodeArgs??(file=>['-v','error','-i',file,'-map','0:v:0','-map','0:a:0','-f','null','-']);
test('native corrupt H264 packet with valid stream metadata cannot pass strict AV decode',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));const c=JSON.parse(fs.readFileSync(path.join(root,'runtime-config.json'))),ffmpeg=path.join(root,c.paths.ffmpeg),ffprobe=path.join(root,c.paths.ffprobe);
 const make=spawnSync(ffmpeg,['-v','error','-f','lavfi','-i','color=c=blue:s=64x64:r=30','-f','lavfi','-i','sine=frequency=400:sample_rate=48000','-t','2','-c:v','libx264','-c:a','aac','-movflags','frag_keyframe+empty_moov','-f','mp4','pipe:1'],{windowsHide:true,maxBuffer:2*1024*1024});assert.equal(make.status,0,make.stderr?.toString());
 const probe=spawnSync(ffprobe,['-v','error','-select_streams','v:0','-show_packets','-show_entries','packet=pos,size','-of','json','pipe:0'],{input:make.stdout,windowsHide:true,maxBuffer:2*1024*1024});assert.equal(probe.status,0);const packet=JSON.parse(probe.stdout).packets[30];const bad=Buffer.from(make.stdout);bad.writeUInt32BE(0,Number(packet.pos));
 const good=spawnSync(ffmpeg,strictDecodeArgs('pipe:0'),{input:make.stdout,windowsHide:true});assert.equal(good.status,0,good.stderr?.toString());
 const failed=spawnSync(ffmpeg,strictDecodeArgs('pipe:0'),{input:bad,windowsHide:true});assert.notEqual(failed.status,0,'corrupt bitstream incorrectly passed');assert.match(failed.stderr.toString(),/NAL|Error|Invalid/);
});
