/**
 * Sales and owner tools belong to the platform owner (OWNER_USER_ID).
 * Unpinned: shown everywhere except production, which fails closed so customers never see them.
 */
export function ownerToolsFor(userId: string, env: Record<string, string | undefined> = process.env): boolean {
  const owner = (env.OWNER_USER_ID ?? "").trim();
  if (owner) return owner === userId;
  return env.VERCEL_ENV !== "production";
}
