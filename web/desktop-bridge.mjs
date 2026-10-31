const previous=new WeakMap();
export function publishDesktopDirty({draftDirty=false,contentDirty=false,captionDirty=false},postMessage){
 const dirty=!!(draftDirty||contentDirty||captionDirty);
 if(typeof postMessage==='function'&&previous.get(postMessage)!==dirty){postMessage({type:'studio-dirty',dirty});previous.set(postMessage,dirty);}return dirty;
}
export async function refreshDesktopBootstrap(fetcher){
 const root=await fetcher('/');if(!root.ok)throw Error('DESKTOP_RECONNECT_FAILED');
 const response=await fetcher('/api/bootstrap');if(!response.ok)throw Error('DESKTOP_RECONNECT_FAILED');
 const boot=await response.json();if(typeof boot.csrf!=='string'||boot.serverIdentity?.appId!=='jarvis-video-studio')throw Error('DESKTOP_RECONNECT_FAILED');return boot;
}
