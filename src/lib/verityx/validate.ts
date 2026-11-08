/**
 * Sovereign v5 SEC-01 parity: identifiers are validated at the server-function
 * boundary before they reach a query. Every portal record id is minted by
 * crypto.randomUUID(), so anything that is not a v4 UUID string is refused —
 * an object, a number, an empty string, or a crafted value never reaches SQL.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(v: unknown): v is string {
  return typeof v === "string" && UUID_V4.test(v);
}

/** Server-function validator: the payload must be a plain object whose named id fields are v4 UUIDs. */
export function ids<T extends object>(...keys: (keyof T & string)[]) {
  return (data: T): T => {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("invalid request");
    for (const k of keys) {
      if (!isUuidV4((data as Record<string, unknown>)[k])) throw new Error(`invalid ${k}`);
    }
    return data;
  };
}
