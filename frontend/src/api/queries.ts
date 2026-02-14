import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  listMatches,
  getMatch,
  uploadDemo,
  getPlayerStats,
  getEconomyStats,
  getRoundTimeline,
  getPositionalData,
} from "./client";

const PAGE_SIZE = 20;

export function useListMatches(filters?: {
  mapName?: string;
  playerSteamId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useInfiniteQuery({
    queryKey: ["matches", filters],
    queryFn: ({ pageParam }) =>
      listMatches({
        pageSize: PAGE_SIZE,
        pageToken: pageParam,
        mapName: filters?.mapName,
        playerSteamId: filters?.playerSteamId,
        dateFrom: filters?.dateFrom,
        dateTo: filters?.dateTo,
      }),
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextPageToken || undefined,
  });
}

export function useGetMatch(matchId: string) {
  return useQuery({
    queryKey: ["match", matchId],
    queryFn: () => getMatch(matchId),
    enabled: !!matchId,
  });
}

export function useUploadDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadDemo,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
}

export function usePlayerStats(matchId: string) {
  return useQuery({
    queryKey: ["playerStats", matchId],
    queryFn: () => getPlayerStats(matchId),
    enabled: !!matchId,
  });
}

export function useEconomyStats(matchId: string) {
  return useQuery({
    queryKey: ["economyStats", matchId],
    queryFn: () => getEconomyStats(matchId),
    enabled: !!matchId,
  });
}

export function useRoundTimeline(matchId: string) {
  return useQuery({
    queryKey: ["roundTimeline", matchId],
    queryFn: () => getRoundTimeline(matchId),
    enabled: !!matchId,
  });
}

export function usePositionalData(matchId: string, roundNumber?: number) {
  return useQuery({
    queryKey: ["positionalData", matchId, roundNumber],
    queryFn: () => getPositionalData(matchId, roundNumber),
    enabled: !!matchId,
  });
}
