# Kopiert Abfrage und werhatdienst auf den Synology-NAS
# Ausführen in PowerShell auf dem Windows-PC, wenn G: verbunden ist.

$ErrorActionPreference = "Stop"

$sourceRoot = $PSScriptRoot
# G: ist bei Synology meist die Freigabe "public" selbst, nicht G:\public\
$targetRoot = "G:\Ehrenamt"

if (-not (Test-Path $targetRoot)) {
    throw "Zielordner nicht gefunden: $targetRoot"
}

$folders = @("Abfrage", "werhatdienst")

foreach ($folder in $folders) {
    $source = Join-Path $sourceRoot $folder
    $target = Join-Path $targetRoot $folder

    if (-not (Test-Path $source)) {
        throw "Quellordner fehlt: $source"
    }

    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Copy-Item -Path (Join-Path $source "*") -Destination $target -Recurse -Force
    Write-Host "Kopiert: $source -> $target"
}

Write-Host ""
Write-Host "Fertig."
Write-Host "1. Container Manager -> Projekt in G:\Ehrenamt\Abfrage erstellen"
Write-Host "2. Web Station: Ordner werhatdienst freigeben oder statisch bereitstellen"
Write-Host "3. App oeffnen: http://<NAS-IP>/Ehrenamt/werhatdienst/ oder ueber Web Station URL"
Write-Host "4. iOS: Safari -> Teilen -> Zum Home-Bildschirm"
