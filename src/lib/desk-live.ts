import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { getLiveSnapshot } from "@/lib/live-api";

export const deskKeys = {
  tape: ["desk", "tape"] as const,
};

export type DeskTape = Awaited<ReturnType<typeof getLiveSnapshot>>;

export function useDeskTape(enabled = true) {
  return useQuery({
    queryKey: deskKeys.tape,
    queryFn: () => getLiveSnapshot(),
    enabled,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    placeholderData: keepPreviousData,
  });
}

export function useDeskTapeCache() {
  return useQueryClient();
}
