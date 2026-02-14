// fetch-based client for ConnectRPC JSON endpoints

import type {
  ListMatchesRequest,
  ListMatchesResponse,
  GetMatchResponse,
  UploadDemoResponse,
  GetPlayerStatsResponse,
  GetEconomyStatsResponse,
  GetRoundTimelineResponse,
  GetPositionalDataResponse,
} from "./types";

async function rpc<TReq, TRes>(
  service: string,
  method: string,
  request: TReq,
): Promise<TRes> {
  const url = `/${service}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${method}: ${res.status} ${body}`);
  }

  return res.json() as Promise<TRes>;
}

// demo.v1.DemoService

export function listMatches(
  req: ListMatchesRequest,
): Promise<ListMatchesResponse> {
  return rpc("demo.v1.DemoService", "ListMatches", req);
}

export function getMatch(matchId: string): Promise<GetMatchResponse> {
  return rpc("demo.v1.DemoService", "GetMatch", { matchId });
}

export async function uploadDemo(file: File): Promise<UploadDemoResponse> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // chunk to avoid call stack overflow with spread operator
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);
  return rpc("demo.v1.DemoService", "UploadDemo", {
    demoFile: base64,
    fileName: file.name,
  });
}

// stats.v1.StatsService

export function getPlayerStats(
  matchId: string,
  steamId?: string,
): Promise<GetPlayerStatsResponse> {
  return rpc("stats.v1.StatsService", "GetPlayerStats", {
    matchId,
    steamId: steamId ?? "",
  });
}

export function getEconomyStats(
  matchId: string,
): Promise<GetEconomyStatsResponse> {
  return rpc("stats.v1.StatsService", "GetEconomyStats", { matchId });
}

export function getRoundTimeline(
  matchId: string,
): Promise<GetRoundTimelineResponse> {
  return rpc("stats.v1.StatsService", "GetRoundTimeline", { matchId });
}

export function getPositionalData(
  matchId: string,
  roundNumber?: number,
): Promise<GetPositionalDataResponse> {
  return rpc("stats.v1.StatsService", "GetPositionalData", {
    matchId,
    roundNumber: roundNumber ?? 0,
  });
}
