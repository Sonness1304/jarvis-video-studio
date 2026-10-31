export function clipRequest(v){
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['imageId','prompt'].includes(k))||!/^jarvis-[a-f0-9-]{36}$/.test(v.imageId??'')||typeof v.prompt!=='string'||!v.prompt.trim()||v.prompt.length>3000||/[\x00-\x1f\x7f]/.test(v.prompt))throw Error('INVALID_CLIP_REQUEST');
 return {imageId:v.imageId,prompt:v.prompt.trim()};
}
