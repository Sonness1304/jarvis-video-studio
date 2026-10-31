using System.IO.Pipes;
using System.Security.Principal;
using System.Runtime.InteropServices;

namespace VideoStudio.Desktop;

internal static class Program
{
    [STAThread]static int Main(string[] args)
    {
        SetCurrentProcessExplicitAppUserModelID("Jarvis.VideoStudio.Desktop");
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
        try{
            if(args.Any(a=>a!="--smoke")||args.Length>1)throw new InvalidOperationException("DESKTOP_ARGUMENTS_INVALID");
            var manifest=DesktopContracts.ReadManifest(Path.Combine(AppContext.BaseDirectory,"desktop-manifest.json"));
            var sid=WindowsIdentity.GetCurrent().User?.Value??throw new InvalidOperationException("DESKTOP_USER_UNKNOWN");var name="JarvisVideoStudio-"+sid+"-"+manifest.RootHash;
            using var mutex=new Mutex(true,"Local\\"+name,out var created);
            if(!created){using var pipe=new NamedPipeClientStream(".",name,PipeDirection.Out,PipeOptions.CurrentUserOnly);pipe.Connect(2500);pipe.Write("activate\n"u8);return 0;}
            try{using var window=new StudioWindow(manifest,name,args.Contains("--smoke"));Application.Run(window);}finally{mutex.ReleaseMutex();}return 0;
        }catch(Exception e){MessageBox.Show("Chưa mở được Video Studio.\n\n"+StudioWindow.FriendlyError(e.Message),"Jarvis Video Studio",MessageBoxButtons.OK,MessageBoxIcon.Information);return 1;}
    }
    [DllImport("shell32.dll",CharSet=CharSet.Unicode)]static extern int SetCurrentProcessExplicitAppUserModelID(string appId);
}
