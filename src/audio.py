import wave
import io
from pathlib import Path
import numpy as np
def waveform_bins(samples,count=34):
 values=[float(np.sqrt(np.mean(chunk*chunk))) if len(chunk) else 0.0 for chunk in np.array_split(samples,count)]
 peak=max(values) if values else 0
 return [round(v/peak,4) if peak>0 else 0.0 for v in values]
def read_pcm_payload(payload):
 with wave.open(io.BytesIO(payload),'rb') as w:
  if w.getnchannels()!=1 or w.getsampwidth()!=2:raise ValueError('EXPECTED_MONO_PCM16')
  sr=w.getframerate();expected=w.getnframes();data=w.readframes(expected)
  if len(data)!=expected*2:raise ValueError('TRUNCATED_WAV')
  return np.frombuffer(data,dtype='<i2').astype(np.float32)/32768,sr
def read_pcm(file):return read_pcm_payload(Path(file).read_bytes())
def write_pcm(file,samples,sr):
 if not np.isfinite(samples).all() or len(samples)<1:raise ValueError('INVALID_SAMPLES')
 with wave.open(str(file),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr)
  w.writeframes((np.clip(samples,-0.98,0.98)*32767).astype('<i2').tobytes())
def mix_pcm(tracks,duration,sr,cues,music=None,gain_db=-18,duck_db=-12):
 out=np.zeros(round(duration*sr),dtype=np.float32)
 for track in tracks:
  start=round(track['start']*sr);a=track['samples']
  if start<0 or start+len(a)>len(out) or not np.isfinite(a).all():raise ValueError('INVALID_AUDIO_TRACK')
  out[start:start+len(a)]+=a
 if music is not None:
  if len(music)<1 or not np.isfinite(music).all() or not -36<=gain_db<=0 or not -30<=duck_db<=0:raise ValueError('INVALID_MUSIC')
  block=max(1,round(sr*.02));activity=[];level=0.0
  for start in range(0,len(out),block):
   rms=float(np.sqrt(np.mean(out[start:start+block]**2)));target=1.0 if rms>.005 else 0.0
   level+=(target-level)*(.5 if target>level else .065);activity.append(level)
  envelope=np.repeat(np.asarray(activity),block)[:len(out)]
  bg=np.resize(music,len(out)).astype(np.float32)*10**(gain_db/20)*(1-envelope*(1-10**(duck_db/20)))
  fade=min(round(sr*.5),len(out)//2)
  if fade: bg[:fade]*=np.linspace(0,1,fade);bg[-fade:]*=np.linspace(1,0,fade)
  out+=bg
 for cue in cues:
  start=round(cue*sr);length=min(round(0.18*sr),len(out)-start)
  if start<0 or length<=0:continue
  t=np.arange(length)/sr
  fx=0.035*np.sin(2*np.pi*(600*t+1100*t*t))*np.exp(-t*25)*(1-np.exp(-t*300))
  out[start:start+length]+=fx
 return np.clip(out,-0.98,0.98)
