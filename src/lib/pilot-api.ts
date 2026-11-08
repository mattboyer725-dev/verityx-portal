import { createServerFn } from "@tanstack/react-start";

/** Public: a buyer asks for a pilot. Validation, rate limits and storage are server-side. */
export const requestPilot = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .handler(async ({ data }) => {
    const { submitPilotRequest } = await import("@/lib/pilot-request.server");
    return submitPilotRequest(data);
  });
