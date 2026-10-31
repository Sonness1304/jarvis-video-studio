import {fileURLToPath} from 'node:url';import {catalog,readVoices,newBrief,writeNewBrief} from './studio.mjs';
import {previewVoice} from './voice-preview.mjs';
import {inspectStorage} from './storage.mjs';
import {exportBundle,verifyBundle,restoreBundle} from './project-bundle.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
async function main(){
 const [command,...args]=process.argv.slice(2);
 if(command==='catalog'&&!args.length)return catalog;
 if(command==='storage'&&!args.length)return inspectStorage(root);
 if(command==='bundle-verify'&&args.length===1)return verifyBundle(root,args[0]);
 if(command==='bundle-restore'&&args.length===1)return restoreBundle(root,args[0]);
   if(command==='voices'&&!args.length)return {status:'VERIFIED',audioUserApproval:'UNVERIFIED',voices:await readVoices(root)};
 if(command==='new'&&args.length===5){const [template,theme,voice,id,output]=args;return writeNewBrief(root,output,newBrief({template,theme,voice,id},await readVoices(root)));}
 if(command==='voice-preview'&&args.length===1)return previewVoice(root,args[0]);
 throw Error('USAGE: catalog | voices | storage | new TEMPLATE THEME VOICE ID OUTPUT_JSON | voice-preview VOICE');
}
main().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.log(JSON.stringify({status:'FAILED',error:e.message}));process.exitCode=1;});
