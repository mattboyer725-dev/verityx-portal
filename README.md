# VerityX Sovereign — v1.0 live

Three planes plus a signed continuity core. One product.

**Live:** [verityx-portal.vercel.app](https://verityx-portal.vercel.app) — the one URL. The former hosts (sovereign-desk, sgre-live, sovereign-live, live-core, verityx-steel, vxsg-desk) redirect here with their path.

**Hub:** `/` · **Check:** `/check` · **Verify:** `/verify` · **Pricing:** `/pricing` · **OS:** `/work` · **Core:** `/core` · **Command:** `/admin`

| Surface | Who | Path |
|---|---|---|
| Quote check + should-cost | Public | `/check` |
| Receipt verification | Public | `/verify` |
| Pilot request + pricing | Public | `/pilot`, `/pricing` |
| Customer Zero OS | Founder / analyst workspace | `/work` |
| Local Core | HMAC + Merkle doctor (v1.7.0 `0188c84`) | `/core` |
| Owner command | Owner account | `/admin` |

Source: [mattboyer725-dev/verityx-portal](https://github.com/mattboyer725-dev/verityx-portal). The pre-redesign code (desk demo, vendor stand-ins) is kept on branch `claude/archive-pre-provenance` at `532b131`.

## What is live

- Quote check: licensed reference prices (World Bank, USGS, ECB FX), MAD outlier filter, should-cost band, GLEIF identity, UN list screening, GDELT media risk.
- Customer Zero OS advisory rules (`rules-v1.0-soft-prod`). BLOCK never auto-applies.
- HMAC-SHA256 + domain-separated Merkle from [verityx-local-core](https://github.com/mattboyer725-dev/verityx-local-core) v1.7.0 (`0188c84`), persisted to Postgres, with Ed25519 seal receipts verifiable at `/verify`.
- $5,000 / 72-hour pilot (credited to an annual plan; plans at /pricing): request → payment → evidence → human-approved decision → sealed PDF.
- Tenant isolation on every OS query. Stripe checkout + signed webhook + manual admin path.

## What VerityX does not connect to

No ERP or procurement suite (SAP, Ariba, Coupa), ESG rating (EcoVadis), risk feed (Prewave), credit rating, traceability network (Circulor, Minespider), workforce IdP (Okta) or price agency (Argus, Fastmarkets, LME). Earlier versions hosted look-alike endpoints for some of these; they were removed in the Provenance redesign.

Stack: TanStack Start · React 19 · Tailwind v4 · Nitro on Vercel (preview) and Google Cloud Run (production).

## Google Cloud

Production is **Cloud Run + Cloud SQL Postgres 16**, not Vercel. The Grok preview stays on Vercel (`npm run build` still emits the Vercel Nitro preset).

| Piece | |
|---|---|
| App | Cloud Run gen2, `verityx`, min 1 instance |
| Database | Cloud SQL Postgres 16, regional HA, unix socket |
| Secrets | Secret Manager |
| CI | Cloud Build → Artifact Registry |

Runbook: [`gcp/DEPLOY.md`](gcp/DEPLOY.md)

```bash
export PROJECT_ID=veridex-exchange-6712
./gcp/bootstrap.sh          # APIs, SQL, IAM, secret placeholders
# put Grok broker id/secret into Secret Manager
./gcp/deploy.sh             # image + Cloud Run
```

Fail-closed: `GCP_RUNTIME=1` refuses the throwaway PGLite database. `/health/live` is process liveness; `/health/ready` is 503 until Cloud SQL answers. Schema applies on first ready under a Postgres advisory lock.


