import fs from 'node:fs/promises';import os from 'node:os';import {execFileSync} from 'node:child_process';
import {safeChild} from './core.mjs';import {validateInstalledRuntime} from './runtime.mjs';import {childEnvironment} from './process.mjs';
export async function gpuRuntime(root){
 const p=JSON.parse(await fs.readFile(safeChild(root,'gpu-provenance.json'),'utf8'));const env=childEnvironment(root,{paths:{}});
 const actual=execFileSync('git',['-C',p.backend.path,'rev-parse','HEAD'],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:10000}).trim();
 if(actual!==p.backend.revision||execFileSync('git',['-C',p.backend.path,'status','--porcelain','--untracked-files=no'],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:10000}).trim())throw Error('GPU_BACKEND_CHANGED');
 const installed=JSON.parse(execFileSync(safeChild(root,'.venv-gpu/Scripts/python.exe'),['-I','-c',"import sys,json,importlib.metadata as m; print(json.dumps({'python':sys.version.split()[0],'dependencies':{d.metadata['Name']:d.version for d in m.distributions()}}))"],{cwd:root,env,encoding:'utf8',windowsHide:true,maxBuffer:256*1024,timeout:10000}));
 validateInstalledRuntime(await fs.readFile(safeChild(root,'requirements-gpu.lock'),'utf8'),p.backend.python,installed);return p;
}
export async function gpuResources(root,budgetMs=5000){
 const vram=Number(execFileSync('nvidia-smi',['--query-gpu=memory.free','--format=csv,noheader,nounits'],{env:childEnvironment(root,{paths:{}}),windowsHide:true,encoding:'utf8',timeout:Math.max(1,Math.min(5000,budgetMs))}).trim().split(/\r?\n/)[0])*1024**2;
 const d=await fs.statfs(root);return {ram:os.freemem(),vram,disk:Number(d.bavail)*Number(d.bsize),at:new Date().toISOString()};
}
