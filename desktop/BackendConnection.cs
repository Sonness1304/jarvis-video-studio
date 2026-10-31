using System.Diagnostics;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace VideoStudio.Desktop;

public sealed class BackendSession : IDisposable
{
    readonly DesktopManifest manifest;readonly HttpClient client;readonly string? ownerNonce;
    public BackendIdentity Identity {get;private set;}=null!;
    public bool OwnsBackend=>ownerNonce is not null;
    internal BackendSession(DesktopManifest m,string? nonce,HttpMessageHandler? transport=null){manifest=m;ownerNonce=nonce;client=new HttpClient(transport??new HttpClientHandler{AllowAutoRedirect=false,UseProxy=false,CookieContainer=new CookieContainer()}){Timeout=TimeSpan.FromSeconds(3)};}
    internal async Task<string> TextAsync(HttpRequestMessage request,CancellationToken ct)
    {
        using var deadline=CancellationTokenSource.CreateLinkedTokenSource(ct);deadline.CancelAfter(TimeSpan.FromSeconds(3));ct=deadline.Token;
        using(request)using(var response=await client.SendAsync(request,HttpCompletionOption.ResponseHeadersRead,ct))
        {var source=await NativeProcess.ReadBoundedAsync(new StreamReader(await response.Content.ReadAsStreamAsync(ct)),4*1024*1024,ct);if(!response.IsSuccessStatusCode){string code="BACKEND_HTTP_"+(int)response.StatusCode;try{using var error=JsonDocument.Parse(source);code=error.RootElement.GetProperty("error").GetString()??code;}catch{}throw new InvalidOperationException(code);}return source;}
    }
    internal async Task<BackendIdentity> VerifyAsync(CancellationToken ct)
    {
        await TextAsync(new HttpRequestMessage(HttpMethod.Get,manifest.Origin+"/"),ct);
        using var boot=JsonDocument.Parse(await TextAsync(new HttpRequestMessage(HttpMethod.Get,manifest.Origin+"/api/bootstrap"),ct));
        var identity=boot.RootElement.GetProperty("serverIdentity").Deserialize<BackendIdentity>(DesktopContracts.JsonOptions)??throw new InvalidOperationException("PORT_BUSY");
        var listener=NativeProcess.ListenerPid();var proof=await NativeProcess.ProofAsync(manifest,identity.Pid,ct);
        if(listener is null||proof is null||!DesktopContracts.IdentityMatches(manifest,identity,proof,listener.Value))throw new InvalidOperationException("PORT_BUSY");return identity;
    }
    internal void Bind(BackendIdentity identity)=>Identity=identity;
    public bool IsAlive{get{try{using var p=Process.GetProcessById(Identity.Pid);return !p.HasExited&&Math.Abs((new DateTimeOffset(p.StartTime.ToUniversalTime())-Identity.StartedAt).TotalSeconds)<3;}catch{return false;}}}
    public async Task QuitWhenIdleAsync(CancellationToken ct)
    {
        if(ownerNonce is null)throw new InvalidOperationException("DESKTOP_NOT_OWNER");await NativeProcess.ValidateRootAsync(manifest,ct);var current=await VerifyAsync(ct);
        if(current.Pid!=Identity.Pid||current.StartedAt!=Identity.StartedAt)throw new InvalidOperationException("DESKTOP_OWNER_CHANGED");
        using var boot=JsonDocument.Parse(await TextAsync(new HttpRequestMessage(HttpMethod.Get,manifest.Origin+"/api/bootstrap"),ct));var csrf=boot.RootElement.GetProperty("csrf").GetString();
        var request=new HttpRequestMessage(HttpMethod.Post,manifest.Origin+"/api/desktop/shutdown"){Content=new StringContent("{}",Encoding.UTF8,"application/json")};request.Headers.Add("Origin",manifest.Origin);request.Headers.Add("x-studio-csrf",csrf);request.Headers.Add("x-studio-desktop-owner",ownerNonce);await TextAsync(request,ct);
    }
    public void Dispose()=>client.Dispose();
}

