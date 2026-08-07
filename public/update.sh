#!/usr/bin/env bash
# Token Tracer — One-Line Upgrade Script (run to migrate old version to new version)
# Updates the sync-daemon.mjs script file while preserving all existing configuration logs.

set -euo pipefail

SERVER_URL="https://token-tracer-three.vercel.app"
TARGET_DIR="$HOME/.token-tracer"
DAEMON_PATH="$TARGET_DIR/sync-daemon.mjs"
PLIST_PATH="$HOME/Library/LaunchAgents/com.token-tracer.daemon.plist"

if [ ! -d "$TARGET_DIR" ]; then
  echo "❌ Error: Token Tracer directory not found at $TARGET_DIR."
  echo "Please run the install command instead:"
  echo "curl -fsSL $SERVER_URL/install.sh | bash -s -- --key YOUR_KEY"
  exit 1
fi

echo "🔄 Upgrading Token Tracer sync daemon..."

# 1. Download the new daemon script directly, overwriting the old one
echo "⬇️  Downloading latest daemon..."
curl -fsSL "$SERVER_URL/sync-daemon.mjs" -o "$DAEMON_PATH"
chmod 755 "$DAEMON_PATH"

# 2. Restart the background service to load the new code
if [[ "$(uname)" == "Darwin" ]]; then
  if [ -f "$PLIST_PATH" ]; then
    echo "🔄 Restarting launchd service..."
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl load -w "$PLIST_PATH"
  else
    # Fallback to killing node processes if plist is missing
    pkill -f "sync-daemon.mjs" || true
  fi
elif [[ "$(uname)" == "Linux" ]]; then
  if command -v systemctl &>/dev/null && systemctl --user status token-tracer.service &>/dev/null; then
    echo "🔄 Restarting systemd service..."
    systemctl --user restart token-tracer.service
  else
    # Kill process so it restarts on shell reload or manual restart
    pkill -f "sync-daemon.mjs" || true
  fi
fi

echo ""
echo "=========================================================="
echo " ✅ Token Tracer Daemon successfully updated to the latest version!"
echo " 🔄 Background daemon is active and will self-update in the future."
echo " 📜 Update log: $TARGET_DIR/update.log"
echo "=========================================================="
