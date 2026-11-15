import { useQuery } from "@tanstack/react-query";
import { getLiveSnapshot } from "@/lib/live-api";
import { fallbackBundle } from "@/lib/feeds";
import { seedAdapterCards } from "@/lib/adapters";

export const deskKeys = {
  tape: ["desk", "tape"] as const,
};

export type DeskTape = Awaited<ReturnType<typeof getLiveSnapshot>>;

const TAPE_PLACEHOLDER = {
  ...fallbackBundle(),
  adapters: [],
  core: undefined,
} as unknown as DeskTape;

/** Live data-source health and reference prices, refreshed every 15 seconds. */
export function useDeskTape(enabled = true) {
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
