import sys,json,hashlib,time,os,wave
from pathlib import Path
import numpy as np
from audio import read_pcm,read_pcm_payload,write_pcm,mix_pcm,waveform_bins
from voice_clone import source_audio,clone_voice
from voice_qc import inspect_samples
ROOT=Path(__file__).resolve().parents[1]
def scoped(p):
 target=(ROOT/p).resolve();target.relative_to(ROOT)
 return target
def sha(file):return hashlib.sha256(Path(file).read_bytes()).hexdigest()
def load_cached_audio(target,side,key):
 try:
  if target.stat().st_size>9*1024*1024 or side.stat().st_size>8192:return None
  prior=json.loads(side.read_text(encoding='utf-8'))
  if not isinstance(prior,dict):return None
  payload=target.read_bytes();digest=hashlib.sha256(payload).hexdigest();arr,sr=read_pcm_payload(payload)
  if len(arr)>0 and sr==48000 and prior['cacheKey']==key and prior['sha256']==digest and prior['samples']==len(arr) and prior['sampleRate']==sr:return arr,sr,digest
 except (OSError,ValueError,KeyError,TypeError,EOFError,wave.Error):pass
 return None
def main(request_file):
 request=json.loads(scoped(request_file).read_text(encoding='utf-8'))
 config=json.loads((ROOT/'runtime-config.json').read_text(encoding='utf-8'))
 results={};tts=None;start=time.monotonic();generated=0
 for p in request['phrases']:
  target=scoped('.cache/audio/'+p['cacheKey']+'.wav');side=target.with_suffix('.json');target.parent.mkdir(parents=True,exist_ok=True)
  prior=load_cached_audio(target,side,p['cacheKey']);cached=prior is not None
  if p.get('source'):
   arr,sr=source_audio(ROOT,p['source']);digest=p['source']['sha256'];cached=True;prior=(arr,sr,digest)
  if cached:arr,sr,digest=prior
  qc=None
  if not cached:
   if tts is None:
    from vieneu import Vieneu
    tts=Vieneu(backend='onnx',device='cpu',precision='fp32',threads=4,backbone_repo=str(scoped(config['modelRoot'])),onnx_dir=str(scoped(config['modelDir'])))
   voice=clone_voice(ROOT,tts,p['profile']) if p.get('profile') else p.get('voice',request['voice'])
   if isinstance(voice,str) and tts.resolve_voice_name(voice) is None:raise ValueError('UNKNOWN_PRESET_VOICE')
   np.random.seed(p.get('seed',int(p['cacheKey'][:8],16)))
   arr=np.asarray(tts.infer(p['text'],voice=voice,temperature=0.8),dtype=np.float32);sr=tts.sample_rate
   if len(arr)==0 or len(arr)>90*sr or not np.isfinite(arr).all():raise ValueError('TTS_EMPTY_OR_INVALID')
   qc=inspect_samples(arr,sr)
   temporary=target.with_suffix('.wav.tmp');write_pcm(temporary,arr,sr);payload=temporary.read_bytes();arr,sr=read_pcm_payload(payload);digest=hashlib.sha256(payload).hexdigest()
   temporary_side=side.with_suffix('.json.tmp');temporary_side.write_text(json.dumps({'cacheKey':p['cacheKey'],'sha256':digest,'samples':len(arr),'sampleRate':sr}),encoding='utf-8')
   os.replace(temporary,target);os.replace(temporary_side,side);generated+=1
  results[p['id']]={'file':p['source']['file'] if p.get('source') else str(target.relative_to(ROOT)).replace('\\','/'),'sha256':digest,'samples':len(arr),'sampleRate':sr,'cached':cached,'waveform':waveform_bins(arr),'qc':qc if qc is not None else {'sourcePeak':'UNVERIFIED','cached':True}}
 result={'status':'VERIFIED','audio':results,'generated':generated,'elapsedSeconds':time.monotonic()-start,'backend':'onnx-cpu-fp32','voice':request['voice']}
 if tts is not None:result['voices']=tts.list_preset_voices()
 scoped(request['resultFile']).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({'status':'VERIFIED','phrases':len(results),'generated':generated,'elapsedSeconds':result['elapsedSeconds']},ensure_ascii=False))
def mix(file):
 m=json.loads(scoped(file).read_text(encoding='utf-8'));tracks=[]
 for p in m['phrases']:
  arr,sr=read_pcm(scoped(p['file']))
  if sr!=48000 or len(arr)!=p['samples'] or sha(scoped(p['file']))!=p['sha256']:raise ValueError('AUDIO_CHANGED')
  tracks.append({'samples':arr,'start':p['start']})
 music=None
 if m.get('music'):
  meta=m['music']
  if sha(scoped(meta['path']))!=meta['sha256']:raise ValueError('MUSIC_CHANGED')
  music,music_sr=read_pcm(scoped(meta['path']))
  if music_sr!=48000:raise ValueError('MUSIC_SAMPLE_RATE')
 write_pcm(scoped(m['mixFile']),mix_pcm(tracks,m['duration'],48000,[s['start'] for s in m['scenes']],music=music,gain_db=m.get('music',{}).get('gainDb',-18),duck_db=m.get('music',{}).get('duckDb',-12)),48000)
if __name__=='__main__':
 if len(sys.argv)!=3 or sys.argv[1] not in ['synthesize','mix']:raise SystemExit('USAGE tts.py synthesize|mix REQUEST_JSON')
 if sys.argv[1]=='mix':mix(sys.argv[2])
 else:main(sys.argv[2])
