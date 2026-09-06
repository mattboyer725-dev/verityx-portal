import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { getLiveSnapshot } from "@/lib/live-api";
import { fallbackBundle } from "@/lib/feeds";

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
  core: undefined,
} as unknown as DeskTape;

export function useDeskTape(enabled = true) {
  return useQuery({
    queryKey: deskKeys.tape,
    queryFn: () =>
      Promise.race([
        getLiveSnapshot(),
        new Promise<DeskTape>((resolve) => setTimeout(() => resolve(TAPE_PLACEHOLDER), 3500)),
      ]),
    enabled: enabled && typeof window !== "undefined",
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    placeholderData: keepPreviousData,
    initialData: TAPE_PLACEHOLDER,
    retry: 0,
  });
}

export function useDeskTapeCache() {
  return useQueryClient();
}
