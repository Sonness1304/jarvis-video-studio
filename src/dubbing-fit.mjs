import fs from 'node:fs/promises';import {slotPlan} from '../web/dubbing-model.mjs';import {validatePcmWav} from './voice-workbench.mjs';
export async function fitAudioSlot({input,output,start,end,duration,approved,run}){
 const fit=slotPlan({start,end},duration);if(fit.speed!==1&&!approved)throw Error('DUB_FIT_APPROVAL_REQUIRED');
 for(let attempt=0;attempt<3;attempt++){
  await run('fit-'+attempt,['-i',input,'-af','atempo='+fit.speed,'-ar','48000','-ac','1','-c:a','pcm_s16le',output]);const actual=validatePcmWav(await fs.readFile(output)),target=Math.round(fit.slot*48000);
  if(actual.samples<=target+1)return {...fit,pad:Math.max(0,fit.slot-actual.samples/48000),samples:actual.samples};
  const speed=Math.min(1.1,fit.speed*actual.samples/Math.max(1,target-1200));if(!approved||speed<=fit.speed)throw Error('DUB_OVERFLOW');fit.speed=speed;await fs.unlink(output);
 }throw Error('DUB_OVERFLOW');
}
