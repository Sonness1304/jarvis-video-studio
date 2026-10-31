param([switch]$Status,[switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$studioRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$studioUrl = 'http://127.0.0.1:20130'

function Get-StudioReadiness {
    $studioListeners = @(Get-NetTCPConnection -LocalPort 20130 -State Listen -ErrorAction SilentlyContinue)
    if ($studioListeners.Count -eq 0) { return 'STOPPED' }
    try {
        $studioPage = Invoke-WebRequest -Uri ($studioUrl + '/') -SessionVariable studioSession -TimeoutSec 2
        if ($studioPage.Content -notmatch '<title>Jarvis Video Studio</title>') { return 'PORT_BUSY' }
        $studioBoot = Invoke-RestMethod -Uri ($studioUrl + '/api/bootstrap') -WebSession $studioSession -TimeoutSec 2
        if (-not $studioBoot.csrf -or -not $studioBoot.catalog.templates) { return 'PORT_BUSY' }
        return 'READY'
    } catch { return 'PORT_BUSY' }
}

$studioState = Get-StudioReadiness
if ($Status) {
    @{status=$studioState;url=$studioUrl;launched=$false} | ConvertTo-Json -Compress
    exit 0
}
if ($studioState -eq 'PORT_BUSY') { throw 'Port 20130 is occupied or Studio is still starting. No process was stopped. Try again after checking the existing app.' }
$studioLaunched = $false
if ($studioState -eq 'STOPPED') {
    $studioNode = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    $studioLogDir = Join-Path $studioRoot '.runtime/studio/launcher'
    New-Item -ItemType Directory -Path $studioLogDir -Force | Out-Null
    $studioStamp = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
    $studioOut = Join-Path $studioLogDir ($studioStamp + '.out.log')
    $studioErr = Join-Path $studioLogDir ($studioStamp + '.err.log')
    $studioEntry = Join-Path $studioRoot 'src/editor-server.mjs'
    $studioChild = Start-Process -FilePath $studioNode -ArgumentList @('"' + $studioEntry + '"') -WorkingDirectory $studioRoot -WindowStyle Hidden -RedirectStandardOutput $studioOut -RedirectStandardError $studioErr -PassThru
    $studioLaunched = $true
    $studioTimer = [Diagnostics.Stopwatch]::StartNew()
    do {
        Start-Sleep -Milliseconds 250
        $studioChild.Refresh()
        if ($studioChild.HasExited) { throw ('Studio exited. Read log: ' + $studioErr) }
        $studioState = Get-StudioReadiness
    } while ($studioState -ne 'READY' -and $studioTimer.Elapsed.TotalSeconds -lt 15)
    if ($studioState -ne 'READY') { throw ('Studio has not become ready. Keep any existing process; read log: ' + $studioErr) }
    @{pid=$studioChild.Id;root=$studioRoot;stdout=$studioOut;stderr=$studioErr;startedAt=[DateTimeOffset]::Now.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $studioLogDir 'last-launch.json') -Encoding utf8
}
if (-not $NoBrowser) { Start-Process -FilePath $studioUrl | Out-Null }
@{status='READY';url=$studioUrl;launched=$studioLaunched;mediaApiRequests=0} | ConvertTo-Json -Compress
