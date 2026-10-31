import sys,unittest,tempfile,wave
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from audio import read_pcm,write_pcm,mix_pcm,waveform_bins
from tts import load_cached_audio
import json,hashlib
import numpy as np
class AudioTests(unittest.TestCase):
 def test_music_ducks_during_actual_voice_and_recovers_in_silence(self):
  sr=48000;music=np.full(sr*3,.2);voice=np.full(sr,.12)
  out=mix_pcm([{'samples':voice,'start':1}],3,sr,[],music=music,gain_db=-6,duck_db=-18)
  quiet=float(np.mean(out[sr//2:sr*3//4]));under=float(np.mean(out[sr+sr//2:sr+sr*3//4]))-.12
  self.assertLess(under,quiet*.3);self.assertGreater(float(np.mean(out[round(sr*2.25):round(sr*2.5)])),under*2)
  self.assertEqual(len(out),sr*3)
 def test_broken_header_or_sidecar_becomes_cache_miss(self):
  with tempfile.TemporaryDirectory() as d:
   wav=Path(d)/'voice.wav';side=wav.with_suffix('.json');key='a'*64
   for bad in [b'',b'not a WAV',b'RIFF\x20\x00\x00\x00WAVEfmt ']:
    wav.write_bytes(bad);side.write_text(json.dumps({'cacheKey':key,'samples':1,'sampleRate':48000,'sha256':hashlib.sha256(bad).hexdigest()}))
    self.assertIsNone(load_cached_audio(wav,side,key))
   write_pcm(wav,np.full(4800,.1),48000);side.write_text(json.dumps({'cacheKey':key,'samples':4800,'sampleRate':48000,'sha256':hashlib.sha256(wav.read_bytes()).hexdigest()}))
   self.assertEqual(len(load_cached_audio(wav,side,key)[0]),4800)
   side.write_text('[]');self.assertIsNone(load_cached_audio(wav,side,key))
 def test_waveform_reports_measured_audio_not_random_graphics(self):
  self.assertEqual(waveform_bins(np.zeros(340),34),[0.0]*34)
  measured=waveform_bins(np.concatenate([np.zeros(170),np.ones(170)*.2]),34)
  self.assertEqual(measured[:17],[0.0]*17);self.assertTrue(all(v>0 for v in measured[17:]))
 def test_mixed_voice_uses_measured_sample_offsets_and_preserves_tail(self):
  samples=np.full(4800,0.1,dtype=np.float32)
  result=mix_pcm([{'samples':samples,'start':0.25}],0.6,48000,[])
  self.assertEqual(len(result),28800)
  self.assertTrue(np.all(result[:12000]==0))
  self.assertTrue(np.allclose(result[12000:16800],0.1))
  self.assertTrue(np.all(result[16800:]==0))
 def test_wav_roundtrip_pcm16_and_finite_nonclipping_mix(self):
  with tempfile.TemporaryDirectory() as d:
   target=Path(d)/'test.wav';write_pcm(target,np.full(4800,0.2),48000)
   arr,sr=read_pcm(target);self.assertEqual(sr,48000);self.assertEqual(len(arr),4800)
   self.assertTrue(np.allclose(arr,0.2,atol=0.00004))
   result=mix_pcm([{'samples':np.ones(4800)*0.9,'start':0}],0.1,48000,[0])
   self.assertTrue(np.isfinite(result).all());self.assertLessEqual(float(np.max(np.abs(result))),0.98)
 def test_invalid_or_truncated_tracks_fail(self):
  for tr in [[{'samples':np.ones(4801),'start':0}],[{'samples':np.array([float('nan')]),'start':0}],[{'samples':np.ones(10),'start':-1}]]:
   with self.assertRaises(ValueError):mix_pcm(tr,0.1,48000,[])
if __name__=='__main__':unittest.main()
