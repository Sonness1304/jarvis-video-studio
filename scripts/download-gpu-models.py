"""Download only manifest-pinned public weights; keep partial attempts, verify before rename."""
import json,hashlib,time,sys,os,stat
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[1]
def digest(file):
 h=hashlib.sha256()
 with file.open('rb') as stream:
  for chunk in iter(lambda:stream.read(8*1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def scoped_model(root,target):
 target.absolute().relative_to(root.absolute());target.resolve().relative_to(root.resolve())
 for p in [target,*target.parents]:
  if p==root.parent:break
  if p.is_symlink() or p.is_junction():raise ValueError('SYMLINK_MODEL_PATH')
 if target.exists() and not stat.S_ISREG(target.lstat().st_mode):raise ValueError('MODEL_PATH_NOT_REGULAR')
 return target
def open_partial(root,part,offset):
 scoped_model(root,part);identity=part.stat() if part.exists() else None
 flags=os.O_WRONLY|os.O_CREAT|(os.O_APPEND if offset else os.O_EXCL)|getattr(os,'O_BINARY',0)|getattr(os,'O_NOFOLLOW',0)
 fd=os.open(part,flags)
 try:
  opened=os.fstat(fd);scoped_model(root,part)
  if not stat.S_ISREG(opened.st_mode) or opened.st_size!=offset or (identity and (opened.st_dev,opened.st_ino)!=(identity.st_dev,identity.st_ino)):raise ValueError('PARTIAL_IDENTITY_CHANGED')
  return os.fdopen(fd,'ab' if offset else 'wb')
 except:os.close(fd);raise
def download_ranges(session,url,root,part,total,chunk_bytes=64*1024*1024,max_seconds=1800):
 if not 0<chunk_bytes<=64*1024*1024:raise ValueError('INVALID_DOWNLOAD_RANGE')
 started=time.monotonic();scoped_model(root,part);offset=part.stat().st_size if part.exists() else 0
 while offset<total:
  if time.monotonic()-started>max_seconds:raise ValueError('MODEL_DOWNLOAD_DEADLINE')
  end=min(total-1,offset+chunk_bytes-1)
  with session.get(url,headers={'Range':f'bytes={offset}-{end}'},stream=True,timeout=(30,60)) as r:
   if r.status_code!=206:raise ValueError('MODEL_HTTP_'+str(r.status_code))
   if r.headers.get('Content-Range')!=f'bytes {offset}-{end}/{total}':raise ValueError('MODEL_RANGE_MISMATCH')
   with open_partial(root,part,offset) as f:
    for chunk in r.iter_content(1024*1024):
     if time.monotonic()-started>max_seconds:raise ValueError('MODEL_DOWNLOAD_DEADLINE')
     offset+=len(chunk)
     if offset>end+1:raise ValueError('MODEL_RANGE_OVERSIZE')
     f.write(chunk)
   if offset!=end+1:raise ValueError('MODEL_RANGE_TRUNCATED')
def main():
 manifest=json.loads((ROOT/'gpu-provenance.json').read_text(encoding='utf8'))
 if len(sys.argv) not in (2,3) or sys.argv[1] not in {m['id'] for m in manifest['models']} or (len(sys.argv)==3 and sys.argv[2] not in ['8','64']):raise ValueError('USAGE download-gpu-models.py MODEL_ID [8|64 range MiB]')
 range_bytes=int(sys.argv[2] if len(sys.argv)==3 else '64')*1024*1024
 m=next(m for m in manifest['models'] if m['id']==sys.argv[1])
 target=scoped_model(ROOT,ROOT/m['target'])
 if target.exists():
  if target.stat().st_size!=m['bytes'] or digest(target)!=m['sha256']:raise ValueError('EXISTING_MODEL_CHANGED')
  return {'status':'VERIFIED','downloadedBytes':0,'model':m['id'],'sha256':m['sha256']}
 target.parent.mkdir(parents=True,exist_ok=True);part=scoped_model(ROOT,target.with_suffix(target.suffix+'.part'))
 offset=part.stat().st_size if part.exists() else 0
 if offset>m['bytes']:raise ValueError('PARTIAL_OVERSIZE')
 session=requests.Session();session.trust_env=False
 started=time.monotonic()
 if offset<m['bytes']:
  url='https://huggingface.co/'+m['repo']+'/resolve/'+m['revision']+'/'+m['path']+'?download=true'
  download_ranges(session,url,ROOT,part,m['bytes'],chunk_bytes=range_bytes)
 if part.stat().st_size!=m['bytes'] or digest(part)!=m['sha256']:raise ValueError('MODEL_HASH_MISMATCH')
 if target.exists():raise ValueError('MODEL_TARGET_CREATED_DURING_DOWNLOAD')
 part.rename(target)
 return {'status':'VERIFIED','model':m['id'],'bytes':m['bytes'],'sha256':m['sha256'],'elapsedSeconds':time.monotonic()-started}
if __name__=='__main__':
 try:print(json.dumps(main()))
 except Exception as e:print(json.dumps({'status':'FAILED','error':type(e).__name__+': '+str(e)}));sys.exit(1)
