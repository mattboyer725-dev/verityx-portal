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
| `/api/writeback` | POST | SAP analog |
| `/api/competition` | GET | takeaways |

## Agents built (all `exists=false` shipped)

INGEST · ORACLE · CONSENSUS · RISK · PROVENANCE · SCREEN · COMPLIANCE · SEAL · LEDGER · EVIDENCE · AUTH

## Remaining fakes (honest)

- SAP S/4HANA and Ariba are analog feeds, not a live tenant connection
- Market oracles are scenario prints, not live LME/Argus sockets
- EcoVadis / Prewave / RapidRatings / Circulor / Minespider are analog screens and passports
- 27-node PBFT is in-process (quorum `2f+1=19`), not a real cluster
- Demo buyer login is a hardcoded seat, not Okta
- Portal `/admin` is an owner-email analog; the React app uses real Google sign-in
