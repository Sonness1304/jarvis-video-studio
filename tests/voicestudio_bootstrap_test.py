import asyncio,hashlib,importlib.util,json,pathlib,tempfile,types,unittest
MODULE=pathlib.Path(__file__).resolve().parents[1]/'src'/'voicestudio_bootstrap.py'
class CompanionLowMemoryTest(unittest.TestCase):
 def load(self):
  spec=importlib.util.spec_from_file_location('low_memory',MODULE);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
 def test_skips_only_tts_warmup_and_preserves_on_demand_loader(self):
  module=self.load();calls=[]
  async def warm():calls.append('warm')
  manager=types.SimpleNamespace(preload_model=warm,load_model=lambda:calls.append('load'))
  module.disable_tts_warmup(manager);asyncio.run(manager.preload_model());self.assertEqual(calls,[]);manager.load_model();self.assertEqual(calls,['load'])
 def test_runtime_hashes_must_match_before_import_or_start(self):
  module=self.load()
  with tempfile.TemporaryDirectory() as tmp:
   project=pathlib.Path(tmp);(project/'backend/services').mkdir(parents=True);content=b'pinned';(project/'backend/main.py').write_bytes(content);(project/'backend/services/model_manager.py').write_bytes(content)
   lock={'version':'0.5.6','files':{name:hashlib.sha256(content).hexdigest() for name in ['backend/main.py','backend/services/model_manager.py']}}
   self.assertEqual(module.verify_runtime(project,lock),project/'backend');(project/'backend/main.py').write_bytes(b'updated')
   with self.assertRaisesRegex(ValueError,'VOICE_RUNTIME_CHANGED'):module.verify_runtime(project,lock)
 def test_warmup_override_runs_after_settings_and_manager_initialization(self):
  module=self.load();calls=[];settings={}
  async def warm():calls.append('warm')
  app=types.SimpleNamespace(preload_model=None)
  def phase_a():
   settings['timeout']=1234;calls.append('settings')
   app.preload_model=warm;app.effective_timeout=settings['timeout'];calls.append('manager')
  app._phase_a_build=phase_a
  module.install_after_initialization(app)
  self.assertEqual(calls,[])
  app._phase_a_build();asyncio.run(app.preload_model())
  self.assertEqual(calls,['settings','manager']);self.assertEqual(app.effective_timeout,1234)
  # Repeated Phase A must still leave warmup disabled after rebinding.
  app._phase_a_build();asyncio.run(app.preload_model());self.assertNotIn('warm',calls)
