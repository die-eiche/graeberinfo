#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_TARGET="${1:-//synology/web/grabbuch}"
PUBLIC_TARGET="${2:-//synology/public}"

cd "$ROOT"
npm run build:grabbuch

if [ ! -d "$WEB_TARGET" ]; then
  echo ""
  echo "Web-Ziel nicht erreichbar: $WEB_TARGET"
  echo "Bitte Freigabe mounten: \\\\synology\\web\\grabbuch"
  exit 1
fi

if [ ! -d "$PUBLIC_TARGET" ]; then
  echo ""
  echo "Public-Ziel nicht erreichbar: $PUBLIC_TARGET"
  echo "Bitte Freigabe mounten: \\\\synology\\public"
  exit 1
fi

rsync -av "$ROOT/synology/web/grabbuch/" "$WEB_TARGET/"
rsync -av "$ROOT/synology/public/" "$PUBLIC_TARGET/"

echo ""
echo "Deploy abgeschlossen."
echo "  Web:    $WEB_TARGET  →  http://synology/grabbuch/"
echo "  Public: $PUBLIC_TARGET  →  http://synology/public/bilder/"
echo "  Suche:  http://synology/grabbuch/suche/"
