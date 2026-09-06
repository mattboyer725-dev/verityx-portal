import { UnauthorizedError } from "@/lib/auth/verify.server";
import { CrossSiteRequestError } from "@/lib/auth/isolation.server";
import * as ops from "./ops.server";
import { corsHeaders, matchPath } from "./http";
import type { EvidenceItem, Outcome, Pilot, ProspectStage } from "./types";

function jsonError(request: Request, err: unknown): Response {
  let status = 400;
  let message = "Request failed";
  if (err instanceof UnauthorizedError) {
    status = 401;
    message = err.message;
  } else if (err instanceof CrossSiteRequestError) {
    status = 403;
    message = err.message;
  } else if (err instanceof Error) {
    message = err.message;
    if (/not found/i.test(message)) status = 404;
    else if (/forbidden/i.test(message)) status = 403;
    else if (/unauthorized/i.test(message)) status = 401;
    else if (/too many/i.test(message)) status = 429;
  }
  return Response.json({ error: message }, { status, headers: corsHeaders(request) });
}

async function requireApiUser(request: Request): Promise<string> {
  const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
  const { requireUserId } = await import("@/lib/auth/verify.server");
  assertSameSiteRequest();
  const authz = request.headers.get("authorization");
  const bearer = authz?.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : undefined;
  return requireUserId(bearer);
}

async function readJson<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

function json(request: Request, data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: corsHeaders(request) });
}

