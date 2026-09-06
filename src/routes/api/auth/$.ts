import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { dispatchAuthAlias } from "@/lib/verityx/auth-rest.server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: async ({ request }) => {
        const aliased = await dispatchAuthAlias(request);
        if (aliased) return aliased;
        return auth.handler(request);
      },
      OPTIONS: async ({ request }) => {
        const aliased = await dispatchAuthAlias(request);
        if (aliased) return aliased;
        return auth.handler(request);
      },
    },
  },
});
