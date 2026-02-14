// types matching the proto contract in proto/demo/v1/demo.proto
// and proto/stats/v1/stats.proto

// demo.v1

export interface Match {
  id: string;
  mapName: string;
  date: string; // ISO timestamp
  durationSeconds: number;
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  demoFileHash: string;
}

export interface Player {
  steamId: string;
  name: string;
  team: string;
}

export interface UploadDemoRequest {
  demoFile: string; // base64-encoded
  fileName: string;
}

export interface UploadDemoResponse {
  matchId: string;
}

export interface ListMatchesRequest {
  pageSize: number;
  pageToken: string;
  mapName?: string;
  playerSteamId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ListMatchesResponse {
  matches: Match[];
  nextPageToken: string;
}

export interface GetMatchRequest {
  matchId: string;
}

export interface GetMatchResponse {
  match: Match;
  players: Player[];
}

// stats.v1

export interface PlayerStats {
  steamId: string;
  name: string;
  team: string;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  kast: number;
  hsPct: number;
  rating: number;
  flashAssists: number;
  utilityDamage: number;
}

export interface GetPlayerStatsResponse {
  players: PlayerStats[];
}

// proto JSON serializes enums as strings
export type BuyType =
  | "BUY_TYPE_UNSPECIFIED"
  | "BUY_TYPE_ECO"
  | "BUY_TYPE_FORCE"
  | "BUY_TYPE_FULL"
  | "BUY_TYPE_PISTOL";

export interface EconomyRound {
  roundNumber: number;
  teamASpend: number;
  teamBSpend: number;
  teamAEquipmentValue: number;
  teamBEquipmentValue: number;
  teamABuyType: BuyType;
  teamBBuyType: BuyType;
}

export interface GetEconomyStatsResponse {
  rounds: EconomyRound[];
}

// proto JSON serializes enums as strings
export type WinMethod =
  | "WIN_METHOD_UNSPECIFIED"
  | "WIN_METHOD_ELIMINATION"
  | "WIN_METHOD_BOMB_EXPLODED"
  | "WIN_METHOD_BOMB_DEFUSED"
  | "WIN_METHOD_TIME_EXPIRED";

export interface FirstKill {
  attackerSteamId: string;
  victimSteamId: string;
  weapon: string;
  roundTime: number;
}

export interface ClutchInfo {
  playerSteamId: string;
  opponentsAlive: number;
  won: boolean;
}

export interface PlantEvent {
  planterSteamId: string;
  site: string;
  roundTime: number;
}

export interface DefuseEvent {
  defuserSteamId: string;
  roundTime: number;
}

export interface RoundEvent {
  roundNumber: number;
  winner: string;
  winMethod: WinMethod;
  firstKill?: FirstKill;
  clutch?: ClutchInfo;
  plant?: PlantEvent;
  defuse?: DefuseEvent;
}

export interface GetRoundTimelineResponse {
  rounds: RoundEvent[];
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface KillPosition {
  roundNumber: number;
  attackerSteamId: string;
  victimSteamId: string;
  attackerPos: Position;
  victimPos: Position;
  weapon: string;
  isHeadshot: boolean;
}

export interface GetPositionalDataResponse {
  mapName: string;
  kills: KillPosition[];
}
