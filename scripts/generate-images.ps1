param(
    [string]$Model = 'cx/gpt-6.1-sol'
)
$ErrorActionPreference = 'Stop'
$s = (Get-ChildItem -Path './OneDrive' -Filter 'use-9router-key.ps1' -Recurse -File | Select-Object -First 1).FullName
. $s

$outDir = 'outputs/mot-chut-khoa-hoc-turbofan-20261022'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force }

$prompts = Get-Content 'recipes/turbofan/v1/image-prompts.json' -Raw | ConvertFrom-Json

function Generate-OneImage {
    param([string]$Prompt, [string]$OutFile, [string]$ModelName)
    Write-Output "Generating image with model $ModelName..."
    $body = @{
        model = $ModelName
        prompt = $Prompt
        n = 1
        size = '1024x1792'
    } | ConvertTo-Json

    try {
        $res = Invoke-RestMethod -Uri 'http://127.0.0.1:20128/v1/images/generations' -Method Post -Headers @{
            Authorization = "Bearer $env:JARVIS_GATEWAY_KEY"
            'Content-Type' = 'application/json'
        } -Body $body -TimeoutSec 120

        $b64 = $res.data[0].b64_json
        if ($b64) {
            $bytes = [Convert]::FromBase64String($b64)
            [IO.File]::WriteAllBytes($OutFile, $bytes)
            Write-Output "Successfully saved $OutFile ($($bytes.Length) bytes)"
            return $true
        }
    } catch {
        Write-Output "Model $ModelName failed: $($_.ErrorDetails.Message)"
        return $false
    }
    return $false
}

# Try Codex model first, then fallback to Gemini/Claude
$coverFile = Join-Path $outDir $prompts.cover.file
$contextFile = Join-Path $outDir $prompts.context.file

# Check if cover already exists
if (-not (Test-Path $coverFile)) {
    Write-Output "--- GENERATING COVER ---"
    $ok = Generate-OneImage -Prompt $prompts.cover.prompt -OutFile $coverFile -ModelName 'cx/gpt-6.1-sol'
    if (-not $ok) {
        Write-Output "Fallback to ag/gemini-3.8-flash for cover..."
        Generate-OneImage -Prompt $prompts.cover.prompt -OutFile $coverFile -ModelName 'ag/gemini-3.8-flash'
    }
} else {
    Write-Output "Cover already exists at $coverFile"
}

if (-not (Test-Path $contextFile)) {
    Write-Output "--- GENERATING CONTEXT ---"
    $ok = Generate-OneImage -Prompt $prompts.context.prompt -OutFile $contextFile -ModelName 'cx/gpt-6.1-sol'
    if (-not $ok) {
        Write-Output "Fallback to ag/gemini-3.8-flash for context..."
        Generate-OneImage -Prompt $prompts.context.prompt -OutFile $contextFile -ModelName 'ag/gemini-3.8-flash'
    }
} else {
    Write-Output "Context already exists at $contextFile"
}
