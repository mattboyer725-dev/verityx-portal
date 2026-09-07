#!/usr/bin/env bash
# Post-deploy health check against the live Cloud Run URL.
# Usage: ./gcp/check.sh [https://verityx-….run.app]
set -euo pipefail

REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-verityx}"
URL="${1:-}"

if [[ -z "$URL" ]]; then
  URL="$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')"
fi
: "${URL:?no Cloud Run URL — pass it or deploy first}"

echo "Checking $URL"

live="$(curl -fsS --max-time 15 "${URL}/health/live")"
echo "live:  $live"
echo "$live" | grep -q '"status":"ok"'

ready="$(curl -fsS --max-time 20 "${URL}/health/ready")"
echo "ready: $ready"
echo "$ready" | grep -q '"status":"ready"'

root="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 20 "${URL}/")"
echo "hub:   $root"
[[ "$root" == "200" ]]

echo "Cloud Run is live."
