param([switch]$VerifyOnly)
$ErrorActionPreference = 'Stop'
$asrRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$asrLock = Get-Content -LiteralPath (Join-Path $asrRoot 'asr-runtime.lock.json') -Raw | ConvertFrom-Json
$asrPython = Join-Path $asrRoot $asrLock.pythonPath
if (-not (Test-Path -LiteralPath $asrPython)) {
    if ($VerifyOnly) { throw 'VOICE_ASR_RUNTIME_MISSING' }
    $asrConfig = Get-Content -LiteralPath (Join-Path $asrRoot 'runtime-config.json') -Raw | ConvertFrom-Json
    $asrBase = Join-Path $asrRoot $asrConfig.paths.python
    if ((Get-FileHash -LiteralPath $asrBase -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asrConfig.hashes.python) { throw 'VOICE_ASR_BASE_CHANGED' }
    & $asrBase -I -m venv (Join-Path $asrRoot '.venv-asr')
    if ($LASTEXITCODE -ne 0) { throw 'VOICE_ASR_SETUP_FAILED' }
    & $asrPython -I -m pip install --disable-pip-version-check -r (Join-Path $asrRoot 'requirements-asr.lock')
    if ($LASTEXITCODE -ne 0) { throw 'VOICE_ASR_SETUP_FAILED' }
}
if ((Get-FileHash -LiteralPath $asrPython -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asrLock.pythonSha256) { throw 'VOICE_ASR_RUNTIME_CHANGED' }
& $asrPython -I -m pip check
if ($LASTEXITCODE -ne 0) { throw 'VOICE_ASR_DEPENDENCY_FAILED' }
$asrCheck = @"
import hashlib,importlib.metadata,json,pathlib,sys
root=pathlib.Path(sys.argv[1]);lock=json.loads((root/'asr-runtime.lock.json').read_text())
assert sys.version.split()[0]==lock['pythonVersion'],'VOICE_ASR_RUNTIME_CHANGED'
assert all(importlib.metadata.version(k)==v for k,v in lock['packages'].items()),'VOICE_ASR_RUNTIME_CHANGED'
model=pathlib.Path.home()/'AppData/Local/OmniVoice/hf_cache/models--Systran--faster-whisper-small/snapshots'/lock['modelRevision']
assert all(hashlib.sha256((model/k).read_bytes()).hexdigest()==v for k,v in lock['files'].items()),'VOICE_ASR_MODEL_CHANGED'
import faster_whisper,ctranslate2
print('ASR_RUNTIME_PINS_VERIFIED; INFERENCE_NOT_RUN')
"@
& $asrPython -I -c $asrCheck $asrRoot
if ($LASTEXITCODE -ne 0) { throw 'VOICE_ASR_VERIFY_FAILED' }
