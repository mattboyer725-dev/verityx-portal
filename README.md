# VerityX

Three planes, one product.

**Live:** [verityx-sovereign-desk.vercel.app](https://verityx-sovereign-desk.vercel.app) · also [verityx-sgre-live](https://verityx-sgre-live.vercel.app) · [vxsg-desk-20260906](https://vxsg-desk-20260906.vercel.app)

| Surface | Who | Path |
|---|---|---|
| Magnetics desk | Elena Hartmann, Siemens Gamesa | `/desk` |
| Customer Zero OS | Founder / analyst workspace | `/work` |
| Local Core | HMAC + Merkle doctor (v1.6.0 `319af22`) | `/core` |
| Owner command | mattboyer725@gmail.com | `/admin` |

Hub: `/`.

## What is live

- 11-agent PO pipeline: INGEST → ORACLE → CONSENSUS → RISK → PROVENANCE → SCREEN → COMPLIANCE → SEAL → LEDGER → EVIDENCE → AUTH
- Customer Zero OS advisory rules (`rules-v1.0-soft-prod`) run on every verify. BLOCK never auto-applies.
- HMAC-SHA256 + domain-separated Merkle from [verityx-local-core](https://github.com/mattboyer725-dev/verityx-local-core) v1.6.0 (`319af22`), persisted to Postgres (Neon / PGLite).
- $2,500 / 72-hour pilot loop: prospect → payment → evidence → human-approved decision → PDF.
- Tenant isolation on every OS query. Stripe checkout + signed webhook + manual admin path.

## Remaining honest fakes

Siemens SAP tenant, Argus paid socket, EcoVadis / Prewave / RapidRatings / Circulor vendor APIs, networked 27-host PBFT, Okta Workforce tenant. Public adapters that **are** live: Westmetall LME, Yahoo, ECB FX, GLEIF, UN sanctions, TED, Google News RSS, FRED.

Stack: TanStack Start · React 19 · Tailwind v4 · Nitro on Vercel.
