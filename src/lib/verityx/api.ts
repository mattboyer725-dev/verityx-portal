import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { EvidenceItem, Outcome, OutreachChannel, Pilot, ProspectStage } from "./types";

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops.server");
    return ops.getWorkspace(context.userId);
  });

export const updateOrg = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { name?: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.updateOrg(context.userId, data);
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops.server");
    return ops.getDashboard(context.userId);
  });

export const listProspects = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops.server");
    return ops.listProspects(context.userId);
  });

export const getProspect = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.getProspect(context.userId, data);
  });

export const createProspect = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: {
    companyName: string;
    contactName?: string;
    contactEmail?: string;
    contactRole?: string;
    sector?: string;
    region?: string;
    stage?: ProspectStage;
    notes?: string;
  }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.createProspect(context.userId, data);
  });

export const patchProspect = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: {
    id: string;
    companyName?: string;
    contactName?: string;
    contactEmail?: string;
    contactRole?: string;
    sector?: string;
    region?: string;
    stage?: ProspectStage;
    notes?: string;
  }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.patchProspect(context.userId, data);
  });

export const deleteProspect = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.deleteProspect(context.userId, data);
  });

export const createPilot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { prospectId: string; title?: string; scope?: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.createPilot(context.userId, data);
  });

export const listPilots = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops.server");
    return ops.listPilots(context.userId);
  });

export const getPilot = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.getPilot(context.userId, data);
  });

export const patchPilot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string; title?: string; scope?: string; status?: Pilot["status"]; markInputsReceived?: boolean }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.patchPilot(context.userId, data);
  });

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { pilotId: string; origin: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.createCheckout(context.userId, data);
  });

export const recordManualPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { pilotId: string; note: string; confirm: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.recordManualPayment(context.userId, data);
  });

export const previewDecision = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { evidence: EvidenceItem[] }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.previewDecision(context.userId, data);
  });

export const createDecision = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { pilotId: string; evidence: EvidenceItem[] }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.createDecision(context.userId, data);
  });

export const listDecisions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops.server");
    return ops.listDecisions(context.userId);
  });

export const getDecision = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.getDecision(context.userId, data);
  });

export const patchDecision = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string; evidence?: EvidenceItem[]; approvalNote?: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.patchDecision(context.userId, data);
  });

export const approveDecision = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string; note?: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.approveDecision(context.userId, data);
  });

export const generateReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { pilotId: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.generateReport(context.userId, data);
  });

export const listReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops.server");
    return ops.listReports(context.userId);
  });

export const getReport = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.getReport(context.userId, data);
  });

export const getReportPdf = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.getReportPdf(context.userId, data);
  });

export const listFeedback = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops.server");
    return ops.listFeedback(context.userId);
  });

export const createFeedback = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { pilotId: string; kind: string; rating?: number; comment?: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.createFeedback(context.userId, data);
  });

export const upsertOutcome = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: {
    pilotId: string;
    outcomeAccuracy?: Outcome["outcomeAccuracy"];
    outcomeValue?: string;
    timeToResolutionDays?: number | null;
    caseStudyPermission?: Outcome["caseStudyPermission"];
    followUpAt?: string | null;
    notes?: string;
  }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.upsertOutcome(context.userId, data);
  });

export const listOutcomes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops.server");
    return ops.listOutcomes(context.userId);
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops.server");
    return ops.listAuditLogs(context.userId);
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops.server");
    return ops.listMembers(context.userId);
  });

export const loadSampleWalkthrough = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops.server");
    return ops.loadSampleWalkthrough(context.userId);
  });

export const loadOwnBook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops.server");
    return ops.loadOwnBook(context.userId);
  });

export const logOutreach = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string; channel?: OutreachChannel; subject?: string; body?: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.logOutreach(context.userId, data);
  });

export const pullDeskPacket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { pilotId: string; scenarioId?: string }) => data)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.pullDeskPacket(context.userId, data);
  });

