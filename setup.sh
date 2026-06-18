#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env (Google OAuth values are optional)."
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install Node 18+ first." >&2
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node $NODE_MAJOR is too old. Install Node 18+." >&2
  exit 1
fi

npm install

echo
echo "Setup complete."
echo "  npm run dev       — start dev server on http://localhost:3000"
echo "  npm run dev -- -H 0.0.0.0   — expose on LAN for phone testing"
echo "  npm test          — run unit tests"
