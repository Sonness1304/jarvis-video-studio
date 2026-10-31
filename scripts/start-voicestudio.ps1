$ErrorActionPreference = 'Stop'
$taskExe = Join-Path $env:LOCALAPPDATA 'Programs/VoiceStudio/VoiceStudio.exe'
if (!(Test-Path -LiteralPath $taskExe)) { throw 'VoiceStudio chua cai tai CurrentUser Programs/VoiceStudio' }
# Electron owns the single-instance lock; never stop an existing app or backend.
$taskNames = 'OMNIVOICE_PRELOAD_CAPTURE_ASR','OMNIVOICE_PRELOAD_WATERMARK','OMNIVOICE_PRELOAD_TTS_ASR','OMNIVOICE_BACKEND_CMD'
$taskPrevious = @{}
try {
    foreach ($taskName in $taskNames) { $taskPrevious[$taskName] = [Environment]::GetEnvironmentVariable($taskName,'Process') }
    foreach ($taskName in $taskNames[0..2]) { [Environment]::SetEnvironmentVariable($taskName,'0','Process') }
    $taskLocation = Get-Content -LiteralPath (Join-Path $env:APPDATA 'VoiceStudio/runtime-location.json') -Raw | ConvertFrom-Json
    $taskProject = Join-Path ([IO.Path]::GetFullPath($taskLocation.root)) 'project'
    $taskPython = Join-Path $taskProject '.venv/Scripts/python.exe'
    if (!(Test-Path -LiteralPath $taskPython)) { throw 'VOICE_RUNTIME_MISSING' }
    $taskBootstrap = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../src/voicestudio_bootstrap.py'))
    $taskCommand = ConvertTo-Json -InputObject @($taskPython,'-X','utf8',$taskBootstrap,$taskProject) -Compress
    [Environment]::SetEnvironmentVariable('OMNIVOICE_BACKEND_CMD',$taskCommand,'Process')
    Start-Process -FilePath $taskExe -WindowStyle Normal
} finally {
    foreach ($taskName in $taskNames) { [Environment]::SetEnvironmentVariable($taskName,$taskPrevious[$taskName],'Process') }
}
