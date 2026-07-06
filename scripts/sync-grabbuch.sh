#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-//synology/grabbuch}"

cd "$ROOT"
npm run build:grabbuch

if [ ! -d "$TARGET" ]; then
  echo ""
  echo "Ziel nicht erreichbar: $TARGET"
  echo "Bitte Synology-Freigabe mounten, z. B.:"
  echo "  sudo mkdir -p /mnt/synology/grabbuch"
  echo "  sudo mount -t cifs //synology/grabbuch /mnt/synology/grabbuch"
  echo ""
  echo "Oder Pfad als Argument: ./scripts/sync-grabbuch.sh /mnt/synology/grabbuch"
  exit 1
fi

rsync -av "$ROOT/grabbuch/" "$TARGET/"
echo ""
echo "Deploy abgeschlossen: $TARGET"
echo "  Grabbuch:  http://synology/grabbuch/"
echo "  Suche:     http://synology/grabbuch/suche/"
