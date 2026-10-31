$ErrorActionPreference='Stop'
$studioRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$toolsRoot=Join-Path $studioRoot '.tools/motion-lab'
New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
foreach($file in @('package.json','package-lock.json')) {
 Copy-Item -LiteralPath (Join-Path $studioRoot ('tooling/motion-lab/'+$file)) -Destination (Join-Path $toolsRoot $file)
}
& npm ci --prefix $toolsRoot --ignore-scripts --no-audit --no-fund
if($LASTEXITCODE -ne 0){throw 'MOTION_LAB_TOOL_SETUP_FAILED'}
Write-Output '{"status":"VERIFIED","scope":"local QR tools only","modelDownloads":0}'
