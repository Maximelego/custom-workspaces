#!/usr/bin/env bash
set -euo pipefail

UUID="custom-workspaces@maximelego.local"
TARGET="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "[+] Installing to: $TARGET"
rm -rf "$TARGET"
mkdir -p "$TARGET"

cp -r extension/* "$TARGET/"
mkdir -p "$TARGET/schemas"
cp -r schemas/* "$TARGET/schemas/"

if command -v glib-compile-schemas >/dev/null 2>&1; then
  echo "[+] Compiling schemas..."
  glib-compile-schemas "$TARGET/schemas" || true
fi

echo "[+] Reloading extension (disable/enable)..."
gnome-extensions disable "$UUID" >/dev/null 2>&1 || true
gnome-extensions enable "$UUID" >/dev/null 2>&1 || true

echo "[OK] Installed. If nothing happens, log out / log in."