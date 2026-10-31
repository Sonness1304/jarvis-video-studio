import fs from 'node:fs/promises';import {createReadStream,existsSync} from 'node:fs';import {createHash} from 'node:crypto';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';
import {safeChild} from './core.mjs';import {childEnvironment} from './process.mjs';
export const hashFile=async file=>{const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');};
const normalize=s=>s.toLowerCase().replace(/[_.]+/g,'-');
export function validateInstalledRuntime(lock,python,installed){
 if(installed?.python!==python||!installed.dependencies)throw Error('INSTALLED_PYTHON_CHANGED');
 const actual=Object.fromEntries(Object.entries(installed.dependencies).map(([n,v])=>[normalize(n),v]));
 for(const line of lock.trim().split(/\r?\n/)){const m=/^([a-zA-Z0-9._-]+)==([^\s]+)$/.exec(line);if(!m)throw Error('INVALID_PYTHON_LOCK');if(actual[normalize(m[1])]!==m[2])throw Error('INSTALLED_PACKAGE_CHANGED_'+normalize(m[1]));}
 return true;
}
export function validateModelRef(actual,expected){if(!/^[a-f0-9]{40}$/.test(actual)||actual!==expected)throw Error('OFFLINE_MODEL_REF_CHANGED');return true;}
export async function preflight(root){
 const config=JSON.parse(await fs.readFile(path.join(root,'runtime-config.json'),'utf8'));
 for(const [key,file] of Object.entries(config.paths)){const target=key==='chrome'?file:safeChild(root,file);if(!existsSync(target)||await hashFile(target)!==config.hashes[key])throw Error('RUNTIME_CHANGED_'+key);}
 if(process.version!==config.versions.node||os.release()!==config.versions.os)throw Error('NODE_OR_OS_VERSION_CHANGED');
 if(os.freemem()<2*1024**3)throw Error('INSUFFICIENT_AVAILABLE_RAM');
 const code="import sys,json,importlib.metadata as m; print(json.dumps({'python':sys.version.split()[0],'dependencies':{d.metadata['Name']:d.version for d in m.distributions()}}))";
 const installed=JSON.parse(execFileSync(path.join(root,config.paths.python),['-I','-c',code],{cwd:root,env:childEnvironment(root,config),windowsHide:true,encoding:'utf8',maxBuffer:256*1024}));
 validateInstalledRuntime(await fs.readFile(path.join(root,'requirements-cpu.lock'),'utf8'),config.versions.python,installed);
 const models=JSON.parse(await fs.readFile(path.join(root,'model-provenance.json'),'utf8'));
 for(const m of models){const repo='.cache/huggingface/hub/models--'+m.repo.replaceAll('/','--');validateModelRef((await fs.readFile(safeChild(root,repo+'/refs/main'),'utf8')).trim(),m.revision);if(await hashFile(safeChild(root,repo+'/snapshots/'+m.revision+'/'+m.path))!==m.sha256)throw Error('MODEL_CHANGED');}
 const fingerprint=createHash('sha256').update(JSON.stringify({hashes:config.hashes,installed,models,versions:config.versions})).digest('hex');
 return {config,models,installed,fingerprint};
}
