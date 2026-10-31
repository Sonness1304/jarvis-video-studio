import fs from 'node:fs';import {safeChild} from './core.mjs';
export function desktopLaunchLog(root,relative,value){
 if(typeof relative!=='string'||!/^\.runtime\/studio\/launcher\/desktop-[a-f0-9-]{36}\.log$/.test(relative)||!value||Object.keys(value).some(k=>!['status','url','mediaApiRequests','error'].includes(k))||!['READY','FAILED'].includes(value.status))throw Error('INVALID_DESKTOP_LOG');
 const text=JSON.stringify(value);if(Buffer.byteLength(text)>1024)throw Error('DESKTOP_LOG_TOO_LARGE');fs.writeFileSync(safeChild(root,relative),text+'\n',{flag:'wx'});
}
