param()
$ErrorActionPreference='Stop'
$videoRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $videoRoot
node src/comfy-launch.mjs
exit $LASTEXITCODE
