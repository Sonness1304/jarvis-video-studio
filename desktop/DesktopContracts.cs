using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace VideoStudio.Desktop;

public sealed record DesktopManifest(int SchemaVersion,string Root,string RealRoot,string RootHash,string NodeExe,string PwshExe,string Origin,string SourceHead);
public sealed record BackendIdentity(string AppId,string RootHash,int Pid,DateTimeOffset StartedAt);
public sealed record ProcessProof(int Pid,DateTimeOffset StartedAt,string Executable,string[] Arguments);

public static class DesktopContracts
{
    public static bool NeedsStartupDialog(string? source,string origin)=>source is null||!IsStudioUri(source,origin);
    public static string StartupErrorCode(string exceptionType,string message)=>exceptionType=="WebView2RuntimeNotFoundException"?"DESKTOP_WEBVIEW_RUNTIME_MISSING":message;
    public static System.Drawing.Rectangle ClampWindowBounds(System.Drawing.Rectangle desired,System.Drawing.Rectangle[] workingAreas)
    {
        var areas=workingAreas.Where(r=>r.Width>0&&r.Height>0).ToArray();if(areas.Length==0)areas=new[]{new System.Drawing.Rectangle(0,0,1400,900)};
        var area=areas.OrderByDescending(r=>{var overlap=System.Drawing.Rectangle.Intersect(r,desired);return (long)Math.Max(0,overlap.Width)*Math.Max(0,overlap.Height);}).First();
        var width=Math.Clamp(desired.Width,Math.Min(1024,area.Width),area.Width);var height=Math.Clamp(desired.Height,Math.Min(720,area.Height),area.Height);
        return new System.Drawing.Rectangle(Math.Clamp(desired.X,area.Left,area.Right-width),Math.Clamp(desired.Y,area.Top,area.Bottom-height),width,height);
    }
    public const string StudioOrigin="http://127.0.0.1:20130";
    public static readonly JsonSerializerOptions JsonOptions=new(JsonSerializerDefaults.Web){UnmappedMemberHandling=JsonUnmappedMemberHandling.Disallow};
    public static DesktopManifest ReadManifest(string file)
    {
        var bytes=File.ReadAllBytes(file);if(bytes.Length>16384)throw new InvalidOperationException("DESKTOP_MANIFEST_INVALID");
        var m=JsonSerializer.Deserialize<DesktopManifest>(bytes,JsonOptions)??throw new InvalidOperationException("DESKTOP_MANIFEST_INVALID");
        if(m.SchemaVersion!=1||m.Origin!=StudioOrigin||!Regex.IsMatch(m.RootHash??"","^[a-f0-9]{64}$")||!Regex.IsMatch(m.SourceHead??"","^[a-f0-9]{40}$")||!Path.IsPathFullyQualified(m.Root)||!Path.IsPathFullyQualified(m.RealRoot)||!Path.IsPathFullyQualified(m.NodeExe)||!Path.IsPathFullyQualified(m.PwshExe))throw new InvalidOperationException("DESKTOP_MANIFEST_INVALID");
        foreach(var name in new[]{"package.json","docs/jarvis/project-profile.json","runtime-config.json","src/editor-server.mjs","src/desktop-identity.mjs"})if(!File.Exists(Path.Combine(m.Root,name)))throw new InvalidOperationException("DESKTOP_ROOT_MISSING");
        if(!File.Exists(m.NodeExe)||!File.Exists(m.PwshExe))throw new InvalidOperationException("DESKTOP_RUNTIME_MISSING");return m;
    }
    public static bool IsStudioUri(string value,string origin)
    {
        return Uri.TryCreate(value,UriKind.Absolute,out var u)&&u.UserInfo==""&&u.Scheme=="http"&&u.GetLeftPart(UriPartial.Authority).Equals(origin,StringComparison.OrdinalIgnoreCase);
    }
    public static bool IsExternalUri(string value,bool userInitiated)=>userInitiated&&Uri.TryCreate(value,UriKind.Absolute,out var u)&&u.Scheme=="https"&&u.UserInfo==""&&!string.IsNullOrEmpty(u.Host);
    public static string? DownloadExtension(string value,string origin)
    {
        if(!IsStudioUri(value,origin))return null;var match=Regex.Match(new Uri(value).AbsolutePath,"^/api/artifacts/job-[a-z0-9-]{1,48}/(video|audio|captions|receipt|timeline)$");
        return !match.Success?null:match.Groups[1].Value switch{"video"=>".mp4","audio"=>".wav","captions"=>".srt",_=>".json"};
    }
    public static bool? DirtyMessage(string json,string source,string origin)
    {
        if(json.Length>128||!IsStudioUri(source,origin)||new Uri(source).AbsolutePath!="/"||new Uri(source).Query!="")return null;
        try{using var doc=JsonDocument.Parse(json);var root=doc.RootElement;if(root.ValueKind!=JsonValueKind.Object)return null;var fields=root.EnumerateObject().ToArray();if(fields.Length!=2||fields.Select(p=>p.Name).Distinct().Count()!=2||fields.Any(p=>p.Name!="type"&&p.Name!="dirty"))return null;if(root.GetProperty("type").GetString()!="studio-dirty")return null;var dirty=root.GetProperty("dirty");return dirty.ValueKind==JsonValueKind.True?true:dirty.ValueKind==JsonValueKind.False?false:null;}catch{return null;}
    }
    public static bool PathEquals(string a,string b){try{return Path.GetFullPath(a).TrimEnd('\\','/').Equals(Path.GetFullPath(b).TrimEnd('\\','/'),StringComparison.OrdinalIgnoreCase);}catch{return false;}}
    public static bool IdentityMatches(DesktopManifest manifest,BackendIdentity identity,ProcessProof proof,int listenerPid)
    {
        return identity.AppId=="jarvis-video-studio"&&identity.RootHash==manifest.RootHash&&identity.Pid>0&&identity.Pid==listenerPid&&proof.Pid==listenerPid&&Math.Abs((identity.StartedAt-proof.StartedAt).TotalSeconds)<3&&PathEquals(proof.Executable,manifest.NodeExe)&&proof.Arguments is {Length:2}&&PathEquals(proof.Arguments[0],manifest.NodeExe)&&Path.IsPathFullyQualified(proof.Arguments[1])&&PathEquals(proof.Arguments[1],Path.Combine(manifest.Root,"src/editor-server.mjs"));
    }
}
public sealed class DesktopCloseTransaction
{
    bool pending;
    public async Task<bool> RunAsync(Func<Task<bool>> confirm,Func<Task> shutdown,Action<bool> freeze)
    {
        if(pending)return false;pending=true;
        try{freeze(true);if(!await confirm())return false;await shutdown();return true;}
        finally{freeze(false);pending=false;}
    }
}
