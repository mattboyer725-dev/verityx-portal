# VerityX Sovereign — v1.0 live

Three planes plus a signed continuity core. One product.

**Live:** [verityx-portal.vercel.app](https://verityx-portal.vercel.app) · [sovereign desk](https://verityx-sovereign-desk.vercel.app) · [sgre-live](https://verityx-sgre-live.vercel.app) · [vxsg-desk](https://vxsg-desk-20260906.vercel.app) · [live-core](https://verityx-live-core.vercel.app)

**Hub:** `/` · **Desk:** `/desk` · **Field:** `/field` · **OS:** `/work` · **Core:** `/core` · **Command:** `/admin`

| Surface | Who | Path |
|---|---|---|
| Magnetics desk | Elena Hartmann, Siemens Gamesa | `/desk` |
| Competitor field | Public | `/field` |
| Customer Zero OS | Founder / analyst workspace | `/work` |
| Local Core | HMAC + Merkle doctor (v1.6.0 `319af22`) | `/core` |
| Owner command | mattboyer725@gmail.com | `/admin` |

Source: [mattboyer725-dev/verityx-portal](https://github.com/mattboyer725-dev/verityx-portal) · Release [v1.0-soft-prod](https://github.com/mattboyer725-dev/verityx-portal/releases/tag/v1.0-soft-prod)

## What is live

- 11-agent PO pipeline: INGEST → ORACLE → CONSENSUS → RISK → PROVENANCE → SCREEN → COMPLIANCE → SEAL → LEDGER → EVIDENCE → AUTH
- Customer Zero OS advisory rules (`rules-v1.0-soft-prod`). BLOCK never auto-applies.
- HMAC-SHA256 + domain-separated Merkle from [verityx-local-core](https://github.com/mattboyer725-dev/verityx-local-core) v1.6.0 (`319af22`), persisted to Postgres (Neon / Cloud SQL / PGLite preview).
- $2,500 / 72-hour pilot loop: prospect → payment → **live magnetics desk packet** → human-approved decision → analog SAP HOLD → PDF.
- Tenant isolation on every OS query. Stripe checkout + signed webhook + manual admin path.
- Sign-in returns to the platform hub. Workspace is one click from there.
- One platform menu (`⌘K`) on every surface. Numbered loop 01 Field → 05 Command. Competitor field at `/field` — compare and contrast, with in-product analog proof and a desk deep-link to the matching tab.

## Remaining vendor tenants

Not subscribed (and not pretended): Siemens S/4HANA / Ariba, Argus Metals, EcoVadis, Prewave, RapidRatings, Circulor, Okta Workforce.

**Live on this host instead:** SAP OData `API_PURCHASEORDER_PROCESS_SRV` with CSRF, ETag, BAPI_PO_CHANGE and IDoc ORDERS05, plus Ariba sourcing v2 RFQ events at `/ariba/api/sourcing/v2/events`; Argus-shaped NdPr/Dy SSE at `/api/oracle/stream` from MP + Westmetall; EcoVadis 21-criteria scorecards at `/ecovadis/api/v2/scorecards` from GLEIF + news; Prewave media-risk heat at `/prewave/api/v1/risks` from RSS on the same PO; SCREEN from GLEIF, OpenSanctions, UN list and listed-tape FHR; Circulor-shaped hashed lot ledger plus Minespider SHA-256 batch passports at `/minespider/api/v1/batches`; 27-voter PBFT with delayed envelopes and quorum 19; Okta-shaped RS256 IdP at `/oauth2/default`. Public market feeds still live: Westmetall LME, Yahoo, ECB FX, TED, FRED.

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
export PROJECT_ID=your-gcp-project
./gcp/bootstrap.sh          # APIs, SQL, IAM, secret placeholders
# put Grok broker id/secret into Secret Manager
./gcp/deploy.sh             # image + Cloud Run
```

Fail-closed: `GCP_RUNTIME=1` refuses the throwaway PGLite database. `/health/live` is process liveness; `/health/ready` is 503 until Cloud SQL answers. Schema applies on first ready under a Postgres advisory lock.


