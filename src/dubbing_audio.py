import sys,json
from pathlib import Path
import numpy as np
from audio import read_pcm,write_pcm
from voice_clone import contained

def slot_mix(tracks,duration,sr):
 if not np.isfinite(duration) or not 0<duration<=600:raise ValueError('DUB_DURATION')
 out=np.zeros(round(duration*sr),dtype=np.float32);previous=0
 for t in tracks:
  start=t['start'];end=t['end'];a=t['samples']
  if not np.isfinite(start) or not np.isfinite(end) or start<previous or end<=start or end>duration or len(a)>round((end-start)*sr)+1 or not np.isfinite(a).all():raise ValueError('DUB_SLOT_INVALID')
  offset=round(start*sr)
  if offset+len(a)>len(out):raise ValueError('DUB_OVERFLOW')
  out[offset:offset+len(a)]+=a;previous=end
 return out

if __name__=='__main__':
 root=Path(__file__).resolve().parents[1];request=json.loads(contained(root,sys.argv[1]).read_text(encoding='utf-8'));tracks=[]
 for t in request['tracks']:
  a,sr=read_pcm(contained(root,t['file']))
  if sr!=48000:raise ValueError('DUB_PCM_RATE')
  tracks.append({**t,'samples':a})
 write_pcm(contained(root,request['output']),slot_mix(tracks,request['duration'],48000),48000)