export async function dispatchRest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (path.startsWith("/api/auth") || path === "/api/billing/stripe/webhook") {
    return json(request, { error: "not_found" }, 404);
  }

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  try {
    if ((path === "/api/me" || path === "/api/workspace") && method === "GET") {
      const userId = await requireApiUser(request);
      const workspace = await ops.getWorkspace(userId);
      return json(request, workspace);
    }

    const userId = await requireApiUser(request);

    if (path === "/api/dashboard" && method === "GET") {
      return json(request, await ops.getDashboard(userId));
    }

    if (path === "/api/members" && method === "GET") {
      return json(request, await ops.listMembers(userId));
    }

    if (path === "/api/prospects" && method === "GET") {
      return json(request, await ops.listProspects(userId));
    }
    if (path === "/api/prospects" && method === "POST") {
      const body = await readJson<{
        companyName: string;
        contactName?: string;
        contactEmail?: string;
        sector?: string;
        region?: string;
        stage?: ProspectStage;
        notes?: string;
      }>(request);
      return json(request, await ops.createProspect(userId, body), 201);
    }

    const prospectId = matchPath(path, "/api/prospects/:id");
    if (prospectId && method === "GET") {
      return json(request, await ops.getProspect(userId, { id: prospectId.id }));
    }
    if (prospectId && (method === "PATCH" || method === "PUT")) {
      const body = await readJson<{
        companyName?: string;
        contactName?: string;
        contactEmail?: string;
        sector?: string;
        region?: string;
        stage?: ProspectStage;
        notes?: string;
      }>(request);
      return json(request, await ops.patchProspect(userId, { id: prospectId.id, ...body }));
    }
    if (prospectId && method === "DELETE") {
      return json(request, await ops.deleteProspect(userId, { id: prospectId.id }));
    }

    if (path === "/api/pilots" && method === "GET") {
      return json(request, await ops.listPilots(userId));
    }
    if (path === "/api/pilots" && method === "POST") {
      const body = await readJson<{ prospectId: string; title?: string; scope?: string }>(request);
      return json(request, await ops.createPilot(userId, body), 201);
    }

    const pilotId = matchPath(path, "/api/pilots/:id");
    if (pilotId && method === "GET") {
      return json(request, await ops.getPilot(userId, { id: pilotId.id }));
    }
    if (pilotId && (method === "PATCH" || method === "PUT")) {
      const body = await readJson<{
        title?: string;
        scope?: string;
        status?: Pilot["status"];
        markInputsReceived?: boolean;
      }>(request);
      return json(request, await ops.patchPilot(userId, { id: pilotId.id, ...body }));
    }
    const pay = matchPath(path, "/api/pilots/:id/payment");
    if (pay && method === "POST") {
      const body = await readJson<{ note?: string; confirm?: string }>(request);
      return json(
        request,
        await ops.recordManualPayment(userId, {
          pilotId: pay.id,
          note: body.note ?? "",
          confirm: body.confirm ?? "",
        }),
      );
    }

    if ((path === "/api/workspace" || path === "/api/org") && (method === "PATCH" || method === "PUT" || method === "POST")) {
      const body = await readJson<{ name?: string }>(request);
      return json(request, await ops.updateOrg(userId, body));
    }

    if (path === "/api/sample" && method === "POST") {
      return json(request, await ops.loadSampleWalkthrough(userId), 201);
    }

    const checkout = matchPath(path, "/api/billing/pilot-checkout/:pilotId");
    if (checkout && method === "POST") {
      const body = await readJson<{ origin?: string }>(request);
      const origin = body.origin || request.headers.get("origin") || url.origin;
      return json(request, await ops.createCheckout(userId, { pilotId: checkout.pilotId, origin }));
    }

    if (path === "/api/decisions" && method === "GET") {
      return json(request, await ops.listDecisions(userId));
    }
    if (path === "/api/decisions" && method === "POST") {
      const body = await readJson<{
        pilotId: string;
        evidence: EvidenceItem[];
        preview?: boolean;
      }>(request);
      if (body.preview) return json(request, await ops.previewDecision(userId, { evidence: body.evidence }));
      return json(request, await ops.createDecision(userId, body), 201);
    }

    const approve = matchPath(path, "/api/decisions/:id/approve");
    if (approve && method === "POST") {
      const body = await readJson<{ note?: string }>(request);
      return json(request, await ops.approveDecision(userId, { id: approve.id, note: body.note }));
    }

    const decisionId = matchPath(path, "/api/decisions/:id");
    if (decisionId && method === "GET") {
      return json(request, await ops.getDecision(userId, { id: decisionId.id }));
    }
    if (decisionId && (method === "PATCH" || method === "PUT")) {
      const body = await readJson<{ evidence?: EvidenceItem[]; approvalNote?: string }>(request);
      return json(request, await ops.patchDecision(userId, { id: decisionId.id, ...body }));
    }

    if (path === "/api/feedback" && method === "GET") {
      return json(request, await ops.listFeedback(userId));
    }
    if (path === "/api/feedback" && method === "POST") {
      const body = await readJson<{ pilotId: string; kind: string; rating?: number; comment?: string }>(request);
      return json(request, await ops.createFeedback(userId, body), 201);
    }

    if (path === "/api/outcomes" && method === "GET") {
      return json(request, await ops.listOutcomes(userId));
    }
    if (path === "/api/outcomes" && method === "POST") {
      const body = await readJson<{
        pilotId: string;
        outcomeAccuracy?: Outcome["outcomeAccuracy"];
        outcomeValue?: string;
        timeToResolutionDays?: number | null;
        caseStudyPermission?: Outcome["caseStudyPermission"];
        followUpAt?: string | null;
        notes?: string;
      }>(request);
      return json(request, await ops.upsertOutcome(userId, body));
    }

    if (path === "/api/reports" && method === "GET") {
      return json(request, await ops.listReports(userId));
    }
    if (path === "/api/reports" && method === "POST") {
      const body = await readJson<{ pilotId: string }>(request);
      return json(request, await ops.generateReport(userId, body), 201);
    }

    const generate = matchPath(path, "/api/reports/generate/:pilotId");
    if (generate && method === "POST") {
      return json(request, await ops.generateReport(userId, { pilotId: generate.pilotId }), 201);
    }

    const pdf = matchPath(path, "/api/reports/:id/pdf");
    if (pdf && (method === "GET" || method === "POST")) {
      const file = await ops.getReportPdf(userId, { id: pdf.id });
      const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
      return new Response(bytes, {
        status: 200,
        headers: {
          ...corsHeaders(request),
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${file.filename}"`,
        },
      });
    }

    const reportId = matchPath(path, "/api/reports/:id");
    if (reportId && method === "GET") {
      return json(request, await ops.getReport(userId, { id: reportId.id }));
    }

    if (path === "/api/audit-logs" && method === "GET") {
      return json(request, await ops.listAuditLogs(userId));
    }

    return json(request, { error: "not_found" }, 404);
  } catch (err) {
    return jsonError(request, err);
  }
}
