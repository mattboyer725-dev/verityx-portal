/**
 * Domain-separated Merkle tree, byte-identical to local-core merkle.py:
 *   leaf = SHA-256(0x00 || event_hash)    pair = SHA-256(0x01 || left || right)
 * An odd node is paired with itself. Shared by the ledger (server) and the
 * receipt verifier (browser): WebCrypto only, no secrets.
 */
export type MerklePath = { sibling: string; side: "L" | "R" };

export function hex(buf: ArrayBuffer | Uint8Array) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function bytes(hexStr: string) {
  const out = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hexStr.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function sha256(data: Uint8Array) {
  return hex(await crypto.subtle.digest("SHA-256", data as unknown as BufferSource));
}

export function macEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

/** merkle.py leaf_hash: H(0x00 || event_hash_bytes) */
export async function leafHash(eventHash: string) {
  const tagged = new Uint8Array(1 + 32);
  tagged[0] = 0x00;
  tagged.set(bytes(eventHash), 1);
  return sha256(tagged);
}

/** merkle.py hash_pair: H(0x01 || left || right) */
export async function hashPair(left: string, right: string) {
  const tagged = new Uint8Array(1 + 32 + 32);
  tagged[0] = 0x01;
  tagged.set(bytes(left), 1);
  tagged.set(bytes(right), 33);
  return sha256(tagged);
}

export async function buildLevels(eventHashes: string[]) {
  if (!eventHashes.length) return [] as string[][];
  let level = await Promise.all(eventHashes.map(leafHash));
  const levels = [level];
  while (level.length > 1) {
    const nxt: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const L = level[i];
      const R = level[i + 1] ?? L;
      nxt.push(await hashPair(L, R));
    }
    level = nxt;
    levels.push(level);
  }
  return levels;
}

export async function merkleRootOf(eventHashes: string[]) {
  if (!eventHashes.length) return "0".repeat(64);
  const levels = await buildLevels(eventHashes);
  return levels[levels.length - 1][0];
}

export async function inclusionProof(eventHashes: string[], index: number) {
  if (index < 0 || index >= eventHashes.length) throw new Error("leaf index out of range");
  const levels = await buildLevels(eventHashes);
  const path: MerklePath[] = [];
  let idx = index;
  for (const level of levels.slice(0, -1)) {
    const even = idx % 2 === 0;
    const sibIdx = even ? (idx + 1 < level.length ? idx + 1 : idx) : idx - 1;
    path.push({ sibling: level[sibIdx], side: even ? "R" : "L" });
    idx = Math.floor(idx / 2);
  }
  return { root: levels[levels.length - 1][0], path };
}

export async function verifyInclusion(eventHash: string, index: number, path: MerklePath[], root: string) {
  if (index < 0) return false;
  let running = await leafHash(eventHash);
  let idx = index;
  for (const step of path) {
    const expected = idx % 2 === 0 ? "R" : "L";
    if (step.side !== expected) return false;
    running = step.side === "L" ? await hashPair(step.sibling, running) : await hashPair(running, step.sibling);
    idx = Math.floor(idx / 2);
  }
  return idx === 0 && macEqual(running, root);
}
