import {searchRecords} from './model.mjs';
export function assetReferences(asset,draft){
 if(asset.copies){const refs=asset.copies.flatMap(a=>assetReferences(a,draft));return [...new Map(refs.map(r=>[r.kind+':'+(r.sceneId??''),r])).values()];}
 const same=m=>m?.path===asset.path&&m?.sha256===asset.sha256;
 const refs=(draft?.scenes??[]).flatMap((s,index)=>s.visual==='media'&&same(s.media)?[{kind:'scene',sceneId:s.id,index,title:s.title??'Cảnh '+(index+1)}]:[]);
 if(asset.kind==='music'&&draft?.music?.assetId===asset.id&&same(draft.music))refs.push({kind:'music'});
 return refs;
}
const size=a=>Number.isSafeInteger(a.bytes)&&a.bytes>=0?a.bytes:0;
const timestamp=a=>Number.isFinite(Date.parse(a.createdAt))?Date.parse(a.createdAt):0;
export function filterAssets(assets,{query='',kind='all',usage='all',sort='newest',draft}={}){
 return searchRecords(assets,query).filter(a=>(kind==='all'||a.kind===kind)&&(usage==='all'||(assetReferences(a,draft).length>0)===(usage==='current'))).sort((a,b)=>
  (sort==='size'?size(b)-size(a):sort==='name'?String(a.name).localeCompare(String(b.name),'vi'):timestamp(b)-timestamp(a))||a.id.localeCompare(b.id));
}
export function assetTotals(assets){return {count:assets.length,bytes:assets.reduce((n,a)=>n+size(a),0)};}
export function assetUrl(asset,part='file'){
 if(asset?.origin==='ai'){if(!/^jarvis-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(asset.id))throw Error('INVALID_ASSET_ID');if(part!=='file')throw Error('INVALID_ASSET_KIND');return '/api/images/'+asset.id;}
 if(!/^asset-[a-z0-9-]{1,48}$/.test(asset?.id??''))throw Error('INVALID_ASSET_ID');
 if(!['file','poster'].includes(part))throw Error('INVALID_ASSET_KIND');return '/api/assets/'+asset.id+'/'+part;
}
export function catalogPage(assets,{page=1,pageSize=24,group='',tag='',origin='all',dedupe=true,...filters}={}){
 const filtered=filterAssets(assets,filters).filter(a=>(!group||a.group===group)&&(!tag||(a.tags??[]).some(t=>t.toLocaleLowerCase('vi')===tag.toLocaleLowerCase('vi')))&&(origin==='all'||a.origin===origin));
 const groups=new Map();for(const a of filtered){const key=dedupe&&/^[a-f0-9]{64}$/.test(a.sha256??'')?a.kind+':'+a.sha256:a.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a);}
 const all=[...groups.values()].map(copies=>{copies.sort((a,b)=>timestamp(b)-timestamp(a)||a.id.localeCompare(b.id));return {...copies[0],copies};}),total=all.length,pages=Math.max(1,Math.ceil(total/pageSize)),current=Math.max(1,Math.min(pages,Number.isSafeInteger(page)?page:1));
 return {items:all.slice((current-1)*pageSize,current*pageSize),total,pages,page:current,fileCount:filtered.length};
}
