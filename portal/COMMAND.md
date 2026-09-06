# VerityX Command v6

Owner: **mattboyer725@gmail.com**
Surface: `/admin` (Google sign-in)
Desk: `/` (Siemens Gamesa analog seat)

## Access

Continue with Google using the owner Gmail. Invited platform_admin / tenant_admin / auditor / operator identities inherit their role on first sign-in. Buyer and viewer cannot enter command.

## People

- Monitor: online / idle / offline, desk verifies, live activity
- Identities: role, suspend, operator notes, revoke all sessions
- Seats: invite, role, suspend, remove (after suspend), revoke pending invites
- Sessions: user-agent, IP, revoke

## Control

- Agents: restart / degrade / heal
- Alerts: ack and close
- Policies: MAD, CoV, PBFT, anomaly hold
- Flags: SAP writeback, evidence export, dual-source, PBFT seal, invites, live oracles

## Trust

- Security: require verified email, maintenance mode, desk banner, session window
- Keys: issue hashed API keys (plaintext once), revoke; webhook sinks
- Audit: append-only
- Backup: JSON snapshot + restore of policies / flags / agents / freeze / security; seats CSV

## Desk telemetry

Analog desk writes `desk.login`, `desk.verify`, `desk.writeback`, `desk.export`, `desk.logout` into `ops_events` so command can watch buyers without Google on the demo seat.
