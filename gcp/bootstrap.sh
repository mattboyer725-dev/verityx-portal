#!/usr/bin/env bash
# One-time Google Cloud project setup for VerityX Cloud Run + Cloud SQL.
# Run from the repo root in Cloud Shell. Does not print secret values.
# Idempotent: re-running will not rotate an existing SQL password or secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_ID="${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-us-central1}"
SQL_INSTANCE="${SQL_INSTANCE:-verityx-pg}"
AR_REPO="${AR_REPO:-verityx}"
SERVICE="${SERVICE:-verityx}"
DB_NAME="${DB_NAME:-verityx}"
DB_USER="${DB_USER:-verityx}"
AVAILABILITY="${AVAILABILITY:-REGIONAL}"
RUN_SA="${RUN_SA:-verityx-run}"
BUILD_SA="${BUILD_SA:-verityx-build}"

gcloud config set project "$PROJECT_ID"

gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  storage.googleapis.com

gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" >/dev/null 2>&1 \
  || gcloud artifacts repositories create "$AR_REPO" \
      --repository-format=docker \
      --location="$REGION" \
      --description="VerityX Cloud Run images"

ensure_sa() {
  local name="$1" display="$2"
  gcloud iam service-accounts describe "${name}@${PROJECT_ID}.iam.gserviceaccount.com" >/dev/null 2>&1 \
    || gcloud iam service-accounts create "$name" --display-name="$display"
}

ensure_sa "$RUN_SA" "VerityX Cloud Run"
ensure_sa "$BUILD_SA" "VerityX Cloud Build"

grant_project() {
  local member="$1" role="$2"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="$member" \
    --role="$role" \
    --condition=None \
    --quiet >/dev/null
}

RUN_MEMBER="serviceAccount:${RUN_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
BUILD_MEMBER="serviceAccount:${BUILD_SA}@${PROJECT_ID}.iam.gserviceaccount.com"

for ROLE in roles/cloudsql.client roles/secretmanager.secretAccessor roles/logging.logWriter; do
  grant_project "$RUN_MEMBER" "$ROLE"
done

for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/secretmanager.secretAccessor \
  roles/logging.logWriter \
  roles/cloudbuild.builds.builder \
  roles/cloudsql.client; do
  grant_project "$BUILD_MEMBER" "$ROLE"
done

gcloud iam service-accounts add-iam-policy-binding "${RUN_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --member="$BUILD_MEMBER" \
  --role="roles/iam.serviceAccountUser" \
  --quiet >/dev/null

# Cloud Build service agent must impersonate the user-specified build SA.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
gcloud iam service-accounts add-iam-policy-binding "${BUILD_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --quiet >/dev/null

# Cloud Run pulls the image as the Cloud Run service agent, not the runtime SA.
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" \
  --location="$REGION" \
  --member="serviceAccount:service-${PROJECT_NUMBER}@serverless-robot-prod.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.reader" \
  --quiet >/dev/null
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" \
  --location="$REGION" \
  --member="$BUILD_MEMBER" \
  --role="roles/artifactregistry.writer" \
  --quiet >/dev/null

if ! gcloud sql instances describe "$SQL_INSTANCE" >/dev/null 2>&1; then
  gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 \
    --tier=db-custom-1-3840 \
    --region="$REGION" \
    --availability-type="$AVAILABILITY" \
    --storage-size=20GB \
    --storage-auto-increase \
    --storage-type=SSD \
    --backup-start-time=07:00 \
    --retained-backups-count=7 \
    --enable-point-in-time-recovery \
    --maintenance-window-day=SUN \
    --maintenance-window-hour=8 \
    --deletion-protection \
    --insights-config-query-insights-enabled
fi

gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" >/dev/null 2>&1 \
  || gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE"

if [[ -z "${DB_PASSWORD:-}" ]]; then
  DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
fi

# Never rotate an existing password: a re-run would desync Secret Manager.
if gcloud secrets describe verityx-database-url >/dev/null 2>&1; then
  echo "Keeping existing verityx-database-url secret (SQL password not rotated)."
else
  gcloud sql users create "$DB_USER" \
    --instance="$SQL_INSTANCE" \
    --password="$DB_PASSWORD" \
    --type=BUILT_IN \
    --database-roles=cloudsqlsuperuser >/dev/null 2>&1 \
    || gcloud sql users create "$DB_USER" \
      --instance="$SQL_INSTANCE" \
      --password="$DB_PASSWORD" >/dev/null 2>&1 \
    || gcloud sql users set-password "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASSWORD"
  printf '%s' "postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}" \
    | gcloud secrets create verityx-database-url --replication-policy=automatic --data-file=-
fi

ensure_secret() {
  local name="$1" value="$2"
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets create "$name" --replication-policy=automatic --data-file=-
  fi
}

ensure_secret verityx-better-auth-secret "$(openssl rand -hex 32)"
ensure_secret verityx-better-auth-url "https://${SERVICE}-PLACEHOLDER.run.app"
ensure_secret verityx-grok-auth-client-id "replace-me"
ensure_secret verityx-grok-auth-client-secret "replace-me"

for SECRET in \
  verityx-database-url \
  verityx-better-auth-secret \
  verityx-better-auth-url \
  verityx-grok-auth-client-id \
  verityx-grok-auth-client-secret; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="$RUN_MEMBER" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="$BUILD_MEMBER" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
done

# Cloud Build writes BETTER_AUTH_URL after the first Cloud Run URL exists.
gcloud secrets add-iam-policy-binding verityx-better-auth-url \
  --member="$BUILD_MEMBER" \
  --role="roles/secretmanager.secretVersionAdder" \
  --quiet >/dev/null

CONN="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
echo "Bootstrap done."
echo "  Cloud SQL: $CONN"
echo "  Runtime SA: ${RUN_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "  Build SA:   ${BUILD_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "  Next:"
echo "    1. Put the Grok broker client id/secret into Secret Manager"
echo "       (verityx-grok-auth-client-id / verityx-grok-auth-client-secret)."
echo "    2. ./gcp/deploy.sh"
echo "  After the first Cloud Run URL exists, BETTER_AUTH_URL is set automatically."
echo "  Custom domain: gcloud run domain-mappings create --service=$SERVICE --domain=verityx.example.com --region=$REGION"
echo "  then: AUTH_URL=https://verityx.example.com ./gcp/deploy.sh"
