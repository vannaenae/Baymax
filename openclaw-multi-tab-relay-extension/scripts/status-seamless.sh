#!/usr/bin/env bash
set -euo pipefail

if curl -fsS http://127.0.0.1:18793/health >/dev/null 2>&1; then
  echo "✅ Bridge healthy"
  curl -s http://127.0.0.1:18793/health
  echo
else
  echo "⚠️ Bridge not running"
fi

pgrep -fal "openclaw-multi-tab-relay-extension/scripts/bridge-supervisor.sh" || true
pgrep -fal "openclaw-multi-tab-relay-extension/bridge-server.js" || true
