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
