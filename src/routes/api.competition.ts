import { createFileRoute } from "@tanstack/react-router";
import { competitionPayload } from "@/lib/competition";

function handle({ request }: { request: Request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  return Response.json(competitionPayload(), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60",
    },
  });
}

export const Route = createFileRoute("/api/competition")({
  server: {
    handlers: {
      GET: handle,
      OPTIONS: handle,
    },
  },
});
