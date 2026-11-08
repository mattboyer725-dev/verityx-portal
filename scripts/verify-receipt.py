#!/usr/bin/env python3
"""
Verify a VerityX seal receipt with no VerityX code: Python standard library
for the content and ledger checks, the stock `openssl` binary (3.x) for the
Ed25519 signature.

    python3 verify-receipt.py receipt.json            fetch the keyring from the live site
    python3 verify-receipt.py receipt.json KEYRING    a saved keyring / seal-key JSON file, or a URL
    python3 verify-receipt.py receipt.json PUBKEY     a single base64url public key (legacy)

The keyring is append-only and public: /api/seal-key on the site, and
src/data/seal-keyring.json (with its git history) in the repository. A
receipt passes the key check when its key is active, or was retired after
the receipt was issued. Revoked keys never pass on signature alone.
Exit code 0 only when every check passes.
"""
import base64, datetime, hashlib, json, os, subprocess, sys, tempfile, urllib.request

SEAL_KEY_URL = "https://verityx-portal.vercel.app/api/seal-key"


def canonical(obj) -> bytes:
    # json.dumps defaults: ensure_ascii=True. Same contract as the ledger.
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def b64url(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def leaf(h: str) -> str:
    return hashlib.sha256(b"\x00" + bytes.fromhex(h)).hexdigest()


def pair(a: str, b: str) -> str:
    return hashlib.sha256(b"\x01" + bytes.fromhex(a) + bytes.fromhex(b)).hexdigest()


def iso(s: str) -> datetime.datetime:
    return datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))


def load_trust(arg):
    """Returns ("keyring", dict) or ("key", str)."""
    if arg is None or arg.startswith("http"):
        url = arg or SEAL_KEY_URL
        with urllib.request.urlopen(url, timeout=20) as r:
            j = json.load(r)
        return "keyring", j.get("keyring", j)
    if os.path.exists(arg):
        j = json.load(open(arg, encoding="utf-8"))
        return "keyring", j.get("keyring", j)
    return "key", arg


def key_check(r, trust):
    kind, t = trust
    if kind == "key":
        return t == r["publicKey"], "matches the given public key" if t == r["publicKey"] else "does not match the given public key"
    k = next((k for k in t.get("keys", []) if k["kid"] == r["kid"]), None)
    if not k:
        return False, "key is not in VerityX's keyring"
    if k["publicKey"] != r["publicKey"]:
        return False, "receipt names a keyring kid but carries a different public key"
    issued = iso(r["issuedAt"])
    if issued < iso(k["activatedAt"]) - datetime.timedelta(minutes=5):
        return False, "issued before the key was activated"
    if k["status"] == "active":
        return True, f"current key {k['kid']}"
    if k["status"] == "retired":
        ok = issued <= iso(k["retiredAt"])
        return ok, f"key {k['kid']} retired {k['retiredAt'][:10]}" + ("" if ok else "; receipt claims a later issue time")
    return False, f"key {k['kid']} revoked {k.get('revokedAt', '')[:10]}: {k.get('revokedReason', '')}"


def main() -> int:
    r = json.load(open(sys.argv[1], encoding="utf-8"))
    if r.get("type") != "verityx.seal-receipt":
        r = next((v for v in (r.get("receipt"),) if isinstance(v, dict)), r)
    trust = load_trust(sys.argv[2] if len(sys.argv) > 2 else None)
    e = r["entry"]
    results = []

    body = {k: e[k] for k in ("actor", "event_id", "event_type", "payload", "prev_hash", "timestamp")}
    content = hashlib.sha256(canonical(body) + e["signature"].encode("ascii")).hexdigest() == e["hash"]
    results.append(("content", content))

    m = r["merkle"]
    running, idx = leaf(e["hash"]), m["index"]
    ok = True
    for step in m["path"]:
        if step["side"] != ("R" if idx % 2 == 0 else "L"):
            ok = False
            break
        running = pair(step["sibling"], running) if step["side"] == "L" else pair(running, step["sibling"])
        idx //= 2
    results.append(("ledger", ok and idx == 0 and running == m["root"]))

    signed = {k: v for k, v in r.items() if k != "signature"}
    pub = b64url(r["publicKey"])
    der = bytes.fromhex("302a300506032b6570032100") + pub
    with tempfile.TemporaryDirectory() as d:
        kp, mp, sp = (os.path.join(d, n) for n in ("pub.der", "msg", "sig"))
        open(kp, "wb").write(der)
        open(mp, "wb").write(canonical(signed))
        open(sp, "wb").write(b64url(r["signature"]))
        proc = subprocess.run(
            ["openssl", "pkeyutl", "-verify", "-pubin", "-keyform", "DER", "-inkey", kp, "-rawin", "-in", mp, "-sigfile", sp],
            capture_output=True,
        )
    results.append(("signature", proc.returncode == 0))
    kok, kdetail = key_check(r, trust)
    results.append((f"key ({kdetail})", kok))

    for name, passed in results:
        print(f"{'PASS' if passed else 'FAIL'}  {name}")
    return 0 if all(p for _, p in results) else 1


if __name__ == "__main__":
    sys.exit(main())
