/**
 * Canonical JSON, byte-identical to Python json.dumps(obj, sort_keys=True,
 * separators=(",", ":"), allow_nan=False) with default ensure_ascii=True —
 * the local-core event_store._canonical contract. Shared by the ledger
 * (server) and the receipt verifier (browser). No imports, no secrets.
 */
/** Python json.dumps default ensure_ascii=True: every code unit above 0x7F becomes \uXXXX (lowercase). */
function pyString(s: string) {
  return JSON.stringify(s).replace(/[\u0080-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

/** Python float repr pads a one-digit exponent ("1e-07"); JS does not ("1e-7"). */
function pyNumber(n: number) {
  if (!Number.isFinite(n)) throw new Error("canonical JSON refuses NaN/Infinity (allow_nan=False)");
  return String(n).replace(/e([+-])(\d)$/, "e$10$2");
}

export function pyJson(v: unknown): string {
  if (v === null) return "null";
  switch (typeof v) {
    case "boolean":
      return v ? "true" : "false";
    case "number":
      return pyNumber(v);
    case "string":
      return pyString(v);
    case "object": {
      if (Array.isArray(v)) return "[" + v.map(pyJson).join(",") + "]";
      const o = v as Record<string, unknown>;
      return (
        "{" +
        Object.keys(o)
          .sort()
          .map((k) => {
            if (o[k] === undefined) throw new Error(`canonical JSON refuses undefined at key ${k}`);
            return pyString(k) + ":" + pyJson(o[k]);
          })
          .join(",") +
        "}"
      );
    }
    default:
      throw new Error(`canonical JSON refuses ${typeof v}`);
  }
}

/**
 * Byte-identical to Python json.dumps(obj, sort_keys=True, separators=(",", ":"),
 * allow_nan=False) — the local-core event_store._canonical contract.
 */
export function canonicalJson(obj: Record<string, unknown>) {
  return pyJson(obj);
}

