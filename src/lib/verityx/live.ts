import { keepPreviousData, useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  approveDecision,
  createCheckout,
  createDecision,
  createFeedback,
  createPilot,
  createProspect,
  deleteProspect,
  generateReport,
  getDashboard,
  getDecision,
  getPilot,
  getProspect,
  getReport,
  getReportPdf,
  getWorkspace,
  listAuditLogs,
  listDecisions,
  listFeedback,
  listOutcomes,
  listPilots,
  listProspects,
  listReports,
  loadSampleWalkthrough,
  loadOwnBook,
  logOutreach,
  pullDeskPacket,
  patchDecision,
  patchPilot,
  patchProspect,
  previewDecision,
  recordManualPayment,
  updateOrg,
  upsertOutcome,
} from "./api";
import type { EvidenceItem, Outcome, OutreachChannel, Pilot, ProspectStage } from "./types";
import { errorMessage } from "./use-loader";

export const vxKeys = {
  all: ["vx"] as const,
  dashboard: ["vx", "dashboard"] as const,
  workspace: ["vx", "workspace"] as const,
  prospects: ["vx", "prospects"] as const,
  prospect: (id: string) => ["vx", "prospect", id] as const,
  pilots: ["vx", "pilots"] as const,
  pilot: (id: string) => ["vx", "pilot", id] as const,
  decisions: ["vx", "decisions"] as const,
  decision: (id: string) => ["vx", "decision", id] as const,
  reports: ["vx", "reports"] as const,
  report: (id: string) => ["vx", "report", id] as const,
  feedback: ["vx", "feedback"] as const,
  outcomes: ["vx", "outcomes"] as const,
  audit: ["vx", "audit"] as const,
};

export function useInvalidateLive() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: vxKeys.all }), [qc]);
}

function asLive<T>(q: UseQueryResult<T, Error>) {
  return {
    data: q.data ?? null,
    error: q.error ? errorMessage(q.error) : null,
    loading: q.isPending,
    refreshing: q.isFetching && !q.isPending,
    updatedAt: q.dataUpdatedAt,
    reload: () => {
      void q.refetch();
    },
  };
}

const liveList = {
  staleTime: 4_000,
  refetchOnWindowFocus: true,
  placeholderData: keepPreviousData,
} as const;

const liveRecord = {
  staleTime: 4_000,
  refetchOnWindowFocus: true,
} as const;

export function useWorkspaceLive() {
  return asLive(
    useQuery({
      queryKey: vxKeys.workspace,
      queryFn: () => getWorkspace(),
      refetchInterval: 12_000,
      ...liveList,
    }),
  );
}

export function useDashboardLive() {
  return asLive(
    useQuery({
      queryKey: vxKeys.dashboard,
      queryFn: () => getDashboard(),
      refetchInterval: 8_000,
      ...liveList,
    }),
  );
}

export function useProspectsLive() {
  return asLive(
    useQuery({
      queryKey: vxKeys.prospects,
      queryFn: () => listProspects(),
      refetchInterval: 10_000,
      ...liveList,
    }),
  );
}

export function useProspectLive(id: string) {
  return asLive(
    useQuery({
      queryKey: vxKeys.prospect(id),
      queryFn: () => getProspect({ data: { id } }),
      enabled: Boolean(id),
      refetchInterval: 8_000,
      ...liveRecord,
    }),
  );
}

export function usePilotsLive() {
  return asLive(
    useQuery({
      queryKey: vxKeys.pilots,
      queryFn: () => listPilots(),
      refetchInterval: 8_000,
      ...liveList,
    }),
  );
}

export function usePilotLive(id: string, opts?: { pollPayment?: boolean }) {
  return asLive(
    useQuery({
      queryKey: vxKeys.pilot(id),
      queryFn: () => getPilot({ data: { id } }),
      enabled: Boolean(id),
      refetchInterval: (q) => {
        const status = q.state.data?.pilot.paymentStatus;
        if (opts?.pollPayment || status === "checkout_open") return 2_500;
        return 6_000;
      },
      ...liveRecord,
    }),
  );
}

export function useDecisionsLive() {
  return asLive(
    useQuery({
      queryKey: vxKeys.decisions,
      queryFn: () => listDecisions(),
      refetchInterval: 10_000,
      ...liveList,
    }),
  );
}

export function useDecisionLive(id: string) {
  return asLive(
    useQuery({
      queryKey: vxKeys.decision(id),
      queryFn: () => getDecision({ data: { id } }),
      enabled: Boolean(id),
      refetchInterval: 6_000,
      ...liveRecord,
    }),
  );
}

