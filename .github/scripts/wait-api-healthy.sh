#!/usr/bin/env bash
# Block until the api answers `GET /health` with `status: ok`.
#
# Used by the release workflows between the api deploy and the web
# build: if the web image prerenders against the live api, building
# while the api container restarts bakes 502s into the static pages.
#
# Usage: wait-api-healthy.sh <base-url> [restart-from-uptime]
#
# When `restart-from-uptime` is given, the script first waits for the
# reported `uptime_seconds` to DROP below it — proof the new container
# replaced the old one — before accepting the health check. Without it,
# the old process would answer 200 right up until Dokploy kills it.
set -euo pipefail

BASE_URL="${1:?base url required}"
PREV_UPTIME="${2:-}"
# `0` means the pre-deploy probe failed (api was already down), so there
# is no old uptime to compare against — fall back to a plain health wait
# instead of blocking forever on a drop that can never happen.
[ "$PREV_UPTIME" = "0" ] && PREV_UPTIME=""
DEADLINE=$((SECONDS + 600))
STABLE_NEEDED=3
stable=0

while ((SECONDS < DEADLINE)); do
  body=$(curl -fsS --max-time 10 "${BASE_URL%/}/health" 2>/dev/null || true)
  # Tolerate pretty-printed JSON (spaces after the colon).
  status=$(printf '%s' "$body" | grep -oE '"status"[[:space:]]*:[[:space:]]*"[a-z]+"' | grep -oE '[a-z]+"$' | tr -d '"' || true)
  uptime=$(printf '%s' "$body" | grep -oE '"uptime_seconds"[[:space:]]*:[[:space:]]*[0-9]+' | grep -oE '[0-9]+$' || true)

  if [ "$status" = "ok" ] && [ -n "$uptime" ]; then
    if [ -z "$PREV_UPTIME" ] || [ "$uptime" -lt "$PREV_UPTIME" ]; then
      stable=$((stable + 1))
      echo "api healthy (uptime=${uptime}s) ${stable}/${STABLE_NEEDED}"
      if ((stable >= STABLE_NEEDED)); then
        echo "api ready"
        exit 0
      fi
    else
      stable=0
      echo "waiting for restart (uptime=${uptime}s, was >=${PREV_UPTIME}s)"
    fi
  else
    stable=0
    echo "api not ready yet (status=${status:-unreachable})"
  fi
  sleep 5
done

echo "::error::api never became healthy at ${BASE_URL}/health"
exit 1
