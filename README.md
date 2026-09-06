# VerityX Sovereign Portal

Live magnetics / metals desk for Siemens Gamesa procurement verification.

Not a stub. Verify sits on the PO line: ingest SAP/Ariba analogs, MAD-filter poisoned prints, CoV consensus, n-tier provenance, ESG/export/financial screens, CBAM/dual-use gate, PBFT hash-chain seal, exportable evidence packet.

## Demo seat

- `elena.hartmann@siemensgamesa.com`
- `demo2026`

## API

| Route | Method | Agent |
|---|---|---|
| `/api/health` | GET | — |
| `/api/auth` | POST | AUTH |
| `/api/scenarios` | GET | CONSENSUS preview |
| `/api/verify` | POST | full pipeline |
| `/api/provenance` | GET | PROVENANCE |
| `/api/alerts` | GET | SCREEN |
| `/api/agents` | GET | roster |
| `/api/ledger` | GET | LEDGER |
| `/api/competition` | GET | takeaways |

## Agents built (all `exists=false` shipped)

INGEST · ORACLE · CONSENSUS · RISK · PROVENANCE · SCREEN · COMPLIANCE · SEAL · LEDGER · EVIDENCE · AUTH

## Remaining fakes (honest)

- SAP S/4HANA and Ariba are analog feeds, not a live tenant connection
- Market oracles are scenario prints, not live LME/Argus sockets
- EcoVadis / Prewave / RapidRatings / Circulor / Minespider are analog screens and passports
- 27-node PBFT is in-process (quorum `2f+1=19`), not a real cluster
- Demo login is a hardcoded seat, not Okta

## Local

```bash
npx vercel dev
```
