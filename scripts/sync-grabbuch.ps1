# Weiterleitung – bitte sync-synology.ps1 verwenden
& (Join-Path (Split-Path $MyInvocation.MyCommand.Path) "sync-synology.ps1") @args