export function useReportsLive() {
  return asLive(
    useQuery({
      queryKey: vxKeys.reports,
      queryFn: () => listReports(),
      refetchInterval: 10_000,
      ...liveList,
    }),
  );
}

export function useReportLive(id: string) {
  return asLive(
    useQuery({
      queryKey: vxKeys.report(id),
      queryFn: () => getReport({ data: { id } }),
      enabled: Boolean(id),
      refetchInterval: 12_000,
      ...liveRecord,
    }),
  );
}

export function useFeedbackLive() {
  return asLive(
    useQuery({
      queryKey: vxKeys.feedback,
      queryFn: () => listFeedback(),
      refetchInterval: 10_000,
      ...liveList,
    }),
  );
}

export function useOutcomesLive() {
  return asLive(
    useQuery({
      queryKey: vxKeys.outcomes,
      queryFn: () => listOutcomes(),
      refetchInterval: 10_000,
      ...liveList,
    }),
  );
}

export function useAuditLive() {
  return asLive(
    useQuery({
      queryKey: vxKeys.audit,
      queryFn: () => listAuditLogs(),
      refetchInterval: 6_000,
      ...liveList,
    }),
  );
}

export function useLiveMutations() {
  const invalidate = useInvalidateLive();

  async function after<T>(result: T): Promise<T> {
    await invalidate();
    return result;
  }

  return {
    createProspect: (data: {
      companyName: string;
      contactName?: string;
      contactEmail?: string;
      contactRole?: string;
      sector?: string;
      region?: string;
      stage?: ProspectStage;
      notes?: string;
    }) => createProspect({ data }).then(after),
    patchProspect: (data: {
      id: string;
      companyName?: string;
      contactName?: string;
      contactEmail?: string;
      contactRole?: string;
      sector?: string;
      region?: string;
      stage?: ProspectStage;
      notes?: string;
    }) => patchProspect({ data }).then(after),
    deleteProspect: (data: { id: string }) => deleteProspect({ data }).then(after),
    createPilot: (data: { prospectId: string; title?: string; scope?: string }) =>
      createPilot({ data }).then(after),
    patchPilot: (data: {
      id: string;
      title?: string;
      scope?: string;
      status?: Pilot["status"];
      markInputsReceived?: boolean;
    }) => patchPilot({ data }).then(after),
    createCheckout: (data: { pilotId: string; origin: string }) =>
      createCheckout({ data }).then(after),
    recordManualPayment: (data: { pilotId: string; note: string; confirm: string }) =>
      recordManualPayment({ data }).then(after),
    previewDecision: (data: { evidence: EvidenceItem[] }) => previewDecision({ data }),
    createDecision: (data: { pilotId: string; evidence: EvidenceItem[] }) =>
      createDecision({ data }).then(after),
    patchDecision: (data: { id: string; evidence?: EvidenceItem[]; approvalNote?: string }) =>
      patchDecision({ data }).then(after),
    approveDecision: (data: { id: string; note?: string }) =>
      approveDecision({ data }).then(after),
    generateReport: (data: { pilotId: string }) => generateReport({ data }).then(after),
    getReportPdf: (data: { id: string }) => getReportPdf({ data }),
    createFeedback: (data: { pilotId: string; kind: string; rating?: number; comment?: string }) =>
      createFeedback({ data }).then(after),
    upsertOutcome: (data: {
      pilotId: string;
      outcomeAccuracy?: Outcome["outcomeAccuracy"];
      outcomeValue?: string;
      timeToResolutionDays?: number | null;
      caseStudyPermission?: Outcome["caseStudyPermission"];
      followUpAt?: string | null;
      notes?: string;
    }) => upsertOutcome({ data }).then(after),
    updateOrg: (data: { name?: string }) => updateOrg({ data }).then(after),
    loadSample: () => loadSampleWalkthrough().then(after),
    loadOwnBook: () => loadOwnBook().then(after),
    logOutreach: (data: { id: string; channel?: OutreachChannel; subject?: string; body?: string }) =>
      logOutreach({ data }).then(after),
    pullDeskPacket: (data: { pilotId: string; scenarioId?: string }) =>
      pullDeskPacket({ data }).then(after),
    invalidate,
  };
}

export function useUpdateOrgMutation() {
  const invalidate = useInvalidateLive();
  return useMutation({
    mutationFn: (name: string) => updateOrg({ data: { name } }),
    onSuccess: () => invalidate(),
  });
}

export { errorMessage };
