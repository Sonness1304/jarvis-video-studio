import sys,unittest,tempfile,json,hashlib
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from voice_clone import validate_reference,source_audio
from audio import write_pcm
class VoiceCloneTests(unittest.TestCase):
 def test_reference_requires_rights_length_finite_and_non_silent(self):
  for values,rights in [(np.zeros(48000*5),'mine'),(np.full(48000*2,.1),'mine'),(np.full(48000*5,.1),''),(np.full(48000*5,np.nan),'mine')]:
   with self.assertRaises(ValueError):validate_reference(values,48000,rights)
  self.assertEqual(validate_reference(np.full(48000*5,.1),48000,'mine'),5)
 def test_selected_source_is_hash_bound_and_no_inference(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);write_pcm(root/'sample.wav',np.full(4800,.1),48000);digest=hashlib.sha256((root/'sample.wav').read_bytes()).hexdigest()
   a,sr=source_audio(root,{'file':'sample.wav','sha256':digest});self.assertEqual(len(a),4800);self.assertEqual(sr,48000)
   with self.assertRaises(ValueError):source_audio(root,{'file':'sample.wav','sha256':'0'*64})
if __name__=='__main__':unittest.main()
