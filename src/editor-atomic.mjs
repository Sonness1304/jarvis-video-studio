import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';import {safeChild} from './core.mjs';
// NTFS same-directory hardlink publish is exclusive and atomic: readers never see partial JSON.
export async function atomicJson(root,file,value){
 const target=safeChild(root,path.relative(root,file)),payload=JSON.stringify(value)+'\n';if(Buffer.byteLength(payload)>131072)throw Error('RECORD_TOO_LARGE');
 const pending=safeChild(root,path.relative(root,path.join(path.dirname(target),'.pending-'+randomUUID())));
 let handle=await fs.open(pending,'wx'),failure;
 try{await handle.writeFile(payload);await handle.sync();await handle.close();handle=null;await fs.link(pending,target);}
 catch(error){failure=error;}
 finally{
  try{await handle?.close();}catch(error){failure??=error;}
  try{await fs.unlink(pending);}catch(error){if(error.code!=='ENOENT')failure??=error;}
 }
 if(failure)throw failure;return value;
}
