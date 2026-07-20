#!/usr/bin/env bash
# Token Tracer — One-Line Mac Background Sync Installer
# Usage:
#   curl -fsSL https://token-tracer-three.vercel.app/install.sh | bash -s -- --key av_live_YOUR_KEY

set -e

SERVER_URL="https://token-tracer-three.vercel.app"
API_KEY=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --key|-k)
      API_KEY="$2"
      shift 2
      ;;
    --server|-s)
      SERVER_URL="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [ -z "$API_KEY" ]; then
  echo "❌ Error: Missing --key argument."
  echo "Usage: curl -fsSL https://token-tracer-three.vercel.app/install.sh | bash -s -- --key av_live_YOUR_KEY"
  exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Error: Node.js is not installed on this Mac."
  echo "Please install Node.js (v18+) from https://nodejs.org or via 'brew install node' and try again."
  exit 1
fi

NODE_PATH=$(command -v node)

# Prepare ~/.token-tracer directory
TARGET_DIR="$HOME/.token-tracer"
mkdir -p "$TARGET_DIR"

echo "📦 Installing Token Tracer background sync agent in $TARGET_DIR..."

# Save config.json
cat << EOF > "$TARGET_DIR/config.json"
{
  "apiUrl": "$SERVER_URL",
  "apiKey": "$API_KEY",
  "intervalMin": 10
}
EOF

# Download standalone sync-daemon.mjs
echo "⬇️ Downloading background sync daemon..."
curl -fsSL "$SERVER_URL/sync-daemon.mjs" -o "$TARGET_DIR/sync-daemon.mjs"
chmod +x "$TARGET_DIR/sync-daemon.mjs"

# Create launchd plist
PLIST_PATH="$HOME/Library/LaunchAgents/com.token-tracer.daemon.plist"
mkdir -p "$HOME/Library/LaunchAgents"

cat << EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.token-tracer.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>$TARGET_DIR/sync-daemon.mjs</string>
        <string>--config</string>
        <string>$TARGET_DIR/config.json</string>
        <string>--state</string>
        <string>$TARGET_DIR/sync-state.json</string>
        <string>--log</string>
        <string>$TARGET_DIR/sync.log</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$TARGET_DIR/launchd.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$TARGET_DIR/launchd.stderr.log</string>
</dict>
</plist>
EOF

# Unload existing daemon if present, then load new daemon
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load -w "$PLIST_PATH"

echo ""
echo "=========================================================="
echo " ✅ Token Tracer background sync agent successfully installed!"
echo " 🔄 Background daemon active: syncing every 10 minutes."
echo " 📁 Config location: $TARGET_DIR/config.json"
echo " 📜 Log file location: $TARGET_DIR/sync.log"
echo "=========================================================="
