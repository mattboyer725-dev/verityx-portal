import { createFileRoute } from "@tanstack/react-router";
import { handleStripeWebhook } from "@/lib/verityx/ops.server";

export const Route = createFileRoute("/api/billing/stripe/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handleStripeWebhook(request),
    },
  },
});
