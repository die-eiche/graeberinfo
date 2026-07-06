#!/usr/bin/env bash
# Weiterleitung – bitte sync-synology.sh verwenden
exec "$(dirname "$0")/sync-synology.sh" "$@"
