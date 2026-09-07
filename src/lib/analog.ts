export function analogSummary(id: string, body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const o = body as Record<string, unknown>;
  if (id === "sap") {
    const results = (o.d as { results?: Record<string, unknown>[] } | undefined)?.results;
    if (!Array.isArray(results)) return [];
    const first = results[0];
    return [
      `${results.length} purchase orders`,
      first ? `${first.PurchaseOrder} · ${first.Supplier} · ${first.ReleaseStatus}` : "",
    ].filter(Boolean);
  }
  if (id === "circulor") {
    const lots = o.lots as { lot?: string }[] | undefined;
    if (!Array.isArray(lots)) return [];
    return [`${lots.length} hashed lots`, lots[0]?.lot || ""].filter(Boolean);
  }
  if (id === "pbft") {
    return [`${o.n} voters · f=${o.f} · quorum ${o.quorum} · seq ${o.seq}`];
  }
  if (id === "okta") {
    const algs = o.id_token_signing_alg_values_supported;
    return [String(o.issuer || ""), Array.isArray(algs) ? algs.join(" · ") : "RS256"].filter(Boolean);
  }
  if (id === "screen") {
    const ads = o.adapters as { id: string; status: string }[] | undefined;
    if (!Array.isArray(ads)) return [];
    return ads.map((a) => `${a.id} ${a.status}`);
  }
  if (id === "ecovadis") {
    const cards = (o.scorecards as { supplier?: string; score?: number; medal?: string }[] | undefined) || [];
    if (!Array.isArray(cards) || !cards.length) {
      if (typeof o.industry === "string") return [String(o.industry), "21-criteria analog · not an EcoVadis tenant"];
      return [];
    }
    const first = cards[0];
    return [
      `${cards.length} scorecards`,
      first.supplier ? `${first.supplier} · ${first.score} ${first.medal}` : "",
      "21-criteria · NACE 27 · GLEIF + news",
    ].filter(Boolean);
  }
  if (id === "prewave") {
    const risks = (o.risks as { supplier?: string; level?: string; heat?: number; po?: string }[] | undefined) || [];
    if (!Array.isArray(risks) || !risks.length) return [];
    const first = risks[0];
    return [
      `${risks.length} supplier heats`,
      first.supplier ? `${first.supplier} · ${first.level} ${first.heat}` : "",
      first.po ? `PO ${first.po}` : "media-risk heat from RSS",
    ].filter(Boolean);
  }
  if (id === "argus") {
    const tick = (o.argus || o) as Record<string, unknown>;
    if (tick.ndprUsdKg == null) return [];
    return [`NdPr ${tick.ndprUsdKg} USD/kg`, `Dy ${tick.dyUsdKg} USD/kg`];
  }
  return [];
}

export function sapEntityPath(path: string) {
  const base = path.replace(/\/+$/, "");
  return base.endsWith("A_PurchaseOrder") ? base : `${base}/A_PurchaseOrder`;
}
