#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

if [ ! -f package.json ]; then
  npm init -y >/dev/null 2>&1
fi

if [ ! -d node_modules/ws ]; then
  npm i ws >/dev/null 2>&1
fi

# stop old bridge process (macOS-safe without lsof)
if pgrep -f "bridge-server.js" >/dev/null 2>&1; then
  pgrep -f "bridge-server.js" | xargs kill -9 || true
fi

mkdir -p .runtime
nohup node bridge-server.js > .runtime/bridge.log 2>&1 &
echo $! > .runtime/bridge.pid

sleep 1
if curl -fsS http://127.0.0.1:18793/health >/dev/null; then
  echo "✅ Bridge running: ws://127.0.0.1:18793/relay"
else
  echo "❌ Bridge failed to start. Check .runtime/bridge.log"
  exit 1
fi
