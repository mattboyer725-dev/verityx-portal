# VerityX Sovereign — Siemens Gamesa magnetics desk

Live procurement verification for rare-earth magnets and metals. Not a stub.

One click as **Elena Hartmann** (Head of Magnetics Procurement). Verify sits on the PO line: SAP ingest, MAD-filter poisoned prints, CoV consensus, n-tier provenance, ESG / export / financial screens, CBAM dual-use gate, 27-node PBFT seal, Local Core HMAC + Merkle inclusion proofs, exportable evidence packet.

Owner command at `/admin` — Google as `mattboyer725@gmail.com`.

## Seats

| Surface | Who | How |
|---|---|---|
| `/` | Elena Hartmann · Head of Magnetics Procurement | **Enter the desk** (issues Okta-shaped RS256) |
| `/admin` | Matt Boyer · owner | Continue with Google |

## Pipeline (11 agents)

INGEST → ORACLE → CONSENSUS → RISK → PROVENANCE → SCREEN → COMPLIANCE → SEAL → LEDGER → EVIDENCE → AUTH

LEDGER is a bit-identical port of [verityx-local-core](https://github.com/mattboyer725-dev/verityx-local-core) v1.6.0 (`319af22`): HMAC-SHA256 signed events, domain-separated Merkle (`H(0x00‖hash)` leaves, `H(0x01‖L‖R)` pairs), inclusion proofs.

## Remaining fakes (honest)

- Siemens Gamesa SAP S/4HANA / Ariba **tenant** is not connected — live OData-shaped store with HOLD/RELEASE, ETag, CSRF, IDoc + TED overlay
- Argus Metals **paid socket** is not subscribed — NdPr derived from live MP Materials + Westmetall LME cash
- EcoVadis / Prewave / RapidRatings / Circulor / Minespider **vendor APIs** are paid — scores and DPP computed from GLEIF, UN sanctions, news RSS, USGS
- 27-node PBFT is an in-process HMAC cluster (quorum `2f+1 = 19`, 2 Byzantine), not 27 networked hosts
- Okta Workforce **tenant** is not provisioned — desk issues Okta-shaped OIDC RS256 JWTs with JWKS
- Local Core HMAC + Merkle **is real** — in-memory on Vercel (no durable FS)

Public adapters that **are** live: Westmetall LME cash, Yahoo (HG=F / ALI=F / MP / IFX.DE / TKA.DE / SIE.DE), ECB FX, GLEIF, UN sanctions XML, TED, Google News RSS, FRED.

## Stack

TanStack Start · React 19 · Tailwind v4 · Nitro on Vercel.

Vercel project: `verityx-live-desk`.
