export type StripeLikeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id?: string;
      payment_intent?: string | { id?: string };
      metadata?: Record<string, string | undefined>;
      client_reference_id?: string;
      payment_status?: string;
    };
  };
};

export function interpretWebhook(input: {
  signatureHeader: string | null;
  secretConfigured: boolean;
}): { ok: true } | { ok: false; status: number; reason: string } {
  if (!input.secretConfigured) {
    return {
      ok: false,
      status: 503,
      reason: "webhook_unconfigured",
    };
  }
  if (!input.signatureHeader) {
    return { ok: false, status: 400, reason: "missing_signature" };
  }
  return { ok: true };
}

export function paymentIntentIdFromSession(
  session: StripeLikeEvent["data"]["object"],
): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  if (typeof pi === "string") return pi;
  return pi.id ?? null;
}

export function shouldMarkPaid(eventType: string, paymentStatus?: string): boolean {
  if (eventType === "checkout.session.completed") {
    return paymentStatus == null || paymentStatus === "paid";
  }
  if (eventType === "payment_intent.succeeded") return true;
  return false;
}
