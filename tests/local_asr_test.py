import hashlib,importlib.util,pathlib,tempfile,unittest,wave
MODULE=pathlib.Path(__file__).resolve().parents[1]/'src/local_asr.py'
class LocalAsrTest(unittest.TestCase):
 def load(self):
  spec=importlib.util.spec_from_file_location('local_asr',MODULE);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
 def test_validates_mono_16k_pcm_duration_before_model_load(self):
  module=self.load()
  with tempfile.TemporaryDirectory() as tmp:
   wav=pathlib.Path(tmp)/'source.wav'
   with wave.open(str(wav),'wb') as f:f.setparams((1,2,16000,0,'NONE','not compressed'));f.writeframes(b'\0\0'*16000)
   module.validate_audio(wav,1)
   with self.assertRaisesRegex(ValueError,'VOICE_ASR_AUDIO_INVALID'):module.validate_audio(wav,2)
 def test_segments_reject_nonfinite_overlap_out_of_range_or_oversized_text(self):
  module=self.load();row={'start':0,'end':1,'text':'Xin chào'};self.assertEqual(module.validate_segments([row],2),[row])
  for rows in [[{**row,'end':float('nan')}],[{**row,'end':3}],[row,row],[{**row,'text':'x'*241}],[row]*101]:
   with self.assertRaisesRegex(ValueError,'DUB_ASR_SEGMENTS_INVALID'):module.validate_segments(rows,2)
 def test_model_is_hash_pinned_and_changed_weight_is_rejected(self):
  module=self.load()
  with tempfile.TemporaryDirectory() as tmp:
   model=pathlib.Path(tmp)/('a'*40);model.mkdir();(model/'model.bin').write_bytes(b'pinned')
   lock={'modelRevision':'a'*40,'files':{'model.bin':hashlib.sha256(b'pinned').hexdigest()}}
   module.verify_model(model,lock);(model/'model.bin').write_bytes(b'changed')
   with self.assertRaisesRegex(ValueError,'VOICE_ASR_MODEL_CHANGED'):module.verify_model(model,lock)

 def test_chunk_cache_is_bound_to_source_language_model_and_content_hash(self):
  module=self.load();lock={'modelRevision':'a'*40,'files':{'model.bin':'b'*64},'packages':{'faster-whisper':'1'}};request={'audioSha256':'c'*64,'language':'en'};data=b'\0\0'*16000
  key=module.chunk_cache_key(lock,request,0,data)
  self.assertNotEqual(key,module.chunk_cache_key(lock,{**request,'language':'vi'},0,data));self.assertNotEqual(key,module.chunk_cache_key(lock,request,16000,data))
  rows=[{'start':0,'end':.5,'text':'Hello'}]
  with tempfile.TemporaryDirectory() as tmp:
   cache=pathlib.Path(tmp);self.assertIsNone(module.read_chunk_cache(cache,key,1));module.write_chunk_cache(cache,key,rows,1);self.assertEqual(module.read_chunk_cache(cache,key,1),rows)
   file=cache/(key+'.json');text=file.read_text();file.write_text(text.replace('Hello','Changed'));self.assertIsNone(module.read_chunk_cache(cache,key,1))
 def test_cache_rejects_invalid_timing_and_stays_bounded(self):
  module=self.load()
  with tempfile.TemporaryDirectory() as tmp:
   cache=pathlib.Path(tmp)
   with self.assertRaisesRegex(ValueError,'DUB_ASR_SEGMENTS_INVALID'):module.write_chunk_cache(cache,'a'*64,[{'start':0,'end':2,'text':'bad'}],1)
   for i in range(128):(cache/(str(i)+'.json')).write_text('{}')
   module.write_chunk_cache(cache,'b'*64,[{'start':0,'end':.5,'text':'Hello'}],1);self.assertFalse((cache/('b'*64+'.json')).exists())
