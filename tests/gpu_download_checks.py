import unittest,tempfile,importlib.util,subprocess,os,threading,http.server,requests
from pathlib import Path
spec=importlib.util.spec_from_file_location('gpu_download',Path(__file__).resolve().parents[1]/'scripts/download-gpu-models.py');download=importlib.util.module_from_spec(spec);spec.loader.exec_module(download)
class DownloadPathTest(unittest.TestCase):
 def test_bounded_ranges_resume_real_http_without_rewriting_partial(self):
  data=b'0123456789abcdef';ranges=[]
  class Handler(http.server.BaseHTTPRequestHandler):
   def do_GET(self):
    header=self.headers['Range'];ranges.append(header);a,b=map(int,header.removeprefix('bytes=').split('-'));payload=data[a:b+1]
    self.send_response(206);self.send_header('Content-Range',f'bytes {a}-{b}/{len(data)}');self.send_header('Content-Length',len(payload));self.end_headers();self.wfile.write(payload)
   def log_message(self,*args):pass
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  try:
   with tempfile.TemporaryDirectory() as d:
    root=Path(d);part=root/'model.part';part.write_bytes(data[:3]);session=requests.Session();session.trust_env=False
    download.download_ranges(session,f'http://127.0.0.1:{server.server_port}',root,part,len(data),chunk_bytes=4)
    self.assertEqual(part.read_bytes(),data);self.assertEqual(ranges,['bytes=3-6','bytes=7-10','bytes=11-14','bytes=15-15'])
  finally:server.shutdown();server.server_close()
 @unittest.skipUnless(os.name=='nt','Windows native junction')
 def test_native_junction_is_rejected_without_writing_external_file(self):
  with tempfile.TemporaryDirectory() as d, tempfile.TemporaryDirectory() as other:
   root=Path(d);outside=Path(other);victim=outside/'model.part';victim.write_text('keep');link=root/'linked'
   r=subprocess.run(['cmd','/c','mklink','/J',str(link),str(outside)],capture_output=True)
   self.assertEqual(r.returncode,0)
   with self.assertRaises(ValueError):download.open_partial(root,link/'model.part',4)
   self.assertEqual(victim.read_text(),'keep')
 def test_regular_model_path_is_scoped_before_io(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);self.assertEqual(download.scoped_model(root,root/'model.part'),root/'model.part')
   with self.assertRaises(ValueError):download.scoped_model(root,root.parent/'outside.part')
 def test_partial_symlink_cannot_append_outside_model_root(self):
  with tempfile.TemporaryDirectory() as d, tempfile.TemporaryDirectory() as other:
   root=Path(d);model=root/'models'/'weights.safetensors';model.parent.mkdir();outside=Path(other)/'victim';outside.write_text('keep')
   partial=model.with_suffix('.safetensors.part')
   try:partial.symlink_to(outside)
   except OSError: self.skipTest('native symlink privilege unavailable');return
   with self.assertRaisesRegex(ValueError,'SYMLINK_MODEL_PATH'):download.scoped_model(root,partial)
   self.assertEqual(outside.read_text(),'keep')
if __name__=='__main__':unittest.main()
