const SAP = "/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV";
const TOKEN = "/oauth2/default/v1/token";
const USERINFO = "/oauth2/default/v1/userinfo";

export async function seatFromOidc(email: string, password: string) {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "password", username: email, password }),
  });
  if (!res.ok) return null;
  const tok = (await res.json()) as { access_token?: string; id_token?: string; expires_in?: number };
  if (!tok.access_token) return null;
  let claims: Record<string, unknown> = {};
  try {
    const info = await fetch(USERINFO, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (info.ok) claims = (await info.json()) as Record<string, unknown>;
  } catch {
    /* token is enough to open the seat */
  }
  return {
    access_token: tok.access_token,
    id_token: tok.id_token || "",
    expires_in: tok.expires_in || 8 * 3600,
    claims: {
      sub: String(claims.sub || ""),
      iss: String(claims.iss || ""),
      email: String(claims.email || email),
      name: String(claims.name || ""),
    },
  };
}

export async function sapPatchPo(po: string, action: "HOLD" | "RELEASE") {
  const csrfRes = await fetch(SAP, { headers: { "X-CSRF-Token": "Fetch" } });
  const csrf = csrfRes.headers.get("x-csrf-token") || csrfRes.headers.get("X-CSRF-Token") || "";
  const path = `${SAP}/A_PurchaseOrder('${encodeURIComponent(po)}')`;
  const entRes = await fetch(path);
  if (!entRes.ok) throw new Error("sap get failed");
  const ent = (await entRes.json()) as { d: { ETag: string } };
  const patch = await fetch(path, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf,
      "If-Match": ent.d.ETag,
    },
    body: JSON.stringify({ ReleaseStatus: action }),
  });
  if (!patch.ok) throw new Error(`sap patch ${patch.status}`);
  return (await patch.json()) as {
    d: { ReleaseStatus: string; ETag: string };
    writeback: { action: string; doc: string; po: string };
  };
}
