#!/usr/bin/env bash
# Build the image in Cloud Build and deploy Cloud Run.
# Requires gcp/bootstrap.sh to have been run in this project.
# Run from anywhere; this script cds to the repo root.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
: "${PROJECT_ID:?set PROJECT_ID or gcloud config set project}"
REGION="${REGION:-us-central1}"
SQL_INSTANCE="${SQL_INSTANCE:-verityx-pg}"
AR_REPO="${AR_REPO:-verityx}"
SERVICE="${SERVICE:-verityx}"
AUTH_URL="${AUTH_URL:-}"

CONN="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"

gcloud config set project "$PROJECT_ID"

exec gcloud builds submit --config gcp/cloudbuild.yaml \
  --substitutions=_REGION="${REGION}",_SERVICE="${SERVICE}",_AR_REPO="${AR_REPO}",_SQL="${CONN}",_AUTH_URL="${AUTH_URL}"
