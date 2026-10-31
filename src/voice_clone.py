import hashlib,json
from pathlib import Path
import numpy as np
from audio import read_pcm

def contained(root,relative):
 root=Path(root).resolve();file=(root/relative).resolve();file.relative_to(root)
 cursor=root
 for part in file.relative_to(root).parts:
  cursor=cursor/part
  if cursor.is_symlink():raise ValueError('VOICE_SYMLINK')
 return file

def source_audio(root,source):
 file=contained(root,source['file'])
 if file.stat().st_size>20*1024**2 or hashlib.sha256(file.read_bytes()).hexdigest()!=source['sha256']:raise ValueError('VOICE_TAKE_CHANGED')
 a,sr=read_pcm(file)
 if sr!=48000 or not 0<len(a)<=90*sr or not np.isfinite(a).all():raise ValueError('VOICE_AUDIO_INVALID')
 return a,sr

def validate_reference(samples,sr,rights):
 if not isinstance(rights,str) or not rights.strip() or sr!=48000 or not 3*sr<=len(samples)<=8*sr or not np.isfinite(samples).all() or float(np.sqrt(np.mean(samples*samples)))<0.001:raise ValueError('PROFILE_AUDIO_INVALID')
 return len(samples)/sr

def clone_voice(root,tts,profile):
 if not profile.get('rights') or profile.get('archived'):raise ValueError('PROFILE_UNAVAILABLE')
 reference=contained(root,profile['reference']['path']);a,sr=source_audio(root,{'file':profile['reference']['path'],'sha256':profile['reference']['sha256']});validate_reference(a,sr,profile['rights'])
 lock=json.loads((Path(root)/'voice-models.lock.json').read_text(encoding='utf-8'))
 modelroot=contained(root,lock['cloneRoot'])
 for item in lock['files']:
  file=modelroot/item['name']
  if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest()!=item['sha256']:raise ValueError('CLONE_MODEL_MISSING_OR_CHANGED')
 # The engine and tokenizer stay pinned; only the lazy encoder root is changed on this private instance.
 tts.engine.checkpoint_path=str(modelroot)
 tts.engine.denoiser=tts.engine._load_denoiser()
 # Avoid SDK preclean's home-temp write: use validated mono input and the installed engine directly.
 emb,codes=tts.engine.prepare_reference(str(reference),denoise=True,use_ref_codes=True)
 return {'speaker_emb':np.asarray(emb).tolist(),'codes':np.asarray(codes).tolist()}
