using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Diagnostics;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;

namespace VideoStudio.Desktop;

public sealed class StudioWindow : Form
{
    readonly DesktopManifest manifest;readonly string pipeName;readonly bool smoke;
    readonly WebView2 web=new(){Dock=DockStyle.Fill};readonly ToolStripStatusLabel status=new(){Spring=true,TextAlign=ContentAlignment.MiddleLeft};
    readonly ToolStripMenuItem quit=new("Thoát hoàn toàn khi rảnh"){Enabled=false},reconnect=new("Mở lại kết nối");
    readonly CancellationTokenSource lifetime=new();readonly System.Windows.Forms.Timer monitor=new(){Interval=2000};
    BackendSession? session;bool dirty,forceClose,smokeRecorded,connecting;
    readonly DesktopCloseTransaction closing=new();MenuStrip studioMenu=null!;
    readonly string local=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"JarvisVideoStudio");
    public StudioWindow(DesktopManifest config,string activationPipe,bool smokeMode)
    {
        manifest=config;pipeName=activationPipe;smoke=smokeMode;Text="Jarvis Video Studio";StartPosition=FormStartPosition.CenterScreen;ClientSize=new Size(1400,900);BackColor=Color.FromArgb(237,243,250);
        Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);Font=new Font("Segoe UI",9.5f);RestoreBoundsSetting();
        var menu=new MenuStrip();studioMenu=menu;var studio=new ToolStripMenuItem("Studio");var folder=new ToolStripMenuItem("Mở thư mục dự án");folder.Click+=(_,_)=>Process.Start(new ProcessStartInfo("explorer.exe"){ArgumentList={manifest.Root},UseShellExecute=false,CreateNoWindow=true});reconnect.Click+=async(_,_)=>await Connect();quit.Click+=async(_,_)=>await QuitFully();studio.DropDownItems.AddRange(new ToolStripItem[]{folder,reconnect,new ToolStripSeparator(),quit});menu.Items.Add(studio);
        var strip=new StatusStrip();strip.Items.Add(status);status.Text="Đang mở Video Studio…";Controls.Add(web);Controls.Add(strip);Controls.Add(menu);MainMenuStrip=menu;
        Shown+=async(_,_)=>{_ = ListenActivation();await Initialize();};FormClosing+=OnStudioClosing;FormClosed+=(_,_)=>{monitor.Stop();lifetime.Cancel();session?.Dispose();};
        monitor.Tick+=(_,_)=>{if(session is null)return;if(!session.IsAlive){status.Text="Backend đã dừng. Chọn Studio → Mở lại kết nối; tác vụ không tự chạy lại.";quit.Enabled=false;reconnect.Enabled=true;}};
    }
    async Task Initialize()
    {
        try{
            _=CoreWebView2Environment.GetAvailableBrowserVersionString();Directory.CreateDirectory(local);
            var environment=await CoreWebView2Environment.CreateAsync(null,Path.Combine(local,"WebView2"),new CoreWebView2EnvironmentOptions("--disable-background-networking"));
            await web.EnsureCoreWebView2Async(environment);var core=web.CoreWebView2;core.Settings.AreDevToolsEnabled=false;core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.IsStatusBarEnabled=false;core.Settings.IsPasswordAutosaveEnabled=false;core.Settings.IsGeneralAutofillEnabled=false;
            core.NavigationStarting+=(_,e)=>{if(DesktopContracts.IsStudioUri(e.Uri,manifest.Origin))return;e.Cancel=true;if(DesktopContracts.IsExternalUri(e.Uri,e.IsUserInitiated))OpenExternal(e.Uri);};
            core.NewWindowRequested+=(_,e)=>{e.Handled=true;if(DesktopContracts.IsExternalUri(e.Uri,e.IsUserInitiated))OpenExternal(e.Uri);};
            core.PermissionRequested+=(_,e)=>{e.State=CoreWebView2PermissionState.Deny;e.Handled=true;};
            core.WebMessageReceived+=(_,e)=>{if(web.Source is null||!web.Source.AbsoluteUri.Equals(e.Source,StringComparison.Ordinal))return;var value=DesktopContracts.DirtyMessage(e.WebMessageAsJson,e.Source,manifest.Origin);if(value is not null)dirty=value.Value;};
            core.AddWebResourceRequestedFilter("*",CoreWebView2WebResourceContext.All);
            core.WebResourceRequested+=(_,e)=>{if(DesktopContracts.IsStudioUri(e.Request.Uri,manifest.Origin)||e.Request.Uri=="about:blank")return;e.Response=environment.CreateWebResourceResponse(new MemoryStream(Array.Empty<byte>()),403,"Blocked","Content-Type: text/plain");};
            core.DownloadStarting+=Download;core.NavigationCompleted+=async(_,e)=>{if(e.IsSuccess&&smoke&&!smokeRecorded)await SmokeCapture();};
            await Connect();monitor.Start();
        }catch(Exception e){var code=DesktopContracts.StartupErrorCode(e.GetType().Name,e.Message);status.Text=FriendlyError(code);reconnect.Enabled=true;if(smoke)WriteSmoke(new{status="FAILED",error=e.GetType().Name,code,detail=status.Text});ShowStartupError(status.Text);}
    }
    async Task Connect()
    {
        if(connecting)return;connecting=true;reconnect.Enabled=false;status.Text="Đang xác minh dự án và backend…";
        try{if(session?.IsAlive!=true){session?.Dispose();session=await BackendConnection.ConnectAsync(manifest,lifetime.Token);}quit.Enabled=session.OwnsBackend;if(web.Source is not null&&DesktopContracts.IsStudioUri(web.Source.AbsoluteUri,manifest.Origin))web.CoreWebView2.PostWebMessageAsJson("{\"type\":\"studio-reconnect\"}");else web.CoreWebView2.Navigate(manifest.Origin+"/");status.Text="Đã kết nối · Đóng cửa sổ vẫn giữ backend và tác vụ đang chạy.";}
        catch(Exception e){status.Text=FriendlyError(e.Message);if(smoke)WriteSmoke(new{status="FAILED",error=e.GetType().Name,detail=FriendlyError(e.Message)});if(DesktopContracts.NeedsStartupDialog(web.Source?.AbsoluteUri,manifest.Origin))ShowStartupError(status.Text);}finally{connecting=false;reconnect.Enabled=true;}
    }
    void ShowStartupError(string text){BeginInvoke(new Action(()=>{if(!IsDisposed)MessageBox.Show(this,text,"Jarvis Video Studio",MessageBoxButtons.OK,MessageBoxIcon.Information);}));}
    static void OpenExternal(string url)=>Process.Start(new ProcessStartInfo(url){UseShellExecute=true});
    void Download(object? sender,CoreWebView2DownloadStartingEventArgs e)
    {
        e.Handled=true;var extension=DesktopContracts.DownloadExtension(e.DownloadOperation.Uri,manifest.Origin);if(extension is null){e.Cancel=true;return;}
        var deferral=e.GetDeferral();
        BeginInvoke(new Action(()=>{try{
            using var save=new SaveFileDialog{Title="Lưu bản xuất Video Studio",FileName="Jarvis-video"+extension,DefaultExt=extension.TrimStart('.'),AddExtension=true,Filter="Bản xuất (*"+extension+")|*"+extension,OverwritePrompt=true};
            if(save.ShowDialog(this)!=DialogResult.OK||!Path.GetExtension(save.FileName).Equals(extension,StringComparison.OrdinalIgnoreCase)){e.Cancel=true;return;}var fileName=save.FileName;e.ResultFilePath=fileName;
            e.DownloadOperation.StateChanged+=(_,_)=>{if(IsDisposed)return;if(e.DownloadOperation.State==CoreWebView2DownloadState.Completed)status.Text="Đã lưu bản xuất: "+Path.GetFileName(fileName);else if(e.DownloadOperation.State==CoreWebView2DownloadState.Interrupted)status.Text="Tải bản xuất bị ngắt. File gốc vẫn giữ trong dự án.";};
        }catch{e.Cancel=true;status.Text="Chưa lưu được bản xuất. File gốc vẫn giữ trong dự án.";}finally{deferral.Complete();}}));
    }
    async Task<bool> CanCloseAsync()
    {
        if(web.CoreWebView2 is not null&&web.Source is not null&&DesktopContracts.IsStudioUri(web.Source.AbsoluteUri,manifest.Origin)){try{var current=await web.CoreWebView2.ExecuteScriptAsync("window.jarvisDesktopDirty?.() ?? true");dirty=current!="false";}catch{if(dirty)return false;}}
        if(!dirty)return true;using var prompt=new Form{Text="Giữ bản chỉnh của bạn",StartPosition=FormStartPosition.CenterParent,FormBorderStyle=FormBorderStyle.FixedDialog,MinimizeBox=false,MaximizeBox=false,ShowInTaskbar=false,ClientSize=new Size(580,178)};
        var label=new Label{Text="Bạn còn nháp hoặc nội dung chưa áp dụng.\nQuay lại để áp dụng và lưu, hoặc bỏ bản chỉnh khi đóng cửa sổ.",Dock=DockStyle.Top,Height=97,Padding=new Padding(22),AutoSize=false};
        var buttons=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=65,Padding=new Padding(12),FlowDirection=FlowDirection.RightToLeft};
        var keep=new Button{Text="Tiếp tục chỉnh",DialogResult=DialogResult.Cancel,AutoSize=true};var discard=new Button{Text="Bỏ nháp và đóng",DialogResult=DialogResult.No,AutoSize=true};var save=new Button{Text="Quay lại để lưu",DialogResult=DialogResult.Yes,AutoSize=true};buttons.Controls.AddRange(new Control[]{keep,discard,save});prompt.Controls.Add(label);prompt.Controls.Add(buttons);prompt.AcceptButton=keep;prompt.CancelButton=keep;
        var result=prompt.ShowDialog(this);if(result==DialogResult.Yes){Activate();web.Focus();_ = web.CoreWebView2?.ExecuteScriptAsync("(document.getElementById('caption-dialog')?.open?document.getElementById('caption-apply'):document.getElementById('content-dialog')?.open?document.getElementById('content-apply'):document.getElementById('save'))?.focus();");status.Text="Áp dụng bản chỉnh nếu còn trong dialog, rồi bấm Lưu dự án trước khi đóng.";}return result==DialogResult.No;
    }
    void Freeze(bool value){web.Enabled=!value;studioMenu.Enabled=!value;}
    async void OnStudioClosing(object? sender,FormClosingEventArgs e){if(forceClose){SaveBoundsSetting();return;}e.Cancel=true;try{if(await closing.RunAsync(CanCloseAsync,()=>Task.CompletedTask,Freeze)){forceClose=true;Close();}}catch{status.Text="Chưa thể đóng cửa sổ. Nháp vẫn giữ nguyên.";}}
    async Task QuitFully()
    {
        if(session is null||!session.OwnsBackend)return;quit.Enabled=false;
        if(smoke)WriteOperation("idle-quit","CHECKING",null);
        try{if(await closing.RunAsync(CanCloseAsync,()=>session.QuitWhenIdleAsync(lifetime.Token),Freeze)){if(smoke)WriteOperation("idle-quit","VERIFIED",null);forceClose=true;Close();}else if(smoke)WriteOperation("idle-quit","HELD","UNSAVED_DRAFT_OR_CLOSE_PENDING");}
        catch(Exception e){status.Text=FriendlyError(e.Message);if(smoke)WriteOperation("idle-quit","FAILED",e.Message);quit.Enabled=session.OwnsBackend&&session.IsAlive;}
    }
    async Task ListenActivation()
    {
        while(!lifetime.IsCancellationRequested)try{using var pipe=new NamedPipeServerStream(pipeName,PipeDirection.In,1,PipeTransmissionMode.Byte,PipeOptions.Asynchronous|PipeOptions.CurrentUserOnly);await pipe.WaitForConnectionAsync(lifetime.Token);var buffer=new byte[9];var n=await pipe.ReadAsync(buffer,lifetime.Token);if(Encoding.UTF8.GetString(buffer,0,n)=="activate\n")BeginInvoke(new Action(()=>{if(WindowState==FormWindowState.Minimized)WindowState=FormWindowState.Normal;Show();Activate();}));}catch(OperationCanceledException){return;}catch{if(!lifetime.IsCancellationRequested)await Task.Delay(250);}
    }
    void RestoreBoundsSetting()
    {
        var area=Screen.PrimaryScreen?.WorkingArea??new Rectangle(0,0,1400,900);var desired=new Rectangle(area.Left+(area.Width-Math.Min(1400,area.Width))/2,area.Top+(area.Height-Math.Min(950,area.Height))/2,1400,950);
        try{var f=Path.Combine(local,"window.json");if(File.Exists(f)&&new FileInfo(f).Length<4096){var r=JsonSerializer.Deserialize<Rectangle>(File.ReadAllText(f));if(r.Width>0&&r.Height>0)desired=r;}}catch{}
        var restored=DesktopContracts.ClampWindowBounds(desired,Screen.AllScreens.OrderByDescending(s=>s.Primary).Select(s=>s.WorkingArea).ToArray());MinimumSize=new Size(Math.Min(1024,restored.Width),Math.Min(720,restored.Height));StartPosition=FormStartPosition.Manual;Bounds=restored;
    }
    void SaveBoundsSetting(){try{Directory.CreateDirectory(local);File.WriteAllText(Path.Combine(local,"window.json"),JsonSerializer.Serialize(WindowState==FormWindowState.Normal?Bounds:RestoreBounds));}catch{}}
    async Task SmokeCapture()
    {
        if(smokeRecorded)return;smokeRecorded=true;try{bool ready=false;for(int n=0;n<60;n++){var text=await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify({ready:!!document.getElementById('open-captions')&&!!document.getElementById('open-content'),title:document.title})");var decoded=JsonSerializer.Deserialize<string>(text);if(decoded is not null){using var state=JsonDocument.Parse(decoded);ready=state.RootElement.GetProperty("ready").GetBoolean();if(ready)break;}await Task.Delay(150,lifetime.Token);}if(!ready)throw new InvalidOperationException("DESKTOP_UI_NOT_READY");
            var dir=Path.Combine(manifest.Root,".runtime/desktop-qa");Directory.CreateDirectory(dir);using(var file=File.Create(Path.Combine(dir,"window.png")))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,file);
            WriteSmoke(new{status="VERIFIED",windowTitle=Text,iconPresent=Icon is not null,width=ClientSize.Width,height=ClientSize.Height,dpi=DeviceDpi,workingAreas=Screen.AllScreens.Select(s=>s.WorkingArea).ToArray(),bounds=Bounds,webViewVersion=web.CoreWebView2.Environment.BrowserVersionString,backendPid=session?.Identity.Pid,rootHash=session?.Identity.RootHash,ownsBackend=session?.OwnsBackend,sourceHead=manifest.SourceHead,checks=new[]{"real-winforms-window","real-webview2","authenticated-bootstrap-and-process","caption-content-ui-ready","capture-preview"},providerRequests=0});
        }catch(Exception e){WriteSmoke(new{status="FAILED",error=e.GetType().Name,detail=FriendlyError(e.Message)});}
    }
    void WriteSmoke(object receipt){try{var dir=Path.Combine(manifest.Root,".runtime/desktop-qa");Directory.CreateDirectory(dir);File.WriteAllText(Path.Combine(dir,"smoke.json"),JsonSerializer.Serialize(receipt,new JsonSerializerOptions(JsonSerializerDefaults.Web){WriteIndented=true}));}catch{}}
    void WriteOperation(string operation,string result,string? error){try{var code=error is not null&&System.Text.RegularExpressions.Regex.IsMatch(error,"^[A-Z0-9_]{1,80}$")?error:null;var dir=Path.Combine(manifest.Root,".runtime/desktop-qa");Directory.CreateDirectory(dir);File.WriteAllText(Path.Combine(dir,"operation.json"),JsonSerializer.Serialize(new{operation,status=result,error=code,errorType=error is null?null:"operation-error",nativeStatusWidth=status.Width,nativeStatusHeight=status.Height,ownsBackend=session?.OwnsBackend,at=DateTimeOffset.UtcNow},DesktopContracts.JsonOptions));}catch{}}
    public static string FriendlyError(string code)=>code switch
    {
        "PORT_BUSY"=>"Cổng 20130 đang có phiên chưa xác minh đúng dự án. Kiểm tra phiên cũ; app không dừng tiến trình đó.",
        "DESKTOP_ROOT_MISSING" or "DESKTOP_ROOT_CHANGED"=>"Thư mục Jarvis-Video thiếu hoặc đã chuyển vị trí. Giữ nguyên dữ liệu và build lại app theo hướng dẫn.",
        "DESKTOP_RUNTIME_MISSING"=>"Thiếu Node hoặc PowerShell đã khai báo. Kiểm tra desktop-manifest.json; chưa tự cài thành phần mới.",
        "DESKTOP_WEBVIEW_RUNTIME_MISSING"=>"Không tìm thấy WebView2 Runtime hợp lệ. Kiểm tra runtime hoặc đường dẫn browser rồi mở lại app. App chưa tự cài thêm thành phần.",
        "DESKTOP_BUSY" or "DESKTOP_UNKNOWN"=>"Chưa thể thoát hoàn toàn: có tác vụ đang chạy hoặc cần kiểm tra. Backend và dữ liệu vẫn được giữ.",
        "DESKTOP_NOT_OWNER" or "DESKTOP_OWNER_CHANGED"=>"Backend thuộc phiên khác. Có thể đóng cửa sổ; app không dừng phiên đó.",
        "DESKTOP_BACKEND_TIMEOUT"=>"Backend chưa sẵn sàng sau 15 giây. Xem log .runtime/studio/launcher và mở lại kết nối khi đã kiểm tra.",
        _=>"Không mở được thành phần app: "+code+". Giữ model/dự án; kiểm tra hướng dẫn desktop."
    };
}
