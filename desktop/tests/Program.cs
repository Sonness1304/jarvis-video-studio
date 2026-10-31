using System.Reflection;
using System.Text.Json;

var assembly=Assembly.GetExecutingAssembly();
var contract=assembly.GetType("VideoStudio.Desktop.DesktopContracts");
if(contract is null){Console.WriteLine("FAIL: native contracts have not been implemented");return 1;}
int assertions=0;
void Check(bool value,string message){assertions++;if(!value)throw new Exception("FAIL: "+message);}
object? Call(string name,params object?[] values)=>contract.GetMethod(name)!.Invoke(null,values);
object Object(string name,object data)=>JsonSerializer.Deserialize(JsonSerializer.Serialize(data),assembly.GetType("VideoStudio.Desktop."+name)!,new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
try{
 const string origin="http://127.0.0.1:20130";
 foreach(var url in new[]{origin+"/",origin+"/#tasks",origin+"/preview/abc/index.html"})Check((bool)Call("IsStudioUri",url,origin)!,"local origin allowed");
 foreach(var url in new[]{"http://localhost:20130/","http://127.0.0.1:20131/","https://evil.test/","file:///C:/Windows/","javascript:alert(1)","http://127.0.0.1:20130@evil.test/"})Check(!(bool)Call("IsStudioUri",url,origin)!,"foreign URI denied "+url);
 Check((bool)Call("IsExternalUri","https://learn.microsoft.com/",true)!,"explicit external HTTPS");
 foreach(var url in new[]{"https://user:pass@example.com/","http://example.com/","file:///C:/x","javascript:bad"})Check(!(bool)Call("IsExternalUri",url,true)!,"external scheme/credentials denied");
 Check(!(bool)Call("IsExternalUri","https://example.com/",false)!,"redirect not user initiated");
 Check((string?)Call("DownloadExtension",origin+"/api/artifacts/job-abc/video?download=1",origin)==".mp4","MP4 SaveAs");
 Check((string?)Call("DownloadExtension",origin+"/api/artifacts/job-abc/captions?download=1",origin)==".srt","SRT SaveAs");
 foreach(var url in new[]{origin+"/api/artifacts/job-abc/exe",origin+"/x.exe","https://evil.test/api/artifacts/job-abc/video"})Check(Call("DownloadExtension",url,origin) is null,"download boundary");
 Check((bool?)Call("DirtyMessage","{\"type\":\"studio-dirty\",\"dirty\":true}",origin+"/",origin)==true,"dirty true");
 Check((bool?)Call("DirtyMessage","{\"type\":\"studio-dirty\",\"dirty\":false}",origin+"/",origin)==false,"dirty false");
 foreach(var json in new[]{"{}","bad","{\"type\":\"studio-dirty\",\"dirty\":\"false\"}","{\"type\":\"studio-dirty\",\"dirty\":true,\"command\":\"shell\"}","{\"type\":\"studio-dirty\",\"dirty\":true,\"dirty\":false}"})Check(Call("DirtyMessage",json,origin+"/",origin) is null,"invalid exact typed message");
 Check(Call("DirtyMessage","{\"type\":\"studio-dirty\",\"dirty\":true}",origin+"/preview/x/index.html",origin) is null,"iframe dirty denied");
 var start=DateTimeOffset.UtcNow;
 object Manifest(string hash)=>Object("DesktopManifest",new{schemaVersion=1,root=@"C:\Jarvis",realRoot=@"C:\Jarvis",rootHash=hash,nodeExe=@"C:\Program Files\nodejs\node.exe",pwshExe=@"C:\Program Files\PowerShell\7\pwsh.exe",origin,sourceHead=new string('b',40)});
 object Identity(string hash,int pid=123)=>Object("BackendIdentity",new{appId="jarvis-video-studio",rootHash=hash,pid,startedAt=start});
 object Proof(string entry,int pid=123,string? exe=null,DateTimeOffset? time=null)=>Object("ProcessProof",new{pid,startedAt=time??start,executable=exe??@"C:\Program Files\nodejs\node.exe",arguments=new[]{@"C:\Program Files\nodejs\node.exe",entry}});
 var good=Manifest(new string('a',64));var identity=Identity(new string('a',64));var proof=Proof(@"C:\Jarvis\src\editor-server.mjs");
 Check((bool)Call("IdentityMatches",good,identity,proof,123)!,"full process identity");
 Check(!(bool)Call("IdentityMatches",good,Identity(new string('c',64)),proof,123)!,"foreign root");
 Check(!(bool)Call("IdentityMatches",good,identity,Proof(@"C:\Other\src\editor-server.mjs"),123)!,"foreign argv");
 Check(!(bool)Call("IdentityMatches",good,identity,Proof(@"src\editor-server.mjs"),123)!,"unproven relative cwd held");
 Check(!(bool)Call("IdentityMatches",good,identity,Proof(@"C:\Jarvis\src\editor-server.mjs",time:start.AddMinutes(1)),123)!,"PID reuse");
 Check(!(bool)Call("IdentityMatches",good,identity,Proof(@"C:\Jarvis\src\editor-server.mjs",exe:@"C:\Other\node.exe"),123)!,"wrong executable");
 Check(!(bool)Call("IdentityMatches",good,identity,proof,124)!,"listener mismatch");
 var fixture=Path.Combine(Path.GetTempPath(),"studio-desktop-contract-"+Guid.NewGuid());Directory.CreateDirectory(fixture);
 try{
  foreach(var name in new[]{"package.json","docs/jarvis/project-profile.json","runtime-config.json","src/editor-server.mjs","src/desktop-identity.mjs","node.exe","pwsh.exe"}){var file=Path.Combine(fixture,name);Directory.CreateDirectory(Path.GetDirectoryName(file)!);File.WriteAllText(file,"fixture");}
  var manifestFile=Path.Combine(fixture,"manifest.json");var valid=new Dictionary<string,object>{{"schemaVersion",1},{"root",fixture},{"realRoot",fixture},{"rootHash",new string('a',64)},{"nodeExe",Path.Combine(fixture,"node.exe")},{"pwshExe",Path.Combine(fixture,"pwsh.exe")},{"origin",origin},{"sourceHead",new string('b',40)}};
  void WriteManifest(Dictionary<string,object> value)=>File.WriteAllText(manifestFile,JsonSerializer.Serialize(value));
  void RejectManifest(Dictionary<string,object> value,string expected){WriteManifest(value);try{Call("ReadManifest",manifestFile);Check(false,"invalid manifest must reject");}catch(TargetInvocationException e){Check(e.InnerException?.Message==expected,"manifest failure is specific: "+expected);}}
  WriteManifest(valid);Check(Call("ReadManifest",manifestFile) is not null,"valid local manifest reads");
  RejectManifest(new(valid){{"unexpected","value"}},"The JSON property 'unexpected' could not be mapped to any .NET member contained in type 'VideoStudio.Desktop.DesktopManifest'.");
  RejectManifest(new(valid){["origin"]="https://example.com"},"DESKTOP_MANIFEST_INVALID");
  RejectManifest(new(valid){["nodeExe"]=Path.Combine(fixture,"missing.exe")},"DESKTOP_RUNTIME_MISSING");
  RejectManifest(new(valid){["root"]=Path.Combine(fixture,"missing-root")},"DESKTOP_ROOT_MISSING");
 }finally{if(!Path.GetFullPath(fixture).StartsWith(Path.GetFullPath(Path.GetTempPath()),StringComparison.OrdinalIgnoreCase))throw new Exception("fixture scope");Directory.Delete(fixture,true);}
 var sessionType=assembly.GetType("VideoStudio.Desktop.BackendSession")!;
 var transport=new FakeTransport();
 using var session=(IDisposable)Activator.CreateInstance(sessionType,BindingFlags.Instance|BindingFlags.NonPublic,null,new object?[]{good,null,transport},null)!;
 var quit=(Task)sessionType.GetMethod("QuitWhenIdleAsync")!.Invoke(session,new object[]{CancellationToken.None})!;
 try{await quit;Check(false,"foreign backend cannot quit");}catch(InvalidOperationException e){Check(e.Message=="DESKTOP_NOT_OWNER","foreign backend quit rejected before IO");}
 Check(transport.Requests==0,"foreign quit does not transmit nonce");
 var textMethod=sessionType.GetMethod("TextAsync",BindingFlags.Instance|BindingFlags.NonPublic)!;
 var text=(Task<string>)textMethod.Invoke(session,new object[]{new HttpRequestMessage(HttpMethod.Get,origin+"/"),CancellationToken.None})!;
 Check(await text=="{}","bounded readonly HTTP works");transport.Status=System.Net.HttpStatusCode.Redirect;
 try{await (Task<string>)textMethod.Invoke(session,new object[]{new HttpRequestMessage(HttpMethod.Get,origin+"/"),CancellationToken.None})!;Check(false,"redirect must fail");}catch(InvalidOperationException e){Check(e.Message=="BACKEND_HTTP_302","no redirect auto-follow");}
 transport.Status=System.Net.HttpStatusCode.OK;transport.Body=new string('x',4*1024*1024+1);
 try{await (Task<string>)textMethod.Invoke(session,new object[]{new HttpRequestMessage(HttpMethod.Get,origin+"/"),CancellationToken.None})!;Check(false,"oversized response must fail");}catch(InvalidOperationException e){Check(e.Message=="DESKTOP_RESPONSE_TOO_LARGE","bounded transport");}
 transport.Hang=true;using var abort=new CancellationTokenSource();var timer=System.Diagnostics.Stopwatch.StartNew();
 var hanging=(Task<string>)textMethod.Invoke(session,new object[]{new HttpRequestMessage(HttpMethod.Get,origin+"/"),abort.Token})!;
 var bounded=await Task.WhenAny(hanging,Task.Delay(4500));abort.Cancel();
 Check(bounded==hanging,"headers received but unfinished body has its own deadline");
 try{await hanging;Check(false,"body must time out");}catch(OperationCanceledException){Check(timer.Elapsed.TotalSeconds<4.5,"body deadline bounded");}
 var gateType=assembly.GetType("VideoStudio.Desktop.DesktopCloseTransaction");Check(gateType is not null,"native close transaction exists");
 var gate=Activator.CreateInstance(gateType!)!;var trace=new List<string>();var pending=new TaskCompletionSource();
 Task<bool> Run(Func<Task<bool>> confirm,Func<Task> shutdown)=> (Task<bool>)gateType!.GetMethod("RunAsync")!.Invoke(gate,new object[]{confirm,shutdown,(Action<bool>)(freeze=>trace.Add(freeze?"freeze":"release"))})!;
 var closing=Run(()=>{trace.Add("confirm");return Task.FromResult(true);},()=>pending.Task);
 Check(trace.SequenceEqual(new[]{"freeze","confirm"}),"freeze precedes checking dirty and pending shutdown");
 Check(!await Run(()=>Task.FromResult(true),()=>Task.CompletedTask),"second close cannot race pending transaction");pending.SetResult();Check(await closing,"confirmed shutdown completes");
 Check(trace.Last()=="release","close always releases gate");
 try{await Run(()=>Task.FromResult(true),()=>throw new InvalidOperationException("busy"));Check(false,"busy propagated");}catch(InvalidOperationException){Check(trace.Last()=="release","failed close restores editing");}
 Check(!await Run(()=>Task.FromResult(false),()=>throw new Exception("must not shutdown")),"cancel keeps window and backend");
 var clamp=contract.GetMethod("ClampWindowBounds");Check(clamp is not null,"saved window geometry has a pure bounds validator");
 var areas=new[]{new System.Drawing.Rectangle(0,0,1280,720),new System.Drawing.Rectangle(-1920,0,1920,1080)};
 var bounds=(System.Drawing.Rectangle)clamp!.Invoke(null,new object[]{new System.Drawing.Rectangle(1000,600,1400,950),areas})!;
 Check(areas[0].Contains(bounds)&&bounds.Width==1280&&bounds.Height==720,"smaller display clamps the whole window, not only its first 100px");
 var negative=(System.Drawing.Rectangle)clamp.Invoke(null,new object[]{new System.Drawing.Rectangle(-1800,100,1100,800),areas})!;
 Check(areas[1].Contains(negative)&&negative.X<0,"secondary monitor may have negative coordinates");
 var removed=(System.Drawing.Rectangle)clamp.Invoke(null,new object[]{new System.Drawing.Rectangle(5000,5000,1400,950),areas.Take(1).ToArray()})!;
 Check(areas[0].Contains(removed),"removed monitor recovers into visible working area");
 var startup=contract.GetMethod("StartupErrorCode");Check(startup is not null,"startup errors are translated to stable user-facing codes");
 Check((string?)startup!.Invoke(null,new object[]{"WebView2RuntimeNotFoundException","host detail"})=="DESKTOP_WEBVIEW_RUNTIME_MISSING","missing browser runtime is actionable");
 var startupDialog=contract.GetMethod("NeedsStartupDialog");Check(startupDialog is not null,"startup failures distinguish blank WebView from an existing draft");
 foreach(var value in new string?[]{null,"about:blank","https://example.com"})Check((bool)startupDialog!.Invoke(null,new object?[]{value,origin})!,"initial failed connection requires a visible dialog");
 Check(!(bool)startupDialog!.Invoke(null,new object?[]{origin+"/",origin})!,"reconnect failure does not interrupt an existing Studio draft with a startup dialog");
 Console.WriteLine(JsonSerializer.Serialize(new{status="VERIFIED",assertions,providerRequests=0,processKills=0}));return 0;
}catch(Exception e){Console.WriteLine(e.ToString());return 1;}

sealed class FakeTransport : HttpMessageHandler
{
 public int Requests;public System.Net.HttpStatusCode Status=System.Net.HttpStatusCode.OK;public string Body="{}";public bool Hang;
 protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct){Requests++;return Task.FromResult(new HttpResponseMessage(Status){Content=Hang?new StreamContent(new HangingStream()):new StringContent(Body)});}
}
sealed class HangingStream : Stream
{
 public override bool CanRead=>true;public override bool CanSeek=>false;public override bool CanWrite=>false;public override long Length=>throw new NotSupportedException();public override long Position{get=>0;set=>throw new NotSupportedException();}
 public override async ValueTask<int> ReadAsync(Memory<byte> buffer,CancellationToken ct=default){await Task.Delay(Timeout.Infinite,ct);return 0;}
 public override int Read(byte[] buffer,int offset,int count)=>throw new NotSupportedException();public override void Flush(){}public override long Seek(long a,SeekOrigin b)=>throw new NotSupportedException();public override void SetLength(long a)=>throw new NotSupportedException();public override void Write(byte[] a,int b,int c)=>throw new NotSupportedException();
}
