import unittest,sys
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from voice_qc import inspect_samples
class VoiceQCTests(unittest.TestCase):
 def test_peak_before_clamp_and_absolute_rms(self):
  q=inspect_samples(np.array([0.,0.,1.2,1.2,-1.2]),48000)
  self.assertGreater(q['peak'],1);self.assertEqual(q['clippingSamples'],3);self.assertIn('CLIPPING',q['warnings'])
 def test_silence_and_nonfinite_are_not_quality_scores(self):
  q=inspect_samples(np.zeros(48000),48000);self.assertEqual(q['leadingSilenceSeconds'],1);self.assertIn('SILENCE',q['warnings']);self.assertNotIn('qualityScore',q)
  with self.assertRaises(ValueError):inspect_samples(np.array([np.nan]),48000)
