#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "XcodeGen fehlt. Installieren mit: brew install xcodegen"
  exit 1
fi

if [[ ! -d Vendor/HBCI4Swift/HBCI4Swift ]]; then
  echo "Vendor/HBCI4Swift fehlt. Bitte Repository vollständig auschecken."
  exit 1
fi

xcodegen generate
echo "Xcode-Projekt erzeugt: KontoauszugSender.xcodeproj"
echo "Öffnen mit: open KontoauszugSender.xcodeproj"