public static class BackendConnection
{
    public static async Task<BackendSession> ConnectAsync(DesktopManifest manifest,CancellationToken ct)
    {
        using var deadline=CancellationTokenSource.CreateLinkedTokenSource(ct);deadline.CancelAfter(TimeSpan.FromSeconds(15));
        try{return await ConnectWithinDeadlineAsync(manifest,deadline.Token);}catch(OperationCanceledException)when(!ct.IsCancellationRequested){throw new InvalidOperationException("DESKTOP_BACKEND_TIMEOUT");}
    }
    static async Task<BackendSession> ConnectWithinDeadlineAsync(DesktopManifest manifest,CancellationToken ct)
    {
        await NativeProcess.ValidateRootAsync(manifest,ct);
        if(NativeProcess.ListenerPid() is not null){var reuse=new BackendSession(manifest,null);try{reuse.Bind(await reuse.VerifyAsync(ct));return reuse;}catch{reuse.Dispose();throw new InvalidOperationException("PORT_BUSY");}}
        var nonce=Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();var session=new BackendSession(manifest,nonce);
        var directory=Path.Combine(manifest.Root,".runtime/studio/launcher");Directory.CreateDirectory(directory);var stamp="desktop-"+Guid.NewGuid();
        var start=NativeProcess.StartInfo(manifest.NodeExe,manifest.Root);start.ArgumentList.Add(Path.Combine(manifest.Root,"src/editor-server.mjs"));start.Environment["JARVIS_DESKTOP_OWNER_NONCE"]=nonce;start.Environment["JARVIS_DESKTOP_LOG_FILE"]=".runtime/studio/launcher/"+stamp+".log";
        using var child=Process.Start(start)??throw new InvalidOperationException("DESKTOP_BACKEND_LAUNCH_FAILED");
        File.WriteAllText(Path.Combine(directory,stamp+".json"),JsonSerializer.Serialize(new{pid=child.Id,startedAt=child.StartTime.ToUniversalTime(),root=manifest.Root,nodeExe=manifest.NodeExe,ownerNoncePresent=true},DesktopContracts.JsonOptions));
        var timer=Stopwatch.StartNew();
        try{while(timer.Elapsed<TimeSpan.FromSeconds(15)){ct.ThrowIfCancellationRequested();if(child.HasExited)throw new InvalidOperationException("DESKTOP_BACKEND_EXITED");if(NativeProcess.ListenerPid() is int listener){if(listener!=child.Id)throw new InvalidOperationException("PORT_BUSY");try{var identity=await session.VerifyAsync(ct);if(identity.Pid!=child.Id)throw new InvalidOperationException("PORT_BUSY");session.Bind(identity);return session;}catch(HttpRequestException){}catch(TaskCanceledException) when(!ct.IsCancellationRequested){}}
            await Task.Delay(150,ct);}throw new InvalidOperationException("DESKTOP_BACKEND_TIMEOUT");}
        catch{session.Dispose();throw;}
    }
}

