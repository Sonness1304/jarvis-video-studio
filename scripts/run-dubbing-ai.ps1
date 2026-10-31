param([Parameter(Mandatory=$true)][ValidatePattern('^job-[a-f0-9-]{36}$')][string]$JobId)
$ErrorActionPreference = 'Stop'
$contentRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$contentConfig = Get-Content -LiteralPath (Join-Path $contentRoot 'content-connector.json') -Raw | ConvertFrom-Json
try {
    if ($contentConfig.endpoint -ne 'http://127.0.0.1:20128/v1') { throw 'CONTENT_ENDPOINT_CHANGED' }
    $contentHash = (Get-FileHash -LiteralPath $contentConfig.savedKeyLoader -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($contentHash -ne $contentConfig.loaderSha256) { throw 'CONTENT_LOADER_CHANGED' }
    . $contentConfig.savedKeyLoader
    & $env:JARVIS_CONTENT_NODE (Join-Path $contentRoot 'src/dubbing-ai-worker.mjs') $JobId
    exit $LASTEXITCODE
} catch {
    # No provider body, credential or PowerShell exception is emitted to logs.
    Write-Output '{"status":"FAILED","error":"DUB_TRANSLATION_CONNECTOR_FAILED"}'
    exit 1
} finally {
    Remove-Item Env:JARVIS_GATEWAY_KEY -ErrorAction SilentlyContinue
}
