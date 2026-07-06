param(
    [string]$Target = "\\synology\grabbuch"
)

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

npm run build:grabbuch
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not (Test-Path $Target)) {
    Write-Host ""
    Write-Host "Ziel nicht erreichbar: $Target"
    Write-Host "Bitte Synology-Freigabe im Explorer verbinden (\\synology\grabbuch)."
    exit 1
}

robocopy "$Root\grabbuch" $Target /E /XO /NFL /NDL /NJH /NJS /nc /ns /np
if ($LASTEXITCODE -ge 8) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Deploy abgeschlossen: $Target"
Write-Host "  Grabbuch:  http://synology/grabbuch/"
Write-Host "  Suche:     http://synology/grabbuch/suche/"
