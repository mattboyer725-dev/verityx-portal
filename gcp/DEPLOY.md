# VerityX on Google Cloud

Production host is **Cloud Run** (Node 22, Nitro `node-server`) talking to **Cloud SQL for PostgreSQL 16**. Secrets live in **Secret Manager**. Images live in **Artifact Registry**. Builds run as a dedicated `verityx-build` service account.

The Grok preview and Vercel deploys stay on Vercel. This path is the real-life Google Cloud install.

## What you get

| Piece | Product |
|---|---|
| HTTPS app | Cloud Run gen2, min 1 instance, 2 GiB, always-on CPU |
| Database | Cloud SQL Postgres 16, regional HA, PITR, deletion protection, unix socket from Cloud Run |
| Secrets | Secret Manager → env on the service |
| CI | Cloud Build (`gcp/cloudbuild.yaml`) |
| Identity | Same Better Auth / Grok broker as today; `BETTER_AUTH_URL` is the Cloud Run (or custom) origin |

Health: `/health/live` (process) and `/health/ready` (Postgres + migrations). Cloud Run **startup** waits on ready, so a revision does not take traffic until Cloud SQL answers. **Liveness** is live-only, so a brief DB blip does not kill the process.

Production **refuses** the in-memory PGLite fallback (`GCP_RUNTIME=1`). Schema is applied on first ready probe under a Postgres advisory lock (safe with min/max instances).

Rough idle cost in `us-central1`: Cloud Run min-1 + Cloud SQL regional `db-custom-1-3840` is on the order of a few hundred USD/month. Scale the SQL tier when the desk is busy.

## One-time bootstrap (Cloud Shell)

Billing must be enabled on the project. You need `roles/owner` (or equivalent) for the first run.

```bash
export PROJECT_ID=your-gcp-project
export REGION=us-central1
export SQL_INSTANCE=verityx-pg
gcloud config set project "$PROJECT_ID"
chmod +x gcp/bootstrap.sh gcp/deploy.sh
./gcp/bootstrap.sh
```

The script is idempotent and will not rotate an existing SQL password.

Then put the real Grok broker values in Secret Manager (placeholders are `replace-me`):

```bash
printf '%s' 'YOUR_GROK_AUTH_CLIENT_ID'     | gcloud secrets versions add verityx-grok-auth-client-id --data-file=-
printf '%s' 'YOUR_GROK_AUTH_CLIENT_SECRET' | gcloud secrets versions add verityx-grok-auth-client-secret --data-file=-
```

Optional Stripe (attach **after** the first deploy). Use `--update-secrets` so you do **not** wipe DATABASE_URL / auth secrets. Grant the runtime SA access on the new secrets:

```bash
printf '%s' 'sk_live_…' | gcloud secrets create verityx-stripe-secret --data-file=-
printf '%s' 'whsec_…'   | gcloud secrets create verityx-stripe-webhook --data-file=-
for S in verityx-stripe-secret verityx-stripe-webhook; do
  gcloud secrets add-iam-policy-binding "$S" \
    --member="serviceAccount:verityx-run@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
gcloud run services update verityx --region=$REGION \
  --update-secrets=STRIPE_SECRET_KEY=verityx-stripe-secret:latest,STRIPE_WEBHOOK_SECRET=verityx-stripe-webhook:latest
```

## Deploy

```bash
./gcp/deploy.sh
```

Same thing, explicit:

```bash
gcloud builds submit --config gcp/cloudbuild.yaml \
  --substitutions=_REGION=$REGION,_SERVICE=verityx,_AR_REPO=verityx,_SQL=$PROJECT_ID:$REGION:$SQL_INSTANCE
```

Cloud Build will:

1. Docker-build Nitro `node-server` (auth flag baked in)
2. Push to Artifact Registry
3. Deploy Cloud Run with Cloud SQL + secrets
4. If `BETTER_AUTH_URL` is still the placeholder, set it to the `*.run.app` URL and roll a second revision

Register these redirect URIs on the Grok broker client (same client id/secret you put in Secret Manager):

```
https://<Cloud Run URL>/api/auth/oauth2/callback/grok-google
https://<Cloud Run URL>/api/auth/oauth2/callback/grok-x
```

Wire a Cloud Build GitHub trigger on `main` with those substitutions (`2nd gen`, repository connected under Cloud Build → Triggers). The build service account is `verityx-build@PROJECT.iam.gserviceaccount.com`.

## Custom domain

```bash
gcloud run domain-mappings create --service=verityx --domain=verityx.example.com --region=$REGION
```

Then redeploy with the public origin:

```bash
AUTH_URL=https://verityx.example.com ./gcp/deploy.sh
```

Re-register the broker callbacks for the custom origin, and point Stripe webhooks at `https://verityx.example.com/api/billing/stripe/webhook`.

## Required env (never commit, never bake into the image)

| Name | Why |
|---|---|
| `DATABASE_URL` | Cloud SQL user/password/db (`postgresql://verityx:…@/verityx`). Unix socket host is added at runtime from `CLOUD_SQL_CONNECTION_NAME` |
| `CLOUD_SQL_CONNECTION_NAME` | `project:region:instance` — Cloud Run mounts `/cloudsql/…` |
| `BETTER_AUTH_URL` | Public HTTPS origin |
| `BETTER_AUTH_SECRET` | Session signing |
| `GROK_AUTH_CLIENT_ID` / `GROK_AUTH_CLIENT_SECRET` | Broker federation |
| `FRONTEND_ORIGINS` | Optional extra CORS allowlist (set automatically to the public origin) |
| `GCP_RUNTIME=1` | Fail closed if Postgres is missing |
| `HOST=0.0.0.0` `PORT=8080` | Cloud Run contract |

`VITE_AUTH_ENABLED=true` is baked into the image at Docker build. Do not write a `.env` file in this repo.

## Local image check (your machine / Cloud Build)

```bash
NITRO_PRESET=node-server npm run build:gcp
HOST=0.0.0.0 PORT=8080 GCP_RUNTIME=1 node .output/server/index.mjs
```

Without `DATABASE_URL`, `/health/live` is 200 and `/health/ready` is **503**. That is the fail-closed contract. Do not run this on the Grok preview port.

## After go-live

```bash
./gcp/check.sh
```

That must print `Cloud Run is live` (`/health/ready` → `{"status":"ready","db":true}`). Then sign in once (Grok broker) and open the magnetics desk.

- Cloud SQL backups: 07:00 UTC, 7 retained, point-in-time recovery on
- To upsize SQL: `gcloud sql instances patch verityx-pg --tier=db-custom-2-7680`
- Optional Stripe secrets as above
