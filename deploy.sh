#!/bin/bash
# Safe deploy for the WISH training portal.
#   ./deploy.sh "commit message"          → sync mockup, commit, push, deploy
#   ./deploy.sh --build "commit message"  → also rebuild the React client first
#
# Guarantees, in order:
#   1. You are NOT behind origin/main (stops you clobbering someone's work)
#   2. public/mockup -> build/mockup is in sync (the "changes don't show" bug)
#   3. (optional) the React client is rebuilt from source
#   4. protected demo functions are still present
#   5. commit -> push -> Railway deploy
set -e

BUILD=0
if [ "$1" == "--build" ]; then BUILD=1; shift; fi
MSG="$1"

echo "🔍 Fetching origin/main..."
git fetch origin main --quiet

BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
if [ "$BEHIND" -gt 0 ]; then
  echo "❌ STOP — you are $BEHIND commit(s) behind origin/main. Someone pushed changes you don't have."
  echo "   Run: git pull origin main   then re-run ./deploy.sh"
  exit 1
fi

# 2. Keep the demo mockup in sync (the pre-commit hook also does this — belt & suspenders)
if ! cmp -s client/public/mockup/mockup.html client/build/mockup/mockup.html; then
  echo "🔁 Syncing public/mockup -> build/mockup"
  cp client/public/mockup/mockup.html client/build/mockup/mockup.html
fi

# 3. Optional React rebuild
if [ "$BUILD" -eq 1 ]; then
  echo "🏗  Rebuilding React client..."
  ( cd client && CI=false npm run build >/dev/null )
fi

# 4. Guard: protected demo functions must still exist
for fn in addEditJobFormHTML showAddShiftModal showAddRolePanel; do
  if ! grep -q "function $fn" client/public/mockup/mockup.html; then
    echo "❌ STOP — protected function $fn is missing from mockup.html. Aborting."
    exit 1
  fi
done

# 5. Commit anything outstanding
if ! git diff-index --quiet HEAD --; then
  if [ -z "$MSG" ]; then
    echo "⚠️  You have uncommitted changes but gave no commit message."
    echo "   Usage: ./deploy.sh \"what you changed\"   (add --build for React changes)"
    exit 1
  fi
  git add -A
  git commit -m "$MSG"
fi

AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
if [ "$AHEAD" -gt 0 ]; then
  echo "⬆️  Pushing $AHEAD commit(s) to GitHub..."
  git push origin main
fi

# 6. Deploy = the push above. The live site (wishtrainingtest.com, Railway project
#    "Wish-course") auto-deploys from GitHub main — no `railway up` needed.
if [ "$AHEAD" -gt 0 ]; then
  echo "🚀 Pushed — wishtrainingtest.com auto-deploys from GitHub main (~1-2 min)."
else
  echo "ℹ️  Nothing to push. To force a redeploy without changes, use the Railway dashboard → Redeploy."
fi
echo "✅ Live: https://www.wishtrainingtest.com"
