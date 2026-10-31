param([switch]$InitializeLock)
$ErrorActionPreference='Stop'
$studioRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$desktopRoot=Join-Path $studioRoot 'desktop'
$publishRoot=[IO.Path]::GetFullPath((Join-Path $studioRoot 'desktop-dist/VideoStudio'))
if(-not $publishRoot.StartsWith($studioRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'DESKTOP_OUTPUT_OUTSIDE_ROOT'}
$studioNode=(Get-Command node -CommandType Application | Select-Object -First 1).Source
$studioPwsh=(Get-Command pwsh -CommandType Application | Select-Object -First 1).Source
$env:NUGET_PACKAGES=Join-Path $desktopRoot '.packages'
$env:NUGET_HTTP_CACHE_PATH=Join-Path $desktopRoot '.packages/.http'
$env:DOTNET_CLI_HOME=Join-Path $studioRoot '.runtime/dotnet'
$env:DOTNET_CLI_TELEMETRY_OPTOUT='1'
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE='1'
Push-Location -LiteralPath $desktopRoot
try {
 if((& dotnet --version).Trim() -ne '10.0.402'){throw 'DESKTOP_SDK_MISMATCH'}
 $desktopLock=Join-Path $desktopRoot 'packages.lock.json'
 if($InitializeLock){
  if(Test-Path -LiteralPath $desktopLock){& dotnet restore VideoStudio.Desktop.csproj --locked-mode --runtime win-x64 --configfile NuGet.Config --disable-parallel}
  else{& dotnet restore VideoStudio.Desktop.csproj --runtime win-x64 --configfile NuGet.Config --disable-parallel}
 }else{
  if(-not (Test-Path -LiteralPath $desktopLock)){throw 'DESKTOP_LOCK_REQUIRED'}
  if(@(& git -C $studioRoot status --porcelain).Count){throw 'DESKTOP_SOURCE_DIRTY'}
  & dotnet restore VideoStudio.Desktop.csproj --locked-mode --runtime win-x64 --configfile NuGet.Config --disable-parallel
 }
 if($LASTEXITCODE -ne 0){throw 'DESKTOP_RESTORE_FAILED'}
 $desktopPackages=Get-Content -LiteralPath $desktopLock -Raw | ConvertFrom-Json
 $desktopSdk=@($desktopPackages.dependencies.PSObject.Properties | ForEach-Object {$_.Value.PSObject.Properties} | Where-Object {$_.Name -eq 'Microsoft.Web.WebView2'})[0].Value
 if($desktopSdk.resolved -ne '1.0.4258.31'){throw 'DESKTOP_DEPENDENCY_PIN_MISMATCH'}
 $sdkFolder=Join-Path $env:NUGET_PACKAGES 'microsoft.web.webview2/1.0.4258.31'
 $sdkHash=(Get-Content -LiteralPath (Join-Path $sdkFolder 'microsoft.web.webview2.1.0.4258.31.nupkg.sha512') -Raw).Trim()
 $packageMetadata=Get-Content -LiteralPath (Join-Path $sdkFolder '.nupkg.metadata') -Raw | ConvertFrom-Json
 $archiveHash=[Convert]::ToBase64String([Security.Cryptography.SHA512]::HashData([IO.File]::ReadAllBytes((Join-Path $sdkFolder 'microsoft.web.webview2.1.0.4258.31.nupkg'))))
 if($sdkHash -ne $archiveHash -or $packageMetadata.contentHash -ne $desktopSdk.contentHash -or $packageMetadata.source -ne 'https://api.nuget.org/v3/index.json'){throw 'DESKTOP_DEPENDENCY_HASH_MISMATCH'}
 & dotnet nuget verify (Join-Path $sdkFolder 'microsoft.web.webview2.1.0.4258.31.nupkg') --all --verbosity minimal
 if($LASTEXITCODE -ne 0){throw 'DESKTOP_DEPENDENCY_SIGNATURE_FAILED'}
 $licenseRoot=Join-Path $desktopRoot 'LICENSES'
 New-Item -ItemType Directory -Path $licenseRoot -Force | Out-Null
 $notices=@(Get-ChildItem -LiteralPath $sdkFolder -File | Where-Object {$_.Name -match 'LICENSE|NOTICE'})
 if(-not $notices.Count){throw 'DESKTOP_LICENSE_MISSING'}
 foreach($notice in $notices){Copy-Item -LiteralPath $notice.FullName -Destination (Join-Path $licenseRoot ('WebView2-'+$notice.Name))}
 $iconFile=Join-Path $desktopRoot 'Assets/studio.ico'
 if(-not (Test-Path -LiteralPath $iconFile)){
  Add-Type -AssemblyName System.Drawing
  $images=@()
  foreach($size in @(16,32,48,256)){
   $bitmap=[Drawing.Bitmap]::new($size,$size)
   $graphics=[Drawing.Graphics]::FromImage($bitmap)
   $graphics.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
   $graphics.ScaleTransform($size/256.0,$size/256.0)
   $navy=[Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#193454'))
   $blue=[Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#3569CC'))
   $teal=[Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#7FD5CC'))
   $white=[Drawing.SolidBrush]::new([Drawing.Color]::White)
   $graphics.Clear([Drawing.Color]::Transparent)
   $graphics.FillEllipse($navy,8,8,240,240)
   $graphics.FillRectangle($blue,60,62,136,132)
   $graphics.FillPolygon($white,[Drawing.PointF[]]@([Drawing.PointF]::new(105,88),[Drawing.PointF]::new(166,128),[Drawing.PointF]::new(105,168)))
   foreach($x in @(54,178)){foreach($y in @(56,102,148)){$graphics.FillRectangle($teal,$x,$y,24,22)}}
   $stream=[IO.MemoryStream]::new();$bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png);$images+=,@{size=$size;bytes=$stream.ToArray()}
   $stream.Dispose();$navy.Dispose();$blue.Dispose();$teal.Dispose();$white.Dispose();$graphics.Dispose();$bitmap.Dispose()
  }
  $stream=[IO.File]::Open($iconFile,[IO.FileMode]::CreateNew);$writer=[IO.BinaryWriter]::new($stream)
  try{$writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$images.Count);$offset=6+16*$images.Count
   foreach($im in $images){$dim=if($im.size -eq 256){0}else{$im.size};$writer.Write([byte]$dim);$writer.Write([byte]$dim);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$im.bytes.Length);$writer.Write([uint32]$offset);$offset+=$im.bytes.Length}
   foreach($im in $images){$writer.Write([byte[]]$im.bytes)}
  }finally{$writer.Dispose();$stream.Dispose()}
 }
 if($InitializeLock){@{status='VERIFIED';stage='dependency-lock';package='Microsoft.Web.WebView2';version=$desktopSdk.resolved;archiveSha512=$sdkHash;contentHash=$desktopSdk.contentHash;signature='VERIFIED';published=$false} | ConvertTo-Json -Compress;exit 0}
 & dotnet publish VideoStudio.Desktop.csproj --no-restore --configuration Release --runtime win-x64 --self-contained false --output $publishRoot --maxcpucount:1
 if($LASTEXITCODE -ne 0){throw 'DESKTOP_PUBLISH_FAILED'}
 $identityJson=& $studioNode (Join-Path $studioRoot 'src/desktop-identity.mjs') --root $studioRoot
 if($LASTEXITCODE -ne 0){throw 'DESKTOP_ROOT_INVALID'}
 $identity=$identityJson | ConvertFrom-Json
 $sourceHead=(& git -C $studioRoot rev-parse HEAD).Trim()
 @{schemaVersion=1;root=$studioRoot;realRoot=$identity.realRoot;rootHash=$identity.rootHash;nodeExe=$studioNode;pwshExe=$studioPwsh;origin='http://127.0.0.1:20130';sourceHead=$sourceHead} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $publishRoot 'desktop-manifest.json') -Encoding utf8
 $exeFile=Join-Path $publishRoot 'Jarvis Video Studio.exe'
 $exeBytes=[IO.File]::ReadAllBytes($exeFile)
 $peOffset=[BitConverter]::ToInt32($exeBytes,60)
 if($exeBytes[0] -ne 77 -or $exeBytes[1] -ne 90 -or [BitConverter]::ToUInt32($exeBytes,$peOffset) -ne 17744 -or [BitConverter]::ToUInt16($exeBytes,$peOffset+4) -ne 34404){throw 'DESKTOP_PE_X64_INVALID'}
 $files=@(Get-ChildItem -LiteralPath $publishRoot -Recurse -File | Where-Object {$_.Name -ne 'build-receipt.json'} | ForEach-Object {@{path=[IO.Path]::GetRelativePath($publishRoot,$_.FullName).Replace('\','/');bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}})
 $buildReceipt=@{status='VERIFIED';stage='publish';sourceHead=$sourceHead;sourceDirty=$false;sdk='10.0.402';frameworkDependent=$true;target='net10.0-windows/win-x64';package=@{name='Microsoft.Web.WebView2';version=$desktopSdk.resolved;archiveSha512=$sdkHash;contentHash=$desktopSdk.contentHash;signature='VERIFIED'};files=$files;bytes=($files | Measure-Object -Property bytes -Sum).Sum;codeSigned=$false;modelsBundled=$false;providerRequests=0}
 $buildReceipt | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $publishRoot 'build-receipt.json') -Encoding utf8
 @{status='VERIFIED';exe=$exeFile;bytes=$buildReceipt.bytes;sourceHead=$sourceHead;modelsBundled=$false;providerRequests=0} | ConvertTo-Json -Compress
}finally{Pop-Location}
