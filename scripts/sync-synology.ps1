param(
    [string]$WebTarget = "\\synology\web\grabbuch",
    [string]$PublicTarget = "\\synology\public"
)

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

npm run build:grabbuch
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not (Test-Path $WebTarget)) {
    Write-Host ""
    Write-Host "Web-Ziel nicht erreichbar: $WebTarget"
    Write-Host "Bitte Freigabe verbinden: \\synology\web\grabbuch"
    exit 1
}

if (-not (Test-Path $PublicTarget)) {
    Write-Host ""
    Write-Host "Public-Ziel nicht erreichbar: $PublicTarget"
    Write-Host "Bitte Freigabe verbinden: \\synology\public"
    exit 1
}

robocopy "$Root\synology\web\grabbuch" $WebTarget /E /XO /NFL /NDL /NJH /NJS /nc /ns /np
if ($LASTEXITCODE -ge 8) { exit $LASTEXITCODE }

robocopy "$Root\synology\public" $PublicTarget /E /XO /NFL /NDL /NJH /NJS /nc /ns /np
if ($LASTEXITCODE -ge 8) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Deploy abgeschlossen."
Write-Host "  Web:    $WebTarget"
Write-Host "  Public: $PublicTarget"
Write-Host "  Suche:  http://synology/grabbuch/suche/"
