# Seal keys

VerityX signs every seal receipt with an Ed25519 key. Anyone can check a
receipt at `/verify`, with `scripts/verify-receipt.py`, or with any Ed25519
library.

## Where things live

| What | Where | Secret? |
|---|---|---|
| Private seed (64 hex) | Vercel env `VERITYX_SEAL_KEY`, production | Yes, never in git, chat or logs |
| Public keyring | `src/data/seal-keyring.json` (public repo), served at `/api/seal-key` | No |
| Keyring rules | `src/lib/seal-keyring.ts`, enforced in CI by `.github/workflows/keyring-guard.yml` | — |

## Rules

- Append-only: keys are never removed or edited.
- Status moves one way: `active` → `retired` → `revoked`. Exactly one key is active.
- The server signs **only** if its env key is the keyring's active key (fail closed).
- A receipt passes the key check when its key is **active**, or was **retired after** the receipt was issued.
  Rotation never invalidates old receipts.
- A **revoked** key never passes on signature alone: someone else may hold it, so issue times can't be trusted.

## Rotate (routine, e.g. yearly)

On your Mac, in a clean checkout of `main`:

```bash
npx vercel login                      # once
node scripts/rotate-seal-key.mjs --dry-run
node scripts/rotate-seal-key.mjs
```

The script generates the key in memory, sends the seed straight to Vercel,
commits the keyring, pushes, and waits until the live site publishes the new
key. The seed is never printed or written to disk.

## Revoke (the seed may be exposed)

```bash
node scripts/rotate-seal-key.mjs --revoke "what happened"
```

Same as rotation, but the old key is marked revoked. Receipts it signed stop
passing the key check; their ledger entries can still be confirmed against
VerityX's ledger root.

## If signing stops

`/api/seal-key` reports `available: false` with the reason, usually that the
env key and the keyring's active key differ (for example, a rotation stopped
between the Vercel step and the push). Re-run the rotation, or push the
keyring commit that is waiting.
