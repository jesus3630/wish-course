#!/usr/bin/env bash
#
# Deploy by uploading the current code, then tell you how to verify it.
#
# Use this when a `git push` did not trigger a build. It has happened more than
# once: the commit sits correct on GitHub while the old container keeps serving,
# which looks exactly like a bug in your change.
#
# Note `railway redeploy` does NOT help — it rebuilds the SAME commit, so it looks
# like you retried when you didn't. Only an upload (or a build Railway actually
# triggers from git) ships new code.
#
# Usage:  ./scripts/deploy-now.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

SERVICE="${SERVICE:-Wish-Training}"
SHA="$(git rev-parse HEAD)"
SHORT="${SHA:0:7}"

if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  Working tree is dirty. Uploading it as-is, but ${SHORT} will not match what is on GitHub."
  echo "    Commit first if you want the running commit to be meaningful."
  echo ""
fi

# Stamp the commit into the build so /api/version can report what is running.
# Railway sets RAILWAY_GIT_COMMIT_SHA only for git-triggered builds; an upload has
# no idea what commit it came from unless we tell it.
#
# The file is TRACKED, holding a placeholder in git. It must not be gitignored:
# `railway up` honours .gitignore, so an ignored stamp is silently left out of the
# upload and /api/version reports null — which looks identical to having no stamp
# at all. We write the real value, upload, then restore the placeholder so the
# working tree does not stay dirty.
restore_stamp() { git checkout -- server/version.json 2>/dev/null || true; }
trap restore_stamp EXIT

printf '{"commit":"%s","builtAt":"%s"}\n' "$SHA" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > server/version.json
echo "🏷  Stamped ${SHORT} into server/version.json"

echo "⬆️  Uploading to Railway service ${SERVICE}..."
railway up --service "$SERVICE" --detach

echo ""
echo "Now verify it actually landed — do not assume:"
echo ""
echo "    ./scripts/watch-deploy.sh $SHA"
echo ""
