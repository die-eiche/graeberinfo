#!/usr/bin/env bash
# Mountet die Synology-Freigaben über Tailscale (100.80.9.127) nach
#   /mnt/nas-public  = G:  (\\synology\public)
#   /mnt/nas-web     = WEB (\\synology\web)
#
# Erwartete Umgebungsgeheimnisse (Cloud-Agent-Environment):
#   TAILSCALE_AUTHKEY  wiederverwendbarer Auth-Key, Tailnet angern.de
#   SMB_USERNAME       Synology-Konto mit Schreibrecht auf public und/oder web
#   SMB_PASSWORD
set -euo pipefail

NAS_HOST="${NAS_TAILSCALE_HOST:-100.80.9.127}"
PUBLIC_MNT="${NAS_PUBLIC_MNT:-/mnt/nas-public}"
WEB_MNT="${NAS_WEB_MNT:-/mnt/nas-web}"
TS_HOSTNAME="${TAILSCALE_HOSTNAME:-cursor-graeberinfo}"

need_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    exec sudo -E -- "$0" "$@"
  fi
}

have_mount() {
  local mnt="$1"
  mountpoint -q "$mnt" 2>/dev/null
}

ensure_pkgs() {
  if ! command -v tailscale >/dev/null 2>&1; then
    curl -fsSL https://tailscale.com/install.sh | sh
  fi
  if ! command -v mount.cifs >/dev/null 2>&1; then
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq cifs-utils
  fi
}

tailscale_up() {
  if [[ -z "${TAILSCALE_AUTHKEY:-}" ]]; then
    echo "TAILSCALE_AUTHKEY fehlt – NAS ist ohne Tailnet nicht erreichbar." >&2
    return 1
  fi
  if ! tailscale status --json >/dev/null 2>&1; then
    tailscaled --state=/var/lib/tailscale/tailscaled.state --socket=/var/run/tailscale/tailscaled.sock >/var/log/tailscaled.log 2>&1 &
    local i
    for i in $(seq 1 20); do
      if tailscale status >/dev/null 2>&1 || [[ -S /var/run/tailscale/tailscaled.sock ]]; then
        break
      fi
      sleep 0.3
    done
  fi
  if tailscale status --json 2>/dev/null | grep -q '"BackendState": "Running"'; then
    return 0
  fi
  tailscale up --authkey="$TAILSCALE_AUTHKEY" --hostname="$TS_HOSTNAME" --accept-routes --timeout=30s
}

cifs_opts() {
  local opts="vers=3.0,iocharset=utf8,file_mode=0664,dir_mode=0775,nounix,noserverino"
  if [[ -n "${SMB_USERNAME:-}" ]]; then
    opts+=",username=${SMB_USERNAME},password=${SMB_PASSWORD:-}"
  else
    opts+=",guest,username=guest"
  fi
  printf '%s' "$opts"
}

mount_share() {
  local share="$1" mnt="$2"
  mkdir -p "$mnt"
  if have_mount "$mnt"; then
    echo "bereits gemountet: $mnt"
    return 0
  fi
  if mount -t cifs "//${NAS_HOST}/${share}" "$mnt" -o "$(cifs_opts)"; then
    echo "gemountet: //${NAS_HOST}/${share} -> $mnt"
    return 0
  fi
  echo "Mount fehlgeschlagen: //${NAS_HOST}/${share}" >&2
  return 1
}

need_root "$@"
ensure_pkgs
tailscale_up

ok=0
mount_share public "$PUBLIC_MNT" && ok=1 || true
mount_share web "$WEB_MNT" && ok=1 || true
if [[ "$ok" -eq 0 ]]; then
  echo "Keine Synology-Freigabe erreichbar." >&2
  exit 1
fi
ls -ld "$PUBLIC_MNT" "$WEB_MNT" 2>/dev/null || true
