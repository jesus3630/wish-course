#!/bin/bash
# Run this at the START of every work session.
# Pulls the latest main and makes sure the safety hooks are active,
# so you never start working on stale code or with the guards off.
set -e

echo "⬇️  Pulling latest main..."
git pull origin main

# Make sure the shared hooks (auto-mockup-sync + protected-function guard) are on
git config core.hooksPath .githooks
echo "✅ Hooks active (core.hooksPath = .githooks)"

# The React build output (client/build/static, index.html) is no longer committed —
# Railway rebuilds it on deploy. For LOCAL serving we need it once. Build if missing.
if [ ! -f client/build/index.html ] || [ ! -d client/build/static ]; then
  echo "🏗  React build output missing — building client once for local use..."
  ( cd client && CI=false npm install && npm run build )
fi

echo ""
echo "You're up to date. Start the local server with:  node server/index.js  (→ localhost:3001)"
echo "When you're done, deploy with:  ./deploy.sh \"what you changed\"   (add --build for React changes)"
