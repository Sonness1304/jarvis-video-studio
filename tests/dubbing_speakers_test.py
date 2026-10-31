import importlib.util,pathlib,unittest,numpy as np
root=pathlib.Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('speakers',root/'src/dubbing_speakers.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class SpeakerGroupingTests(unittest.TestCase):
 def test_groups_and_suggests_known_vectors_without_inventing_gender_certainty(self):
  a=np.zeros(192);a[0]=1;b=np.zeros(192);b[1]=1
  presets={'voice-a':{'speaker_emb':a.tolist(),'gender':'male'},'voice-b':{'speaker_emb':b.tolist(),'gender':'female'}}
  r=mod.group_embeddings([{'id':'one','embedding':a,'pitchHz':100},{'id':'two','embedding':b,'pitchHz':210},{'id':'three','embedding':a,'pitchHz':102},{'id':'short','embedding':None}],presets)
  self.assertEqual([p['speakerId'] for p in r['assignments']],['speaker-1','speaker-2','speaker-1',None]);self.assertEqual([s['voice']['voiceId'] for s in r['speakers']],['voice-a','voice-b']);self.assertEqual(r['quality'],'UNVERIFIED');self.assertTrue(r['reviewRequired'])
 def test_pitch_range_hint_and_uncertain_voice_not_auto_assigned(self):
  low=np.sin(2*np.pi*100*np.arange(32000)/16000).astype(np.float32);high=np.sin(2*np.pi*210*np.arange(32000)/16000).astype(np.float32)
  self.assertAlmostEqual(mod.estimate_pitch(low),100,delta=3);self.assertAlmostEqual(mod.estimate_pitch(high),210,delta=6)
  a=np.zeros(192);a[0]=1;b=np.zeros(192);b[1]=1;r=mod.group_embeddings([{'id':'one','embedding':a}],{'B':{'speaker_emb':b.tolist(),'gender':'female'}})
  self.assertNotIn('voice',r['speakers'][0]);self.assertEqual(r['speakers'][0]['suggestion']['pitchBand'],'uncertain')
 def test_uncertain_pitch_never_auto_assigns_even_with_perfect_similarity(self):
  a=np.zeros(192);a[0]=1
  for pitch in [None,160,181.8]:
   r=mod.group_embeddings([{'id':'one','embedding':a,'pitchHz':pitch}],{'A':{'speaker_emb':a.tolist(),'gender':'male'}})
   self.assertNotIn('voice',r['speakers'][0]);self.assertEqual(r['speakers'][0]['suggestion']['pitchBand'],'uncertain')
 def test_weak_match_is_not_auto_assigned_despite_confident_pitch(self):
  a=np.zeros(192);a[0]=1;b=np.zeros(192);b[1]=1
  r=mod.group_embeddings([{'id':'one','embedding':a,'pitchHz':100}],{'A':{'speaker_emb':b.tolist(),'gender':'male'}})
  self.assertNotIn('voice',r['speakers'][0])
 def test_zero_or_nan_embeddings_rejected(self):
  for v in [np.zeros(192),np.full(192,np.nan),np.ones(191)]:
   with self.assertRaisesRegex(ValueError,'DUB_SPEAKER_EMBEDDING_INVALID'):mod.normalized(v)
if __name__=='__main__':unittest.main()
