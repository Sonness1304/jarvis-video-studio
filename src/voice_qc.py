import sys,json
from pathlib import Path
import numpy as np

def inspect_samples(a,sr):
 a=np.asarray(a,dtype=np.float32)
 if not a.size or not np.isfinite(a).all() or not isinstance(sr,int) or sr<=0:raise ValueError('VOICE_SAMPLES_INVALID')
 level=np.max(np.abs(a),axis=1) if a.ndim==2 else np.abs(a);active=np.flatnonzero(level>10**(-50/20));rms=float(np.sqrt(np.mean(a*a)));peak=float(np.max(level));clips=int(np.sum(level>=.999))
 leading=(int(active[0]) if len(active) else len(level))/sr;trailing=(len(level)-1-int(active[-1]) if len(active) else len(level))/sr
 return {'peak':peak,'rmsDbfs':round(20*np.log10(max(rms,1e-12)),3),'clippingSamples':clips,'leadingSilenceSeconds':leading,'trailingSilenceSeconds':trailing,'warnings':(['CLIPPING'] if clips>=3 else [])+(['SILENCE'] if not len(active) else [])+(['LONG_EDGE_SILENCE'] if leading>=1 or trailing>=1 else []),'perceptualQuality':'UNVERIFIED'}

if __name__=='__main__':
 import soundfile as sf
 from voice_clone import contained
 root=Path(__file__).resolve().parents[1];a,sr=sf.read(contained(root,sys.argv[1]),dtype='float32',always_2d=True);q=inspect_samples(a,int(sr));contained(root,sys.argv[2]).write_text(json.dumps(q),encoding='utf-8')
