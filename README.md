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

## Remaining fakes (honest)

- SAP S/4HANA and Ariba are analog feeds, not a live tenant connection
- Market oracles are scenario prints, not live LME/Argus sockets
- 27-node PBFT is in-process (quorum `2f+1=19`), not a real cluster
- Demo buyer login is a hardcoded seat, not Okta
- Portal `/admin` is an owner-email analog; the React app uses real Google sign-in
