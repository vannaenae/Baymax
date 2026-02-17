#!/usr/bin/env bash
set -euo pipefail

if curl -fsS http://127.0.0.1:18793/health >/dev/null; then
  echo "✅ Bridge healthy"
else
  echo "⚠️ Bridge not running"
fi
