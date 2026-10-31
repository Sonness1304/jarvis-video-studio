$ErrorActionPreference='Stop'
$studioRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$publishRoot=Join-Path $studioRoot 'desktop-dist/VideoStudio'
$studioExe=(Resolve-Path -LiteralPath (Join-Path $publishRoot 'Jarvis Video Studio.exe')).Path
$manifest=Get-Content -LiteralPath (Join-Path $publishRoot 'desktop-manifest.json') -Raw | ConvertFrom-Json
$receipt=Get-Content -LiteralPath (Join-Path $publishRoot 'build-receipt.json') -Raw | ConvertFrom-Json
if($manifest.root -ne $studioRoot -or $receipt.status -ne 'VERIFIED' -or $manifest.sourceHead -ne $receipt.sourceHead){throw 'DESKTOP_BUILD_NOT_VERIFIED'}
$exeProof=$receipt.files | Where-Object {$_.path -eq 'Jarvis Video Studio.exe'}
if(-not $exeProof -or (Get-FileHash -LiteralPath $studioExe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $exeProof.sha256){throw 'DESKTOP_EXECUTABLE_CHANGED'}
$userDesktop=[Environment]::GetFolderPath('DesktopDirectory')
if(-not (Test-Path -LiteralPath $userDesktop -PathType Container)){throw 'CURRENT_USER_DESKTOP_MISSING'}
$shortcut=Join-Path $userDesktop 'Jarvis Video Studio.lnk'
$number=2
while(Test-Path -LiteralPath $shortcut){$shortcut=Join-Path $userDesktop ('Jarvis Video Studio ('+$number+').lnk');$number++}
$shell=New-Object -ComObject WScript.Shell
$link=$shell.CreateShortcut($shortcut)
$link.TargetPath=$studioExe
$link.WorkingDirectory=$publishRoot
$link.IconLocation=$studioExe+',0'
$link.Description='Jarvis Video Studio — video AI local, dùng model hiện có'
$link.Save()
$readback=$shell.CreateShortcut($shortcut)
if($readback.TargetPath -ne $studioExe -or $readback.WorkingDirectory -ne $publishRoot -or $readback.IconLocation -ne $studioExe+',0'){throw 'DESKTOP_SHORTCUT_READBACK_FAILED'}
@{status='VERIFIED';shortcut=$shortcut;target=$studioExe;workingDirectory=$publishRoot;overwroteExisting=$false;startup=$false;providerRequests=0} | ConvertTo-Json -Compress
