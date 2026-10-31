import {desktopLaunchLog} from './desktop-log.mjs';
import {voiceRoutes} from './voice-routes.mjs';
import {dubbingRoutes} from './dubbing-routes.mjs';
import {listMediaCatalog,readCatalogItem,MediaLabels} from './media-catalog.mjs';
import {rootIdentity} from './desktop-identity.mjs';
import {DesktopLifecycle,studioActivity} from './desktop-lifecycle.mjs';
import {effectiveSpeechText} from '../web/captions.mjs';
import {BrandStore} from './brand-store.mjs';
import {aiStatus} from './ai-studio.mjs';import {imageRequest} from '../web/image-request.mjs';
import {clipRequest} from '../web/clip-request.mjs';import {resolveClipRequest,importVerifiedClip} from './ai-clips.mjs';
import http from 'node:http';import fs from 'node:fs/promises';import {createReadStream} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {randomBytes,randomUUID} from 'node:crypto';
import {safeChild,buildTimeline} from './core.mjs';import {catalog,newBrief,readVoices,canonicalVoice} from './studio.mjs';import {ProjectStore,canonicalBrief,briefHash,readLimited} from './editor-store.mjs';import {JobManager} from './editor-jobs.mjs';import {writeComposition} from './composition.mjs';import {hashFile} from './runtime.mjs';
import {previewBridge} from './editor-preview.mjs';
import {BatchQueue} from './batch-queue.mjs';import {importAsset,listAssets,readAsset,validateMusic} from './assets.mjs';import {readMedia} from './media.mjs';import {formats} from './formats.mjs';
import {ContentAttempts} from './content-attempts.mjs';
import {listContentMedia} from './content-media.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.ttf':'font/ttf','.png':'image/png','.wav':'audio/wav','.mp4':'video/mp4','.srt':'application/x-subrip','.json':'application/json'};
export function parseRange(value,size){const m=/^bytes=(\d*)-(\d*)$/.exec(value??'');if(!m||(!m[1]&&!m[2]))throw Error('INVALID_RANGE');let start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2])),end=m[1]?(m[2]?Number(m[2]):size-1):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||start>=size)throw Error('INVALID_RANGE');return {start,end:Math.min(end,size-1)};}
const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(value));};
async function body(req,max=131072){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))throw Error('JSON_REQUIRED');let n=0;const parts=[];for await(const chunk of req){n+=chunk.length;if(n>max)throw Error('BODY_TOO_LARGE');parts.push(chunk);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Error('INVALID_JSON');}}
const safeError=e=>String(e.message??'FAILED').replace(/[\r\n]/g,' ').slice(0,140);
export async function startEditor({root=ROOT,port=20130,voices,contentOptions,desktopOptions={}}={}){
 voices??=await readVoices(root);const brands=new BrandStore(root),store=new ProjectStore(root),jobs=new JobManager(root);await jobs.init();const batches=new BatchQueue(root,jobs);await batches.init();
 const content=new ContentAttempts(root,contentOptions);await content.init();
 const identity={appId:'jarvis-video-studio',rootHash:rootIdentity(root).rootHash,pid:process.pid,startedAt:new Date(Date.now()-process.uptime()*1000).toISOString()},lifecycle=new DesktopLifecycle({ownerNonce:desktopOptions.ownerNonce??process.env.JARVIS_DESKTOP_OWNER_NONCE,activity:()=>studioActivity({root,jobs,batches,content})});
 const voiceHandler=voiceRoutes({root,store,jobs}),dubbingHandler=dubbingRoutes({root,jobs});const sessions=new Map(),previews=new Map(),images=new Map();let url;
 async function sendFile(req,res,file,{download=false,hash,asset=false}={}){
  if(hash&&await hashFile(file)!==hash)throw Error('ARTIFACT_CHANGED');const st=await fs.stat(file);if(!st.isFile())throw Error('NOT_A_FILE');
  const headers={'content-type':mime[path.extname(file)]??'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff','accept-ranges':'bytes'};
  if(asset)headers['access-control-allow-origin']='*';if(download)headers['content-disposition']='attachment; filename="'+path.basename(file)+'"';
  if(req.headers.range){const r=parseRange(req.headers.range,st.size);res.writeHead(206,{...headers,'content-range':`bytes ${r.start}-${r.end}/${st.size}`,'content-length':r.end-r.start+1});createReadStream(file,r).on('error',()=>res.destroy()).pipe(res);}
  else{res.writeHead(200,{...headers,'content-length':st.size});createReadStream(file).on('error',()=>res.destroy()).pipe(res);}
 }
 const server=http.createServer(async(req,res)=>{let releaseMutation;try{
  if(req.headers.host!==new URL(url).host)throw Error('HOST_DENIED');
  const u=new URL(req.url,url),route=u.pathname;
  const cookie=/\bstudio_session=([a-f0-9]{48})\b/.exec(req.headers.cookie??'')?.[1];let session=sessions.get(cookie);
  if(route==='/'&&req.method==='GET'){
   if(!session){const id=randomBytes(24).toString('hex');session={csrf:randomBytes(24).toString('hex')};if(sessions.size>=32)sessions.delete(sessions.keys().next().value);sessions.set(id,session);res.setHeader('set-cookie',`studio_session=${id}; HttpOnly; SameSite=Strict; Path=/`);}
   return await sendFile(req,res,safeChild(root,'web/index.html'));
  }
  const previewMatch=/^\/preview\/([a-f0-9]{48})\/(index\.html|bridge\.js|assets\/[a-zA-Z0-9_.-]+)$/.exec(route);
  if(previewMatch&&req.method==='GET'){const p=previews.get(previewMatch[1]);if(!p||!p.files.has(previewMatch[2]))throw Error('PREVIEW_NOT_FOUND');return await sendFile(req,res,safeChild(root,p.relative+'/'+previewMatch[2]),{asset:true});}
  if(!session)return json(res,401,{error:'SESSION_REQUIRED'});
  if(req.headers.origin&&req.headers.origin!==url)throw Error('ORIGIN_DENIED');
  if(req.method==='POST'&&(req.headers.origin!==url||req.headers['x-studio-csrf']!==session.csrf))throw Error('CSRF_DENIED');
  if(req.method==='POST'&&route!=='/api/desktop/shutdown')releaseMutation=lifecycle.enterMutation();
  if(req.method==='POST'&&route==='/api/desktop/shutdown'){const input=await body(req,1024);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw Error('INVALID_DESKTOP_SHUTDOWN');await lifecycle.requestShutdown(req.headers['x-studio-desktop-owner']);res.once('finish',()=>{batches.close();server.close();server.closeIdleConnections();});return json(res,200,{status:'CLOSING'});}
  if(req.method==='GET'&&route==='/api/bootstrap')return json(res,200,{csrf:session.csrf,serverIdentity:identity,catalog,formats,voices,projects:await store.list(),jobs:await jobs.list()});
  if(await voiceHandler({req,res,route,body,json}))return;
  if(await dubbingHandler({req,res,route,body,json}))return;
  if(req.method==='GET'&&route==='/api/content-attempts')return json(res,200,await content.list(u.searchParams.get('projectId')));
  const contentRoute=/^\/api\/content-attempts\/(content-[a-f0-9-]{36})(\/reconcile)?$/.exec(route);
  if(req.method==='GET'&&contentRoute&&!contentRoute[2])return json(res,200,await content.read(contentRoute[1],u.searchParams.get('projectId')));
  if(req.method==='POST'&&contentRoute&&contentRoute[2]){const v=await body(req,32768);if(!v||Object.keys(v).some(k=>k!=='projectId'))throw Error('INVALID_CONTENT_REQUEST');return json(res,200,await content.reconcile(contentRoute[1],v.projectId));}
  if(req.method==='POST'&&route==='/api/content-attempts'){
   const v=await body(req,32768);if(!v||Object.keys(v).some(k=>!['projectId','expectedRevision','draftHash','contentBrief','sceneCount','model','fallbackFrom'].includes(k)))throw Error('INVALID_CONTENT_REQUEST');
   const p=await store.read(v.projectId);if(p.revision!==v.expectedRevision)throw Error('REVISION_CONFLICT');
   const {expectedRevision,...input}=v;return json(res,202,await content.start({...input,projectRevision:expectedRevision}));
  }
  if(req.method==='GET'&&route==='/api/content-media')return json(res,200,await listContentMedia(root));
  if(req.method==='POST'&&route==='/api/content-media/resolve'){const v=await body(req,4096);if(!v||Object.keys(v).some(k=>k!=='id'))throw Error('INVALID_CONTENT_MEDIA');const media=(await listContentMedia(root)).find(a=>a.id===v.id);if(!media)throw Error('CONTENT_MEDIA_NOT_FOUND');return json(res,200,media);}
  if(req.method==='GET'&&route==='/api/assets')return json(res,200,await listAssets(root));
  if(req.method==='GET'&&route==='/api/media-catalog')return json(res,200,await listMediaCatalog(root));
  if(req.method==='POST'&&route==='/api/media-labels'){
   const value=await body(req,4096);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_MEDIA_LABELS');const {id,...entry}=value;await readCatalogItem(root,id);return json(res,200,{id,...await new MediaLabels(root).save(id,entry)});
  }
  const assetRoute=/^\/api\/assets\/(asset-[a-z0-9-]{1,48})\/(file|poster)$/.exec(route);
  if(req.method==='GET'&&assetRoute){const a=await readAsset(root,assetRoute[1]),file=assetRoute[2]==='poster'?a.poster:{path:a.path,sha256:a.sha256};if(!file)throw Error('ASSET_NOT_FOUND');if(!file.path.startsWith('outputs/'+a.id+'/'))throw Error('ASSET_MANIFEST_INVALID');return await sendFile(req,res,safeChild(root,file.path),{hash:file.sha256});}
  if(req.method==='POST'&&['/api/assets/upload','/api/dubbing/upload'].includes(route)){
   if(req.headers['content-type']!=='application/octet-stream')throw Error('OCTET_STREAM_REQUIRED');if(Number(req.headers['content-length'])>(route==='/api/dubbing/upload'?512:64)*1024**2)throw Error('ASSET_TOO_LARGE');
   const metadata={name:decodeURIComponent(req.headers['x-asset-name']??''),rights:decodeURIComponent(req.headers['x-asset-rights']??'')};return json(res,201,await jobs.exclusive(()=>importAsset(root,req,metadata,{scope:route==='/api/dubbing/upload'?'dubbing':undefined})));
  }
  if(req.method==='GET'&&route==='/api/batches')return json(res,200,await batches.list());
  if(req.method==='POST'&&route==='/api/batches'){const v=await body(req),p=await store.read(v.projectId);if(p.revision!==v.expectedRevision)throw Error('REVISION_CONFLICT');return json(res,202,await batches.enqueue(p,v.variants));}
  const resume=/^\/api\/batches\/(batch-[a-f0-9-]{36})\/resume$/.exec(route);if(req.method==='POST'&&resume){await body(req);return json(res,200,await batches.resume(resume[1]));}
  if(req.method==='GET'&&route==='/api/jobs')return json(res,200,await jobs.list());
  if(req.method==='GET'&&route==='/api/ai/status')return json(res,200,await aiStatus(root));
  if(req.method==='GET'&&route==='/api/ai/clip-status')return json(res,200,await aiStatus(root,{kind:'clip'}));
  if(req.method==='GET'&&route==='/api/clips')return json(res,200,(await jobs.list()).filter(j=>j.kind==='clip'&&j.status==='VERIFIED'&&j.sealed?.receipt&&j.result?.clip).slice(0,200).map(j=>({id:j.id,source:j.clipRequest.source,prompt:j.clipRequest.prompt,clip:j.result.clip,url:'/api/artifacts/'+j.id+'/video',createdAt:j.createdAt})));
  const clipImport=/^\/api\/clips\/(job-[a-z0-9-]{1,48})\/import$/.exec(route);
  if(req.method==='POST'&&clipImport){if(Object.keys(await body(req)).length)throw Error('INVALID_CLIP_IMPORT');return json(res,200,await jobs.exclusive(async()=>{const job=jobs.records.get(clipImport[1]);if(!job)throw Error('CLIP_NOT_FOUND');const asset=await importVerifiedClip(root,job);await jobs.update(job.id,{clipAssetId:asset.id});return asset;}));}
  const acknowledge=/^\/api\/jobs\/(job-[a-z0-9-]{1,48})\/acknowledge-translation-unknown$/.exec(route);if(acknowledge&&req.method==='POST'){const value=await body(req);if(!value||Object.keys(value).some(k=>k!=='acknowledgeUnknown'))throw Error('DUB_REQUEST_INVALID');return json(res,200,await jobs.acknowledgeTranslationUnknown(acknowledge[1],value.acknowledgeUnknown));}
  const reconcile=/^\/api\/jobs\/(job-[a-z0-9-]{1,48})\/reconcile$/.exec(route);if(reconcile&&req.method==='POST'){await body(req);return json(res,200,await jobs.reconcile(reconcile[1]));}
  if(req.method==='GET'&&route==='/api/projects')return json(res,200,await store.list());
  if(req.method==='GET'&&route==='/api/briefs'){const names=(await fs.readdir(safeChild(root,'briefs')).catch(()=>[])).filter(n=>/^[a-z0-9_-]+\.json$/.test(n));return json(res,200,names);}
  if(req.method==='POST'&&route==='/api/projects'){const v=await body(req),b=newBrief(v,voices);if(v.title!==undefined)b.title=v.title;return json(res,201,await store.create(b));}
  if(route==='/api/brands'&&req.method==='GET')return json(res,200,await brands.list());
  if(route==='/api/brands'&&req.method==='POST')return json(res,201,await brands.create(await body(req)));
  if(req.method==='GET'&&route==='/api/images'){
   const found=[];for(const name of (await fs.readdir(safeChild(root,'outputs')).catch(()=>[])).filter(n=>/^jarvis-[a-f0-9-]+$/.test(n)).slice(-200)){try{
    const r=JSON.parse(await readLimited(safeChild(root,'outputs/'+name+'/receipt.json'))),image=r.image;if(r.status!=='VERIFIED'||image?.path!=='outputs/'+name+'/image.png'||!/^[a-f0-9]{64}$/.test(image.sha256??''))continue;
    images.set(name,image);found.push({id:name,media:{kind:'image',path:image.path,sha256:image.sha256},url:'/api/images/'+name,...(r.request?{request:r.request}:{}),createdAt:r.startedAtMs??null});
   }catch{}}
   return json(res,200,found);
  }
  const imageRoute=/^\/api\/images\/(jarvis-[a-f0-9-]+)$/.exec(route);
  if(imageRoute&&req.method==='GET'){const image=await readCatalogItem(root,imageRoute[1]);return await sendFile(req,res,safeChild(root,image.path),{hash:image.sha256});}
  if(req.method==='POST'&&route==='/api/import'){const v=await body(req);if(!/^[a-z0-9_-]+\.json$/.test(v.name??''))throw Error('INVALID_PATH');const b=canonicalBrief(JSON.parse(await readLimited(safeChild(root,'briefs/'+v.name))));b.id=v.id;return json(res,201,await store.create(b));}
  const project=/^\/api\/projects\/([a-z][a-z0-9_-]{0,47})$/.exec(route);
  if(project&&req.method==='GET')return json(res,200,await store.read(project[1]));
  if(project&&req.method==='POST'){const v=await body(req);v.brief.voice=canonicalVoice(v.brief.voice,voices);return json(res,200,await store.save(project[1],v.expectedRevision,v.brief));}
  if(req.method==='POST'&&route==='/api/jobs'){const v=await body(req);let data;
   if(v.kind==='export'){const p=await store.read(v.projectId);if(p.revision!==v.expectedRevision)throw Error('REVISION_CONFLICT');data={projectId:v.projectId,projectRevision:p.revision,brief:p.brief};}
   else if(v.kind==='voice')data={voice:canonicalVoice(v.voice,voices)};
   else if(v.kind==='image'){const request=imageRequest(v.request),p=await store.read(v.projectId);if(p.revision!==v.expectedRevision)throw Error('REVISION_CONFLICT');if(!p.brief.scenes.some(s=>s.id===v.sceneId))throw Error('INVALID_IMAGE_SCENE');data={imageRequest:request,projectId:p.brief.id,projectRevision:p.revision,sceneId:v.sceneId};}
   else if(v.kind==='clip'){const input=clipRequest(v.request),p=await store.read(v.projectId);if(p.revision!==v.expectedRevision)throw Error('REVISION_CONFLICT');if(!p.brief.scenes.some(s=>s.id===v.sceneId))throw Error('INVALID_CLIP_SCENE');data={clipRequest:await resolveClipRequest(root,input),projectId:p.brief.id,projectRevision:p.revision,sceneId:v.sceneId};}
   else throw Error('INVALID_JOB_KIND');
   return json(res,202,await jobs.start(v.kind,data));
  }
  if(req.method==='POST'&&route==='/api/preview'){
   const b=canonicalBrief((await body(req)).brief);b.voice=canonicalVoice(b.voice,voices);await readMedia(root,b);await validateMusic(root,b.music);
   const audio=Object.fromEntries(b.scenes.flatMap(s=>s.phrases.map(p=>[p.id,{samples:Math.round(Math.max(1.2,effectiveSpeechText(p).length/12)*48000),sampleRate:48000}])));
   const t=buildTimeline(b,audio),config=JSON.parse(await fs.readFile(safeChild(root,'runtime-config.json'),'utf8'));
   for(const key of ['fontRegular','fontBold','fontBlack','gsap'])if(await hashFile(safeChild(root,config.paths[key]))!==config.hashes[key])throw Error('PREVIEW_RUNTIME_CHANGED');
   const relative='outputs/draft-'+randomUUID(),out=safeChild(root,relative);await fs.mkdir(out);await writeComposition(out,t,config,root);
   let html=await fs.readFile(path.join(out,'index.html'),'utf8');html=html.replace(/<audio[^>]*>[\s\S]*?<\/audio>/g,'').replace('</body>','<script src="./bridge.js"></script></body>');await fs.writeFile(path.join(out,'index.html'),html);
   await fs.writeFile(path.join(out,'bridge.js'),previewBridge(url,t.duration,t));
   const cap=randomBytes(24).toString('hex'),files=new Set(['index.html','bridge.js',...(await fs.readdir(path.join(out,'assets'))).map(n=>'assets/'+n)]);if(previews.size>=12)previews.delete(previews.keys().next().value);previews.set(cap,{relative,files});return json(res,200,{url:'/preview/'+cap+'/index.html',timeline:t,estimated:true,briefHash:briefHash(b)});
  }
  const artifact=/^\/api\/artifacts\/(job-[a-z0-9-]{1,48})\/(video|audio|captions|timeline|receipt)$/.exec(route);
  if(artifact&&req.method==='GET'){
   const job=jobs.records.get(artifact[1]);if(job?.status!=='VERIFIED')throw Error('ARTIFACT_NOT_READY');const result=job.result;let relative,hash;
   if(artifact[2]==='video'){const video=job.kind==='clip'&&job.sealed?.receipt?result.clip:result.artifacts?.video;relative=video?.path;hash=video?.sha256;}
   if(artifact[2]==='audio'){relative=result.audio?.path;hash=result.audio?.sha256;}
   if(['captions','timeline','receipt'].includes(artifact[2])){relative=job.sealed?.[artifact[2]]?.path;hash=job.sealed?.[artifact[2]]?.sha256;}
   if(!relative||!/^outputs\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(relative))throw Error('INVALID_ARTIFACT');
   if(!/^[a-f0-9]{64}$/.test(hash??''))throw Error('INVALID_ARTIFACT_HASH');
   return await sendFile(req,res,safeChild(root,relative),{hash,download:u.searchParams.get('download')==='1'});
  }
  if(req.method==='GET'&&['/dubbing-audition.mjs','/dubbing-audition-model.mjs','/voice-workbench.mjs','/voice-dubbing.mjs','/voice-model.mjs','/dubbing-model.mjs','/artcraft.mjs','/artcraft-model.mjs','/style-library-model.mjs','/style-library.mjs','/style-art.mjs','/editor.css','/editor.mjs','/model.mjs','/p3.mjs','/media-library.mjs','/media-library-model.mjs','/workspace.mjs','/p5.mjs','/p6.mjs','/clip-tools.mjs','/p7.mjs','/image-request.mjs','/p72.mjs','/clip-request.mjs','/p73.mjs','/image-motion.mjs','/p74.mjs','/motion-sequence.mjs','/p75.mjs','/content-model.mjs','/content-board.mjs','/content-recipes.mjs','/recipe-picker.mjs','/whiteboard-model.mjs','/whiteboard-editor.mjs','/captions.mjs','/p78.mjs','/caption-board.mjs','/desktop-bridge.mjs'].includes(route))return await sendFile(req,res,safeChild(root,'web'+route));
  if(req.method==='GET'&&route==='/font.ttf'){const config=JSON.parse(await fs.readFile(safeChild(root,'runtime-config.json'),'utf8'));return await sendFile(req,res,safeChild(root,config.paths.fontRegular),{hash:config.hashes.fontRegular});}
  return json(res,404,{error:'NOT_FOUND'});
 }catch(e){if(res.headersSent)return res.destroy();const code=safeError(e);json(res,['BODY_TOO_LARGE','ASSET_TOO_LARGE'].includes(code)?413:code==='INVALID_RANGE'?416:code==='REVISION_CONFLICT'||code==='PROJECT_EXISTS'||code.startsWith('JOB_')||['BATCH_BUSY','CONTENT_BUSY','CONTENT_CAP','DESKTOP_BUSY','DESKTOP_UNKNOWN','STUDIO_SHUTTING_DOWN'].includes(code)?409:/DENIED/.test(code)?403:e.code==='ENOENT'||/NOT_FOUND/.test(code)?404:400,{error:code});}finally{releaseMutation?.();}});
 server.requestTimeout=30000;server.headersTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});url='http://127.0.0.1:'+server.address().port;
 server.once('close',()=>batches.close());return {url,server,store,jobs,batches,content,lifecycle,close:()=>new Promise(resolve=>server.close(resolve))};
}
function reportStatus(value){if(process.env.JARVIS_DESKTOP_LOG_FILE)desktopLaunchLog(ROOT,process.env.JARVIS_DESKTOP_LOG_FILE,value);else console.log(JSON.stringify(value));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))startEditor().then(s=>reportStatus({status:'READY',url:s.url,mediaApiRequests:0})).catch(e=>{try{reportStatus({status:'FAILED',error:safeError(e)});}finally{process.exitCode=1;}});
