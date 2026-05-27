#!/bin/bash
# Safe deploy script — checks git status before deploying to Railway

echo "🔍 Checking git status..."

# Fetch latest from remote
git fetch origin main --quiet

# Check if behind
BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null)
if [ "$BEHIND" -gt 0 ]; then
  echo ""
  echo "❌ STOP — You are $BEHIND commit(s) behind origin/main."
  echo "   Someone pushed changes you don't have."
  echo ""
  echo "   Run: git pull origin main"
  echo "   Then run: ./deploy.sh again"
  echo ""
  exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo ""
  echo "⚠️  WARNING: You have uncommitted changes."
  echo "   These will NOT be deployed unless you commit them first."
  echo ""
  echo "   Uncommitted files:"
  git diff --name-only HEAD
  echo ""
  read -p "   Deploy anyway? (y/N) " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Cancelled. Commit your changes first then run ./deploy.sh"
    exit 1
  fi
fi

# Check ahead (unpushed commits)
AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null)
if [ "$AHEAD" -gt 0 ]; then
  echo "⚠️  You have $AHEAD unpushed commit(s). Pushing to GitHub first..."
  git push origin main
fi

echo ""
echo "✅ All good — deploying to Railway..."
railway service 'Wish-Training' 2>/dev/null
railway up --detach
echo "🚀 Deploy started. Check: https://wish-app-production.up.railway.app"
