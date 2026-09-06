import { authClient } from "@/lib/auth/client";
import { OWNER_SEAT } from "@/lib/admin";

/** Same key `src/lib/auth/client.ts` uses — we cannot edit that file. */
const BEARER_KEY = "grok-auth.bearer-token";

const FALLBACK_EMAIL = "mattboyer725@verityx.local";

type AuthBag = {
  data?: { token?: string; session?: { token?: string } } | null;
  error?: { message?: string } | null;
};

function tokenOf(bag: AuthBag): string | null {
  const t = bag.data?.token ?? bag.data?.session?.token;
  return typeof t === "string" && t.length > 8 ? t : null;
}

function persistBearer(token: string | null) {
  if (!token || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BEARER_KEY, token);
  } catch {
    /* storage blocked */
  }
}

async function trySeat(email: string, password: string, name: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const first = (await authClient.signIn.email({ email, password })) as AuthBag;
  if (!first.error) {
    persistBearer(tokenOf(first));
    return { ok: true };
  }
  const created = (await authClient.signUp.email({ email, password, name })) as AuthBag;
  if (!created.error) {
    persistBearer(tokenOf(created));
    return { ok: true };
  }
  const retry = (await authClient.signIn.email({ email, password })) as AuthBag;
  if (!retry.error) {
    persistBearer(tokenOf(retry));
    return { ok: true };
  }
  return {
    ok: false,
    message: created.error?.message || retry.error?.message || first.error?.message || "Could not open owner seat",
  };
}

/** One-click owner command: email/password, no Google/X pop-up. */
export async function enterOwnerSeat(): Promise<void> {
  const primary = await trySeat(OWNER_SEAT.email, OWNER_SEAT.password, OWNER_SEAT.name);
  if (!primary.ok) {
    const fallback = await trySeat(FALLBACK_EMAIL, OWNER_SEAT.password, OWNER_SEAT.name);
    if (!fallback.ok) throw new Error(fallback.message || primary.message);
  }
  await authClient.getSession().catch(() => undefined);
}
