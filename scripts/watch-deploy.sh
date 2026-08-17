#!/usr/bin/env bash
#
# Watch a deploy until the change is genuinely live, then say so.
#
# Why this exists: pushing to main usually auto-deploys, but not always. When it
# silently doesn't, the code is correct on GitHub while the old container keeps
# serving — and every check you run looks like a bug in your code rather than a
# deploy that never happened. Worse, `railway redeploy` rebuilds the SAME commit,
# so it looks like you retried when you didn't.
#
# This watches /api/version, which reports the commit the server is actually
# running, and refuses to say "live" until that matches the commit you pushed.
#
# Usage:
#   scripts/watch-deploy.sh                # watch for current HEAD to go live
#   scripts/watch-deploy.sh <sha>          # watch for a specific commit
#   TIMEOUT=900 scripts/watch-deploy.sh    # give it longer (default 600s)
#
# Exit codes: 0 live · 1 timed out · 2 deploy never triggered · 3 site unhealthy

set -uo pipefail

SITE="${SITE:-https://www.wishtrainingtest.com}"
TIMEOUT="${TIMEOUT:-600}"
INTERVAL="${INTERVAL:-10}"
WANT="${1:-$(git rev-parse HEAD 2>/dev/null)}"
WANT_SHORT="${WANT:0:7}"
PUSHED_AT_EPOCH="$(date +%s)"

if [ -z "$WANT" ]; then
  echo "watch-deploy: no commit to watch for (not a git repo?)" >&2
  exit 3
fi

echo "watch-deploy: waiting for ${WANT_SHORT} on ${SITE}"

deadline=$(( PUSHED_AT_EPOCH + TIMEOUT ))
warned_no_trigger=0

while :; do
  now=$(date +%s)
  if [ "$now" -ge "$deadline" ]; then
    echo "TIMED OUT after ${TIMEOUT}s — ${WANT_SHORT} is still not live."
    echo "  Most likely the push did not trigger a deploy."
    echo "  Fix: railway up --service Wish-Training --detach   (redeploy rebuilds the SAME commit, it will not help)"
    exit 1
  fi

  version_json="$(curl -fsS --max-time 15 "${SITE}/api/version" 2>/dev/null)" || version_json=""

  # The SPA fallback answers unknown GETs with index.html and a 200, so a
  # successful curl proves nothing. Only treat it as the endpoint if it is JSON
  # carrying the field we asked for — otherwise the old build is still serving.
  case "$version_json" in
    *'"bootedAt"'*) ;;
    *) version_json="" ;;
  esac

  if [ -n "$version_json" ]; then
    live_commit="$(printf '%s' "$version_json" | sed -n 's/.*"commit":"\([^"]*\)".*/\1/p')"
    booted_at="$(printf '%s' "$version_json" | sed -n 's/.*"bootedAt":"\([^"]*\)".*/\1/p')"
    uptime_s="$(printf '%s' "$version_json" | sed -n 's/.*"uptimeSeconds":\([0-9]*\).*/\1/p')"

    if [ -n "$live_commit" ] && [ "$live_commit" = "$WANT" ]; then
      # Commit matches. Confirm the app is actually serving before declaring victory —
      # a container that boots and then fails its first request is not a good deploy.
      course_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${SITE}/api/course")"
      root_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${SITE}/")"
      if [ "$course_code" = "200" ] && [ "$root_code" = "200" ]; then
        echo "LIVE — ${WANT_SHORT} is serving (booted ${booted_at}, up ${uptime_s}s)."
        exit 0
      fi
      echo "UNHEALTHY — ${WANT_SHORT} deployed but the app is not serving (/=${root_code} /api/course=${course_code})."
      exit 3
    fi

    # The endpoint exists but reports no commit: the code was uploaded with
    # `railway up` rather than built from git. Fall back to "did it restart after
    # I started watching", which is the only signal available in that case.
    if [ -z "$live_commit" ] && [ -n "$uptime_s" ] && [ "$uptime_s" -lt "$(( now - PUSHED_AT_EPOCH + 60 ))" ]; then
      echo "LIVE — server restarted since the push (no commit reported; uploaded build). Up ${uptime_s}s."
      exit 0
    fi
  fi

  # Halfway through with no movement is the shape of a push that never triggered.
  elapsed=$(( now - PUSHED_AT_EPOCH ))
  if [ "$warned_no_trigger" -eq 0 ] && [ "$elapsed" -gt $(( TIMEOUT / 2 )) ]; then
    warned_no_trigger=1
    echo "STILL WAITING after ${elapsed}s — no deploy of ${WANT_SHORT} yet. If this was a push, it may not have triggered one."
  fi

  sleep "$INTERVAL"
done
