import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import net from 'node:net';
import {safeChild} from './core.mjs';import {childEnvironment} from './process.mjs';import {gpuRuntime,gpuResources} from './gpu-runtime.mjs';import {assertResources,ComfyClient} from './gpu.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
async function main(){
 const p=await gpuRuntime(root);assertResources(await gpuResources(root));const url=new URL(new ComfyClient(p.backend.url).base);
 const port=Number(url.port);if(!port||port!==8188)throw Error('UNREVIEWED_COMFY_PORT');
 const probe=net.createServer();await new Promise((r,j)=>{probe.once('error',j);probe.listen(port,'127.0.0.1',r);});await new Promise(r=>probe.close(r));
 const env=childEnvironment(root,{paths:{}});delete env.HYPERFRAMES_BROWSER_PATH;
 const child=spawn(safeChild(root,'.venv-gpu/Scripts/python.exe'),['main.py','--listen','127.0.0.1','--port',String(port),'--disable-all-custom-nodes','--offline','--disable-auto-launch','--cache-none'],{cwd:safeChild(root,p.backend.path),env,shell:false,windowsHide:true,stdio:'inherit'});
 console.log(JSON.stringify({status:'STARTING',pid:child.pid,backend:p.backend}));
 process.once('SIGINT',()=>child.kill());process.once('SIGTERM',()=>child.kill());
 await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{if(code===0||signal==='SIGTERM')resolve();else reject(Error('COMFY_EXIT_'+code+'_'+signal));});});
}
main().catch(e=>{console.error(JSON.stringify({status:'FAILED',error:e.message}));process.exitCode=1;});
