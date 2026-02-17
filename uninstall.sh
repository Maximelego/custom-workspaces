#!/usr/bin/env bash
set -euo pipefail

UUID="custom-workspaces@maximelego.local"
TARGET="$HOME/.local/share/gnome-shell/extensions/$UUID"

gnome-extensions disable "$UUID" >/dev/null 2>&1 || true
rm -rf "$TARGET"

echo "[OK] Uninstalled."
