import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { ids } from "@/lib/verityx/validate";

export const listPassports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./passport.server");
    return ops.listPassports(context.userId);
  });

export const getPassport = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(ids<{ id: string }>("id"))
  .handler(async ({ context, data }) => {
    const ops = await import("./passport.server");
    return ops.getPassport(context.userId, data);
  });

export const createPassport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { material: string; supersedesId?: string }) => {
    if (!data || typeof data.material !== "string") throw new Error("invalid request");
    if (data.supersedesId !== undefined) ids<{ supersedesId: string }>("supersedesId")({ supersedesId: data.supersedesId });
    return data;
  })
  .handler(async ({ context, data }) => {
    const ops = await import("./passport.server");
    return ops.createPassport(context.userId, data);
  });

export const savePassportDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(ids<{ id: string; draft: unknown }>("id"))
  .handler(async ({ context, data }) => {
    const ops = await import("./passport.server");
    return ops.saveDraft(context.userId, data);
  });

export const deletePassportDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(ids<{ id: string }>("id"))
  .handler(async ({ context, data }) => {
    const ops = await import("./passport.server");
    return ops.deleteDraft(context.userId, data);
  });

export const sealPassport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(ids<{ id: string }>("id"))
  .handler(async ({ context, data }) => {
    const ops = await import("./passport.server");
    return ops.sealPassport(context.userId, data);
  });

export const revokePassport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(ids<{ id: string; reason: string }>("id"))
  .handler(async ({ context, data }) => {
    const ops = await import("./passport.server");
    return ops.revokePassport(context.userId, data);
  });

export const lookupPassport = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { code: string }) => {
    if (!data || typeof data.code !== "string" || data.code.length > 20) throw new Error("invalid request");
    return data;
  })
  .handler(async ({ context, data }) => {
    const ops = await import("./passport.server");
    return ops.lookupPublished(context.userId, data);
  });

/** Public: no sign-in. Sealed or revoked passports only, by exact code. */
export const getPublicPassport = createServerFn({ method: "GET" })
  .validator((data: { code: string }) => {
    if (!data || typeof data.code !== "string" || data.code.length > 20) throw new Error("invalid request");
    return data;
  })
  .handler(async ({ data }) => {
    const ops = await import("./passport.server");
    return ops.getPublicPassport(data);
  });

// ---------------------------------------------------------------- buyer portfolio

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function idList(v: unknown): string[] {
  if (!Array.isArray(v) || v.length > 500) throw new Error("invalid request");
  for (const x of v) if (typeof x !== "string" || !UUID.test(x)) throw new Error("invalid request");
  return v as string[];
}

export const getPortfolio = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { program?: string }) => ({ program: typeof data?.program === "string" ? data.program.slice(0, 80) : "" }))
  .handler(async ({ context, data }) => {
    const ops = await import("./portfolio.server");
    return ops.getPortfolio(context.userId, data);
  });

export const importPortfolio = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { csv: string }) => {
    if (!data || typeof data.csv !== "string") throw new Error("invalid request");
    return data;
  })
  .handler(async ({ context, data }) => {
    const ops = await import("./portfolio.server");
    return ops.importPortfolio(context.userId, data);
  });

export const addPortfolioItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { item: unknown }) => {
    if (!data || typeof data.item !== "object") throw new Error("invalid request");
    return data;
  })
  .handler(async ({ context, data }) => {
    const ops = await import("./portfolio.server");
    return ops.addPortfolioItem(context.userId, data);
  });

export const removePortfolioItems = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { ids: string[] }) => ({ ids: idList(data?.ids) }))
  .handler(async ({ context, data }) => {
    const ops = await import("./portfolio.server");
    return ops.removePortfolioItems(context.userId, data);
  });

export const acknowledgePortfolioItems = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { ids: string[] }) => ({ ids: idList(data?.ids) }))
  .handler(async ({ context, data }) => {
    const ops = await import("./portfolio.server");
    return ops.acknowledgeItems(context.userId, data);
  });

export const generateEvidencePack = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { program?: string }) => ({ program: typeof data?.program === "string" ? data.program.slice(0, 80) : "" }))
  .handler(async ({ context, data }) => {
    const ops = await import("./portfolio.server");
    return ops.generatePack(context.userId, data);
  });

export const downloadEvidencePack = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(ids<{ id: string }>("id"))
  .handler(async ({ context, data }) => {
    const ops = await import("./portfolio.server");
    return ops.downloadPack(context.userId, data);
  });

// ---------------------------------------------------------------- billing

export const getBilling = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./billing.server");
    return ops.getBilling(context.userId);
  });

export const startPlanCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { plan: string; origin: string }) => {
    if (!data || typeof data.plan !== "string" || typeof data.origin !== "string" || data.origin.length > 200) throw new Error("invalid request");
    return data;
  })
  .handler(async ({ context, data }) => {
    const ops = await import("./billing.server");
    return ops.createPlanCheckout(context.userId, data);
  });

export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { origin: string }) => {
    if (!data || typeof data.origin !== "string" || data.origin.length > 200) throw new Error("invalid request");
    return data;
  })
  .handler(async ({ context, data }) => {
    const ops = await import("./billing.server");
    return ops.createPortalSession(context.userId, data);
  });

export const listOrgPlans = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./billing.server");
    return ops.listOrgPlans(context.userId);
  });

export const setOrgPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { organizationId: string; side: "supplier" | "buyer"; plan: string; periodEnd: string | null; note: string }) => {
    if (!data || typeof data.organizationId !== "string" || data.organizationId.length > 80) throw new Error("invalid request");
    if (data.side !== "supplier" && data.side !== "buyer") throw new Error("invalid request");
    if (typeof data.plan !== "string" || (data.periodEnd !== null && typeof data.periodEnd !== "string")) throw new Error("invalid request");
    return { ...data, note: typeof data.note === "string" ? data.note : "" };
  })
  .handler(async ({ context, data }) => {
    const ops = await import("./billing.server");
    return ops.setOrgPlan(context.userId, data);
  });

export const getOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./overview.server");
    return ops.getOverview(context.userId);
  });
