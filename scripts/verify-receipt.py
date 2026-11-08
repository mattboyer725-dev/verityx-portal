#!/usr/bin/env python3
"""
Verify a VerityX seal receipt with no VerityX code: Python standard library
for the content and ledger checks, the stock `openssl` binary (3.x) for the
Ed25519 signature.

    python3 verify-receipt.py receipt.json [published-public-key]

The published key is at https://verityx-portal.vercel.app/api/seal-key
("publicKey"). Exit code 0 only when every check passes.
"""
import base64, hashlib, json, os, subprocess, sys, tempfile


def canonical(obj) -> bytes:
    # json.dumps defaults: ensure_ascii=True. Same contract as the ledger.
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def b64url(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def leaf(h: str) -> str:
    return hashlib.sha256(b"\x00" + bytes.fromhex(h)).hexdigest()


def pair(a: str, b: str) -> str:
    return hashlib.sha256(b"\x01" + bytes.fromhex(a) + bytes.fromhex(b)).hexdigest()


def main() -> int:
    r = json.load(open(sys.argv[1], encoding="utf-8"))
    if r.get("type") != "verityx.seal-receipt":
        r = next((v for v in (r.get("receipt"),) if isinstance(v, dict)), r)
    published = sys.argv[2] if len(sys.argv) > 2 else None
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
    results.append(("published key", published is not None and published == r["publicKey"]))

    for name, passed in results:
        print(f"{'PASS' if passed else 'FAIL'}  {name}")
    return 0 if all(p for _, p in results) else 1


if __name__ == "__main__":
    sys.exit(main())
