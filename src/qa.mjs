import fs from 'node:fs/promises';import path from 'node:path';import {createHash,randomUUID} from 'node:crypto';import {execFileSync} from 'node:child_process';import sharp from 'sharp';
import {safeChild,validateExport,qaFrames} from './core.mjs';import {runProcess,childEnvironment,strictDecodeArgs} from './process.mjs';
import {seekCases} from './qa-seek.mjs';
import {visualCrop} from './formats.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function frameSelectExpression(frames){
 if(!Array.isArray(frames)||!frames.length||frames.some(n=>!Number.isSafeInteger(n)||n<0))throw Error('INVALID_QA_FRAMES');
 // A flat sum exceeds FFmpeg's expression parser depth on longer videos.
 let terms=frames.map(n=>'eq(n\\,'+n+')');
 while(terms.length>1){const next=[];for(let i=0;i<terms.length;i+=2)next.push(i+1<terms.length?'('+terms[i]+'+'+terms[i+1]+')':terms[i]);terms=next;}
 return terms[0];
}
export function verifyQaIdentity(receipt,hash,bytes){if(receipt?.status!=='VERIFIED'||receipt.artifacts?.video?.sha256!==hash||receipt.artifacts.video.bytes!==bytes)throw Error('EXPORT_CHANGED_OR_NOT_VERIFIED');return true;}
export async function qaExport(root,relative,{config}){
 if(!relative.startsWith('outputs/'))throw Error('QA_OUTSIDE_OUTPUTS');const out=safeChild(root,relative),video=path.join(out,'video.mp4');
 const original=JSON.parse(await fs.readFile(path.join(out,'receipt.json'),'utf8')),timeline=JSON.parse(await fs.readFile(path.join(out,'timeline.json'),'utf8'));
 const videoData=await fs.readFile(video),videoHash=sha(videoData);verifyQaIdentity(original,videoHash,videoData.length);
 const qa=path.join(out,'qa-'+randomUUID().slice(0,8));await fs.mkdir(qa);const env=childEnvironment(root,config),ffmpeg=path.join(root,config.paths.ffmpeg);
 const metadata=JSON.parse(execFileSync(path.join(root,config.paths.ffprobe),['-v','error','-show_streams','-show_format','-of','json',video],{env,encoding:'utf8',windowsHide:true}));validateExport(metadata,timeline.duration,timeline);
 const run=async(label,exe,args)=>runProcess(exe,args,{cwd:root,env,log:path.join(qa,label+'.log')});
 await run('decode',ffmpeg,strictDecodeArgs(video));
 const frames=qaFrames(timeline);await run('frames',ffmpeg,['-v','error','-i',video,'-vf','select='+frameSelectExpression(frames),'-fps_mode','vfr',path.join(qa,'frame-%04d.png')]);
 const images=(await fs.readdir(qa)).filter(n=>/^frame-\d+\.png$/.test(n)).sort();if(images.length!==frames.length)throw Error('QA_FRAME_COUNT_MISMATCH');
 const pages=[];for(let page=0;page<Math.ceil(frames.length/12);page++){
  const entries=[];const count=Math.min(12,frames.length-page*12);const rows=Math.ceil(count/3);
  for(let j=0;j<count;j++){
   const index=page*12+j,x=(j%3)*240,y=Math.floor(j/3)*454;
   entries.push({input:await sharp(path.join(qa,images[index])).resize(240,427,{fit:'contain',background:'#192E52'}).png().toBuffer(),left:x,top:y});
   const label=Buffer.from(`<svg width="240" height="27"><rect width="240" height="27" fill="#192E52"/><text x="9" y="19" font-size="13" font-family="Segoe UI" fill="white">Frame ${frames[index]} / ${(frames[index]/30).toFixed(3)}s</text></svg>`);
   entries.push({input:label,left:x,top:y+427});
  }
  const file=path.join(qa,'contact-'+(page+1)+'.png');await sharp({create:{width:720,height:rows*454,channels:4,background:'#192E52'}}).composite(entries).png().toFile(file);pages.push(path.relative(root,file).replaceAll('\\','/'));
 }
 const cases=seekCases(timeline),times=cases.flatMap(c=>c.times);
 await run('seek',process.execPath,[path.join(root,config.paths.renderer),'snapshot',out,'--at',times.join(','),'--no-end','--no-browser-gpu','--describe','false','--output',path.join(qa,'seek')]);
 const seeks=(await fs.readdir(path.join(qa,'seek'))).filter(n=>/^frame-\d+.*\.png$/.test(n)).sort();
 if(seeks.length!==times.length)throw Error('SEEK_COVERAGE_MISMATCH');
 for(const [i,c] of cases.entries()){
  const buffers=await Promise.all([0,1,2].map(j=>sharp(path.join(qa,'seek',seeks[i*3+j])).raw().toBuffer()));
  if(!buffers[0].equals(buffers[2]))throw Error('SEEK_NONDETERMINISTIC_'+c.sceneId);
  const crops=await Promise.all([0,1].map(j=>sharp(path.join(qa,'seek',seeks[i*3+j])).extract(visualCrop(timeline)).raw().toBuffer()));
  if(c.motionExpected&&crops[0].equals(crops[1]))throw Error('VISUAL_NOT_MOVING_'+c.sceneId);
  c.pixelIdentity='VERIFIED';c.visualPixelsChanged=c.motionExpected?'VERIFIED':'NOT_REQUIRED_STILL_IMAGE';
 }
 await run('loudness',ffmpeg,['-v','info','-i',video,'-af','loudnorm=I=-16:TP=-1:LRA=11:print_format=json','-f','null','-']);
 const loudLog=await fs.readFile(path.join(qa,'loudness.log'),'utf8'),block=/\{\s*"input_i"[\s\S]*?\}/.exec(loudLog);const loudness=block?JSON.parse(block[0]):null;
 const result={schemaVersion:1,status:'VERIFIED',exportHash:videoHash,source:original.source,qaSource:{head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim()},frames,frameCount:frames.length,totalFrames:timeline.frames,pages,seek:{cases,pixelIdentity:'VERIFIED',tolerancePixels:0,browser:config.versions.chrome,renderBackend:'software'},loudness,loudnessGate:'MEASURED_ONLY',audioPlayback:'UNVERIFIED',userAestheticApproval:'UNVERIFIED',limitations:'Frame samples are partial visual coverage; decode and loudness do not prove pronunciation. Native browser seek identity is environment-specific.'};
 await fs.writeFile(path.join(qa,'qa.json'),JSON.stringify(result,null,2));return {...result,qaPath:path.relative(root,qa).replaceAll('\\','/')};
}
