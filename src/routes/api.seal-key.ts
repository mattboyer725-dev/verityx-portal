import { createFileRoute } from "@tanstack/react-router";

/** VerityX's public seal key. Anyone verifying a receipt compares the signer against this. */
export const Route = createFileRoute("/api/seal-key")({
  server: {
    handlers: {
      GET: async () => {
        const { publishedSealKey } = await import("@/lib/receipt.server");
        return Response.json(await publishedSealKey(), {
          headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});
