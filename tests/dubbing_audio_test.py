import sys,unittest
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from dubbing_audio import slot_mix
class DubbingAudioTests(unittest.TestCase):
 def test_slots_use_absolute_samples_no_narration_gap(self):
  a=np.full(4800,.1,dtype=np.float32);out=slot_mix([{'start':0,'end':.2,'samples':a},{'start':.5,'end':.7,'samples':a}],1,48000)
  self.assertEqual(len(out),48000);self.assertAlmostEqual(float(out[0]),.1,5);self.assertEqual(float(out[10000]),0);self.assertAlmostEqual(float(out[24000]),.1,5)
 def test_overflow_overlap_and_nonfinite_are_rejected(self):
  for tracks in [[{'start':0,'end':.1,'samples':np.ones(9600)}],[{'start':0,'end':.2,'samples':np.full(4800,np.nan)}],[{'start':0,'end':.2,'samples':np.ones(4800)},{'start':.1,'end':.3,'samples':np.ones(4800)}]]:
   with self.assertRaises(ValueError):slot_mix(tracks,1,48000)
if __name__=='__main__':unittest.main()
