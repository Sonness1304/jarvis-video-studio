import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
export const normalizedRoot=value=>value.replace(/^\\\\\?\\UNC\\/i,'//').replace(/^\\\\\?\\/,'').replaceAll('\\','/').toLowerCase().normalize('NFC').replace(/\/+$/,'').replace(/^([a-z]:)$/,'$1/');
export function rootIdentity(root){const realRoot=fs.realpathSync.native(root),normalized=normalizedRoot(realRoot);return {realRoot,rootHash:createHash('sha256').update(normalized,'utf8').digest('hex')};}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [flag,root,...extra]=process.argv.slice(2);if(flag!=='--root'||!root||extra.length)throw Error('USAGE --root ROOT');console.log(JSON.stringify(rootIdentity(root)));}catch{console.log(JSON.stringify({status:'FAILED',error:'DESKTOP_ROOT_INVALID'}));process.exitCode=1;}
}
