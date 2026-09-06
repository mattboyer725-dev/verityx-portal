import { createFileRoute } from "@tanstack/react-router";
import { dispatchRest } from "@/lib/verityx/rest.server";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        url.pathname = "/api/me";
        return dispatchRest(new Request(url.toString(), request));
      },
    },
  },
});
