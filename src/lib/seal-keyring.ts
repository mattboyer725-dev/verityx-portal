/**
 * SEAL KEYRING — every public key VerityX has ever signed receipts with.
 *
 * src/data/seal-keyring.json is committed to a public repository and is
 * append-only, so its git history is an independent record of which key was
 * in force when. Rules (enforced by validateKeyring and, across commits, by
 * validateTransition in CI):
 *
 *   - a key is never removed and its public key never changes;
 *   - status only moves active → retired → revoked;
 *   - exactly one key is active;
 *   - kid = first 16 hex of SHA-256(public key).
 *
 * A receipt verifies against the key it names:
 *   active   valid;
 *   retired  valid when issued at or before retiredAt (rotation never
 *            invalidates old receipts);
 *   revoked  never trusted on signature alone — its private half may be in
 *            other hands, so issue times cannot be relied on.
 *
 * Browser-safe and dependency-free beyond WebCrypto.
 */
import ring from "../data/seal-keyring.json" with { type: "json" };

export type KeyStatus = "active" | "retired" | "revoked";
export type KeyringKey = {
  kid: string;
  alg: "Ed25519";
  publicKey: string;
  status: KeyStatus;
  activatedAt: string;
  retiredAt?: string;
  revokedAt?: string;
  revokedReason?: string;
};
export type Keyring = { issuer: string; policy: string; keys: KeyringKey[] };

export const KEYRING = ring as unknown as Keyring;
export const KEYRING_URL = "https://github.com/mattboyer725-dev/verityx-portal/blob/main/src/data/seal-keyring.json";
export const KEYRING_HISTORY_URL = "https://github.com/mattboyer725-dev/verityx-portal/commits/main/src/data/seal-keyring.json";

const ORDER: Record<KeyStatus, number> = { active: 0, retired: 1, revoked: 2 };
const iso = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v));

async function kidOf(publicKey: string): Promise<string> {
  const pad = publicKey.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((publicKey.length + 3) % 4);
  const bin = atob(pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

/** Structural rules for one version of the keyring. Returns problems; empty means valid. */
export async function validateKeyring(k: Keyring): Promise<string[]> {
  const errs: string[] = [];
  if (!k || !Array.isArray(k.keys) || !k.keys.length) return ["keyring has no keys"];
  const kids = new Set<string>();
  let active = 0;
  for (const key of k.keys) {
    if (key.alg !== "Ed25519") errs.push(`${key.kid}: alg must be Ed25519`);
    if (!/^[A-Za-z0-9_-]{43}$/.test(key.publicKey)) errs.push(`${key.kid}: publicKey must be a 32-byte base64url key`);
    else if ((await kidOf(key.publicKey)) !== key.kid) errs.push(`${key.kid}: kid does not match its public key`);
    if (kids.has(key.kid)) errs.push(`${key.kid}: duplicate kid`);
    kids.add(key.kid);
    if (!(key.status in ORDER)) errs.push(`${key.kid}: unknown status`);
    if (key.status === "active") active++;
    if (!iso(key.activatedAt)) errs.push(`${key.kid}: activatedAt must be an ISO time`);
    if (key.status !== "active" && !iso(key.retiredAt)) errs.push(`${key.kid}: a ${key.status} key needs retiredAt`);
    if (key.status === "revoked" && (!iso(key.revokedAt) || !key.revokedReason)) errs.push(`${key.kid}: a revoked key needs revokedAt and revokedReason`);
  }
  if (active !== 1) errs.push(`exactly one key must be active (found ${active})`);
  return errs;
}

/** Rules across two versions: append-only, monotonic status, immutable keys. */
export function validateTransition(prev: Keyring, next: Keyring): string[] {
  const errs: string[] = [];
  const nextBy = new Map(next.keys.map((k) => [k.kid, k]));
  for (const p of prev.keys) {
    const n = nextBy.get(p.kid);
    if (!n) {
      errs.push(`${p.kid}: removed — keys are never removed`);
      continue;
    }
    if (n.publicKey !== p.publicKey || n.alg !== p.alg || n.activatedAt !== p.activatedAt) errs.push(`${p.kid}: key material or activation changed`);
    if (ORDER[n.status] < ORDER[p.status]) errs.push(`${p.kid}: status went backwards (${p.status} → ${n.status})`);
    if (p.retiredAt && n.retiredAt !== p.retiredAt) errs.push(`${p.kid}: retiredAt changed`);
    if (p.revokedAt && n.revokedAt !== p.revokedAt) errs.push(`${p.kid}: revokedAt changed`);
  }
  return errs;
}

export function activeKey(k: Keyring = KEYRING): KeyringKey | null {
  return k.keys.find((x) => x.status === "active") ?? null;
}

export type KeyCheck = { ok: boolean; detail: string; key: KeyringKey | null };

/** Is the key that signed this receipt one VerityX vouched for at the time it was issued? */
export function checkReceiptKey(r: { kid: string; publicKey: string; issuedAt: string }, k: Keyring = KEYRING): KeyCheck {
  const key = k.keys.find((x) => x.kid === r.kid) ?? null;
  if (!key) return { ok: false, key, detail: "Signed by a key that is not in VerityX’s published keyring." };
  if (key.publicKey !== r.publicKey) return { ok: false, key, detail: `The receipt names key ${r.kid} but carries a different public key.` };
  const issued = Date.parse(r.issuedAt);
  if (!Number.isFinite(issued)) return { ok: false, key, detail: "The receipt has no valid issue time." };
  if (issued < Date.parse(key.activatedAt) - 5 * 60_000) {
    return { ok: false, key, detail: `Issued before key ${key.kid} was activated (${key.activatedAt.slice(0, 10)}).` };
  }
  if (key.status === "active") return { ok: true, key, detail: `Signed by VerityX’s current seal key ${key.kid}.` };
  if (key.status === "retired") {
    return issued <= Date.parse(key.retiredAt!)
      ? { ok: true, key, detail: `Signed by VerityX seal key ${key.kid}, in force from ${key.activatedAt.slice(0, 10)} until it was retired on ${key.retiredAt!.slice(0, 10)}.` }
      : { ok: false, key, detail: `Key ${key.kid} was retired on ${key.retiredAt!.slice(0, 10)}; this receipt claims a later issue time.` };
  }
  return {
    ok: false,
    key,
    detail: `Key ${key.kid} was revoked on ${key.revokedAt!.slice(0, 10)} (${key.revokedReason}). Its signatures are no longer trusted on their own — confirm this entry’s ledger root with VerityX.`,
  };
}
