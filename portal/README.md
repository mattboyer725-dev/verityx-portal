# VerityX Sovereign Portal

Live magnetics / metals desk for Siemens Gamesa procurement verification.

Not a stub. Verify sits on the PO line: ingest SAP/Ariba analogs, MAD-filter poisoned prints, CoV consensus, n-tier provenance, ESG/export/financial screens, CBAM/dual-use gate, PBFT hash-chain seal, exportable evidence packet.

## Demo seat (buyer desk)

- `elena.hartmann@siemensgamesa.com`
- `demo2026`

## Platform command (owner) — v6

The live React app at `/admin` is the real command plane. Owner signs in with **Google** as `mattboyer725@gmail.com`.

Command now includes:

- Monitor — presence, last-seen, desk + operator activity
- Identities — roles, suspend, notes, session revoke
- Seats — invite / role / suspend / remove, pending invite revoke
- Sessions — client, IP, revoke
- Permission matrix
- Agent fleet, alerts (ack + close), gate policies, flags
- Security — verified-email gate, maintenance, desk banner, session window
- API keys (shown once) and webhooks
- Append-only audit
- JSON backup + restore (policies, flags, agents, freeze, security)
- Desk freeze and analog-desk telemetry (login, verify, writeback, export)

This static `/admin.html` remains an analog of the older command surface. Prefer the React `/admin` for operator work.

## API

| Route | Method | Agent |
|---|---|---|
| `/api/health` | GET | — |
| `/api/auth` | POST | AUTH |
| `/api/admin/session` | POST | owner command login |
| `/api/admin` | GET/POST | command snapshot + mutations |
| `/api/scenarios` | GET | CONSENSUS preview |
| `/api/verify` | POST | full pipeline |
| `/api/provenance` | GET | PROVENANCE |
| `/api/alerts` | GET | SCREEN |
| `/api/agents` | GET | roster |
| `/api/ledger` | GET | LEDGER |
| `/api/oracle` | GET/POST | ORACLE |
| `/api/packet` | GET | EVIDENCE |
| `/api/merkle` | GET | inclusion proof |
| `/api/core` | GET | Local Core doctor (HMAC + Merkle) |
| `/api/writeback` | POST | SAP analog |
| `/api/competition` | GET | takeaways |

## Agents built (all `exists=false` shipped)

INGEST · ORACLE · CONSENSUS · RISK · PROVENANCE · SCREEN · COMPLIANCE · SEAL · LEDGER · EVIDENCE · AUTH

## Remaining fakes (honest)

- Siemens Gamesa SAP S/4HANA / Ariba **tenant** is not connected — the desk runs a live OData-shaped store with mutating HOLD/RELEASE, ETag, CSRF and IDoc, plus an Ariba sourcing v2 RFQ tenant and TED overlay
- Argus Metals **paid socket** is not subscribed — NdPr is derived from live MP Materials + Westmetall LME cash
- EcoVadis / Prewave / RapidRatings / Circulor / Minespider **vendor APIs** are paid — EcoVadis is a 21-criteria analog from GLEIF + news, Prewave is RSS heat on the same PO, RapidRatings is listed-tape FHR with opacity; lots and Minespider batches are hashed ledgers on this host
- 27-node PBFT is an in-process HMAC cluster (quorum `2f+1=19`, 2 Byzantine), not 27 networked hosts
- Okta Workforce **tenant** is not provisioned — the desk issues Okta-shaped OIDC RS256 JWTs with JWKS
- Local Core v1.6.0 HMAC + Merkle **is real and bit-identical** to [mattboyer725-dev/verityx-local-core](https://github.com/mattboyer725-dev/verityx-local-core) (`319af22`) — in-memory on Vercel (no durable FS)
