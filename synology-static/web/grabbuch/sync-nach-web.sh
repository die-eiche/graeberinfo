#!/usr/bin/env bash
# Kopiert die Grabbuch-Webdateien auf die Synology.
# Reihenfolge:
#   1) bereits gemountetes /mnt/nas-web oder /mnt/nas-public
#   2) G:\ bzw. Windows-Pfade, falls dieser Rechner sie hat
#   3) mount-nas.sh (Tailscale + CIFS), danach erneut 1)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT"
PUBLIC_MNT="${NAS_PUBLIC_MNT:-/mnt/nas-public}"
WEB_MNT="${NAS_WEB_MNT:-/mnt/nas-web}"
FILES=(
  auswertung.html
  auswertung-mobil.html
  besucher.html
  besucher.php
  besucher-statistik.js
  dienste.html
  besucher-erfassung.js
  zaehlung.php
  aufrufe-statistik.js
)

copy_files() {
  local dest="$1"
  mkdir -p "$dest"
  local name
  for name in "${FILES[@]}"; do
    if [[ -f "$SRC/$name" ]]; then
      cp -f "$SRC/$name" "$dest/$name"
      echo "  $name -> $dest"
    fi
  done
}

web_dest=""
public_dest=""

if [[ -d "$WEB_MNT/grabbuch" ]] || mountpoint -q "$WEB_MNT" 2>/dev/null; then
  web_dest="$WEB_MNT/grabbuch"
elif [[ -d /mnt/g/Grabbuch ]]; then
  public_dest="/mnt/g/Grabbuch"
elif [[ -d "$PUBLIC_MNT/Grabbuch" ]] || mountpoint -q "$PUBLIC_MNT" 2>/dev/null; then
  public_dest="$PUBLIC_MNT/Grabbuch"
fi

if [[ -z "$web_dest" && -z "$public_dest" ]]; then
  if [[ -x "$ROOT/mount-nas.sh" ]]; then
    "$ROOT/mount-nas.sh" || true
  fi
  if [[ -d "$WEB_MNT/grabbuch" ]] || mountpoint -q "$WEB_MNT" 2>/dev/null; then
    web_dest="$WEB_MNT/grabbuch"
  fi
  if [[ -d "$PUBLIC_MNT/Grabbuch" ]] || mountpoint -q "$PUBLIC_MNT" 2>/dev/null; then
    public_dest="$PUBLIC_MNT/Grabbuch"
  fi
fi

if [[ -n "$web_dest" ]]; then
  echo "Schreibe Web-Freigabe: $web_dest"
  copy_files "$web_dest"
  mkdir -p "$web_dest/web/grabbuch"
  copy_files "$web_dest/web/grabbuch"
elif [[ -n "$public_dest" ]]; then
  echo "Schreibe public/G: $public_dest (Web Station zieht bei nächstem besucher.php-Aufruf nach)"
  copy_files "$public_dest"
else
  echo "Weder Web- noch public-Freigabe erreichbar." >&2
  echo "Bitte TAILSCALE_AUTHKEY und SMB-Zugang in den Cloud-Agent-Geheimnissen hinterlegen" >&2
  echo "oder auf dem Windows-PC 'cursor worker start' mit gemapptem G: laufen lassen." >&2
  exit 1
fi

NAS_HTTP="${NAS_HTTP:-http://100.80.9.127}"
curl -fsS -m 8 "${NAS_HTTP}/grabbuch/besucher.php?action=load" >/dev/null 2>&1 || true
echo "Fertig."
echo "  ${NAS_HTTP}/grabbuch/dienste.html"
echo "  ${NAS_HTTP}/grabbuch/auswertung.html"
