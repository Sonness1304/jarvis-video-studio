$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $studioRoot
try { node (Join-Path $studioRoot 'src/editor-server.mjs'); $studioExit = $LASTEXITCODE } finally { Pop-Location }
exit $studioExit
