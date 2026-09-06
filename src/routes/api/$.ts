import { createFileRoute } from "@tanstack/react-router";
import { dispatchRest } from "@/lib/verityx/rest.server";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: ({ request }) => dispatchRest(request),
      POST: ({ request }) => dispatchRest(request),
      PATCH: ({ request }) => dispatchRest(request),
      PUT: ({ request }) => dispatchRest(request),
      DELETE: ({ request }) => dispatchRest(request),
      OPTIONS: ({ request }) => dispatchRest(request),
    },
  },
});
