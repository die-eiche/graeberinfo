#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/synology/public"
cp -r "$ROOT/synology-static/public/." "$ROOT/synology/public/"
