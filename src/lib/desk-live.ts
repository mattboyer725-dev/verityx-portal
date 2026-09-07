import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getLiveSnapshot } from "@/lib/live-api";
import { fallbackBundle } from "@/lib/feeds";
import { seedAdapterCards } from "@/lib/adapters";

export const deskKeys = {
  tape: ["desk", "tape"] as const,
};

export type DeskTape = Awaited<ReturnType<typeof getLiveSnapshot>>;

const TAPE_PLACEHOLDER = {
  ...fallbackBundle(),
  sapCount: 0,
  sap: [],
  ariba: [],
  writebacks: [],
  cluster: [],
  adapters: [],
  core: undefined,
} as unknown as DeskTape;

export function useDeskTape(enabled = true) {
  const client = useQueryClient();
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const es = new EventSource("/api/oracle/stream");
    es.addEventListener("tick", (ev) => {
      try {
        const tick = JSON.parse((ev as MessageEvent).data) as {
          argus?: DeskTape["argus"];
          lme?: { copperUsdMt: number; aluminiumUsdMt: number; source: string };
          fx?: DeskTape["fx"];
        };
        client.setQueryData(deskKeys.tape, (prev: DeskTape | undefined) => {
          if (!prev) return prev;
          return {
            ...prev,
            argus: tick.argus || prev.argus,
            fx: tick.fx || prev.fx,
            lme: tick.lme ? { ...prev.lme, ...tick.lme } : prev.lme,
            health: { ...prev.health, argus: tick.argus ? "LIVE" : prev.health.argus },
          };
        });
      } catch {
        /* ignore malformed tick */
      }
    });
    es.onerror = () => {
      /* polling remains */
    };
    return () => es.close();
  }, [client, enabled]);

  return useQuery({
    queryKey: deskKeys.tape,
    queryFn: () => getLiveSnapshot(),
    enabled: enabled && typeof window !== "undefined",
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    placeholderData: (previous) => previous ?? TAPE_PLACEHOLDER,
    retry: 0,
  });
}

export function useLiveAdapters() {
  const tape = useDeskTape();
  const live = tape.data?.adapters;
  const adapters = live?.length ? live : seedAdapterCards();
  return { tape, adapters };
}

export function useDeskTapeCache() {
  return useQueryClient();
}
