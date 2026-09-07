import { createFileRoute } from "@tanstack/react-router";
import { handlePublicAdapterHttp } from "@/lib/adapters-http";

async function handle({ request }: { request: Request }) {
  return (await handlePublicAdapterHttp(request)) ?? new Response("Not found", { status: 404 });
}

export const Route = createFileRoute("/api/okta/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      OPTIONS: handle,
    },
  },
});