internal static class NativeProcess
{
    static readonly string[] allowed={"SYSTEMROOT","WINDIR","PATH","PATHEXT","TEMP","TMP","USERPROFILE","LOCALAPPDATA","APPDATA","COMSPEC","PROGRAMFILES","PROGRAMFILES(X86)","PROGRAMDATA"};
    internal static ProcessStartInfo StartInfo(string executable,string root)
    {
        var start=new ProcessStartInfo(executable){UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=root};var copy=Environment.GetEnvironmentVariables();start.Environment.Clear();foreach(var key in copy.Keys.Cast<object>().Select(v=>v.ToString()!))if(allowed.Contains(key,StringComparer.OrdinalIgnoreCase))start.Environment[key]=copy[key]?.ToString();return start;
    }
    internal static async Task<string> ReadBoundedAsync(StreamReader reader,int max,CancellationToken ct)
    {
        using(reader){var output=new StringBuilder();var chunk=new char[4096];int count;while((count=await reader.ReadAsync(chunk.AsMemory(),ct))>0){if(output.Length+count>max)throw new InvalidOperationException("DESKTOP_RESPONSE_TOO_LARGE");output.Append(chunk,0,count);}return output.ToString();}
    }
    static async Task<string> CaptureAsync(ProcessStartInfo start,CancellationToken ct)
    {
        start.RedirectStandardOutput=true;start.RedirectStandardError=true;using var process=Process.Start(start)??throw new InvalidOperationException("DESKTOP_PROBE_FAILED");using var timeout=CancellationTokenSource.CreateLinkedTokenSource(ct);timeout.CancelAfter(TimeSpan.FromSeconds(8));
        var output=ReadBoundedAsync(process.StandardOutput,16384,timeout.Token);var error=ReadBoundedAsync(process.StandardError,16384,timeout.Token);await process.WaitForExitAsync(timeout.Token);var text=await output;await error;if(process.ExitCode!=0)throw new InvalidOperationException("DESKTOP_PROBE_FAILED");return text;
    }
    internal static async Task ValidateRootAsync(DesktopManifest manifest,CancellationToken ct)
    {
        var start=StartInfo(manifest.NodeExe,manifest.RealRoot);start.ArgumentList.Add(Path.Combine(manifest.RealRoot,"src/desktop-identity.mjs"));start.ArgumentList.Add("--root");start.ArgumentList.Add(manifest.Root);
        using var json=JsonDocument.Parse(await CaptureAsync(start,ct));if(json.RootElement.GetProperty("rootHash").GetString()!=manifest.RootHash||!DesktopContracts.PathEquals(json.RootElement.GetProperty("realRoot").GetString()!,manifest.RealRoot))throw new InvalidOperationException("DESKTOP_ROOT_CHANGED");
    }
    internal static async Task<ProcessProof?> ProofAsync(DesktopManifest manifest,int pid,CancellationToken ct)
    {
        if(pid<=0)return null;var start=StartInfo(manifest.PwshExe,manifest.Root);
        var script="$ErrorActionPreference='Stop';$p=Get-CimInstance Win32_Process -Filter 'ProcessId="+pid+"';if($p){@{pid=[int]$p.ProcessId;startedAt=$p.CreationDate.ToUniversalTime().ToString('o');executable=$p.ExecutablePath;command=$p.CommandLine}|ConvertTo-Json -Compress}";
        start.ArgumentList.Add("-NoProfile");start.ArgumentList.Add("-NonInteractive");start.ArgumentList.Add("-EncodedCommand");start.ArgumentList.Add(Convert.ToBase64String(Encoding.Unicode.GetBytes(script)));
        var text=await CaptureAsync(start,ct);if(string.IsNullOrWhiteSpace(text))return null;using var json=JsonDocument.Parse(text);var p=json.RootElement;
        return new ProcessProof(p.GetProperty("pid").GetInt32(),p.GetProperty("startedAt").GetDateTimeOffset(),p.GetProperty("executable").GetString()!,Arguments(p.GetProperty("command").GetString()!));
    }
    static string[] Arguments(string value)
    {
        var pointer=CommandLineToArgvW(value,out var count);if(pointer==IntPtr.Zero)throw new InvalidOperationException("DESKTOP_PROCESS_UNPROVEN");try{return Enumerable.Range(0,count).Select(i=>Marshal.PtrToStringUni(Marshal.ReadIntPtr(pointer,i*IntPtr.Size))??"").ToArray();}finally{LocalFree(pointer);}
    }
    internal static int? ListenerPid()
    {
        int size=0;GetExtendedTcpTable(IntPtr.Zero,ref size,false,2,5,0);if(size<=0)return null;var pointer=Marshal.AllocHGlobal(size);
        try{if(GetExtendedTcpTable(pointer,ref size,false,2,5,0)!=0)throw new InvalidOperationException("DESKTOP_LISTENER_UNPROVEN");int? found=null;int count=Marshal.ReadInt32(pointer);for(int i=0;i<count;i++){var row=IntPtr.Add(pointer,4+i*24);var port=(ushort)IPAddress.NetworkToHostOrder((short)(Marshal.ReadInt32(row,8)&0xffff));if(port!=20130||Marshal.ReadInt32(row)!=2)continue;if((uint)Marshal.ReadInt32(row,4)!=0x0100007f||found is not null)throw new InvalidOperationException("PORT_BUSY");found=Marshal.ReadInt32(row,20);}return found;}finally{Marshal.FreeHGlobal(pointer);}
    }
    [DllImport("iphlpapi.dll",SetLastError=true)]static extern uint GetExtendedTcpTable(IntPtr table,ref int size,bool order,int family,int tableClass,uint reserved);
    [DllImport("shell32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CommandLineToArgvW(string command,out int count);
    [DllImport("kernel32.dll")]static extern IntPtr LocalFree(IntPtr pointer);
}
