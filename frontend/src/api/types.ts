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

export enum BuyType {
  UNSPECIFIED = 0,
  ECO = 1,
  FORCE = 2,
  FULL = 3,
  PISTOL = 4,
}

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

export enum WinMethod {
  UNSPECIFIED = 0,
  ELIMINATION = 1,
  BOMB_EXPLODED = 2,
  BOMB_DEFUSED = 3,
  TIME_EXPIRED = 4,
}

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
