import { useState, useMemo } from "react";
import type { PlayerStats } from "../api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Star, Crown, Crosshair } from "lucide-react";

type SortKey = keyof Pick<
  PlayerStats,
  "kills" | "deaths" | "assists" | "adr" | "kast" | "hsPct" | "rating"
>;

interface ScoreboardProps {
  players: PlayerStats[];
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
}

const columns: { key: SortKey; label: string; fmt?: (v: number) => string }[] = [
  { key: "kills", label: "K" },
  { key: "deaths", label: "D" },
  { key: "assists", label: "A" },
  { key: "adr", label: "ADR", fmt: (v) => v.toFixed(1) },
  { key: "kast", label: "KAST%", fmt: (v) => v.toFixed(1) },
  { key: "hsPct", label: "HS%", fmt: (v) => v.toFixed(1) },
  { key: "rating", label: "Rating", fmt: (v) => v.toFixed(2) },
];

function kdColor(diff: number): string {
  if (diff > 0) return "text-green-400";
  if (diff < 0) return "text-red-400";
  return "text-muted-foreground";
}

function adrColor(val: number): string {
  if (val >= 80) return "text-green-400";
  if (val >= 60) return "text-yellow-400";
  return "text-red-400";
}

function ratingColor(val: number): string {
  if (val > 1.0) return "text-green-400";
  if (val >= 0.8) return "text-yellow-400";
  return "text-red-400";
}

function ratingTier(val: number): { label: string; color: string } | null {
  if (val > 1.3) return { label: "Dominant", color: "text-green-400" };
  if (val >= 1.1) return { label: "Star", color: "text-blue-400" };
  if (val >= 0.9) return { label: "Solid", color: "text-muted-foreground" };
  return { label: "Struggling", color: "text-red-400" };
}

function cellColor(key: SortKey, val: number): string | undefined {
  switch (key) {
    case "adr":
      return adrColor(val);
    case "rating":
      return ratingColor(val);
    default:
      return undefined;
  }
}

export function Scoreboard({
  players,
  teamAName,
  teamBName,
  teamAScore,
  teamBScore,
}: ScoreboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = useMemo(
    () =>
      [...players].sort((a, b) => {
        const diff = a[sortKey] - b[sortKey];
        return sortAsc ? diff : -diff;
      }),
    [players, sortKey, sortAsc],
  );

  const teamA = sorted.filter((p) => p.team === "CT");
  const teamB = sorted.filter((p) => p.team === "T");

  // MVP is highest rated player overall
  const mvpSteamId = useMemo(() => {
    if (players.length === 0) return null;
    return [...players].sort((a, b) => b.rating - a.rating)[0]?.steamId ?? null;
  }, [players]);

  // compute standout performers per team
  const standouts = useMemo(() => {
    const byTeam = (team: string) => players.filter((p) => p.team === team);
    const computeTeamStandouts = (teamPlayers: PlayerStats[]) => {
      if (teamPlayers.length === 0) return [];
      const result: { player: PlayerStats; label: string; stat: string; icon: "mvp" | "entry" }[] = [];
      const topRating = [...teamPlayers].sort((a, b) => b.rating - a.rating)[0];
      if (topRating) {
        const isMvp = topRating.steamId === mvpSteamId;
        result.push({
          player: topRating,
          label: isMvp ? "MVP" : "Top Rated",
          stat: `${topRating.rating.toFixed(2)} rating`,
          icon: "mvp",
        });
      }
      // highest K/D player (different from top rating)
      const topKD = [...teamPlayers].sort((a, b) => (b.kills - b.deaths) - (a.kills - a.deaths))[0];
      if (topKD && topKD.steamId !== topRating?.steamId) {
        const diff = topKD.kills - topKD.deaths;
        result.push({
          player: topKD,
          label: "Top Fragger",
          stat: `${diff > 0 ? "+" : ""}${diff} K/D`,
          icon: "entry",
        });
      }
      return result;
    };
    return {
      ct: computeTeamStandouts(byTeam("CT")),
      t: computeTeamStandouts(byTeam("T")),
    };
  }, [players, mvpSteamId]);

  const computeAverages = (team: PlayerStats[]) => {
    if (team.length === 0) return null;
    const n = team.length;
    return {
      adr: team.reduce((s, p) => s + p.adr, 0) / n,
      kast: team.reduce((s, p) => s + p.kast, 0) / n,
      hsPct: team.reduce((s, p) => s + p.hsPct, 0) / n,
      rating: team.reduce((s, p) => s + p.rating, 0) / n,
    };
  };

  const renderTeam = (
    team: PlayerStats[],
    name: string,
    score: number,
    borderColor: string,
    textColor: string,
    teamStandouts: { player: PlayerStats; label: string; stat: string; icon: "mvp" | "entry" }[],
  ) => {
    const avg = computeAverages(team);
    return (
      <Card>
        <CardHeader className={`border-l-4 pb-3 ${borderColor}`}>
          <div className="flex items-center justify-between">
            <CardTitle className={`text-base ${textColor}`}>{name}</CardTitle>
            <span className={`text-2xl font-bold tabular-nums ${textColor}`}>{score}</span>
          </div>
        </CardHeader>
        {teamStandouts.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-2 pt-1">
            {teamStandouts.map((s) => (
              <div
                key={s.player.steamId}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5"
              >
                {s.icon === "mvp" ? (
                  <Crown className="h-3.5 w-3.5 text-yellow-400" />
                ) : (
                  <Crosshair className="h-3.5 w-3.5 text-blue-400" />
                )}
                <div className="text-xs">
                  <span className="font-medium text-foreground">{s.player.name}</span>
                  <span className="ml-1.5 text-muted-foreground">{s.stat}</span>
                </div>
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  {s.label}
                </Badge>
              </div>
            ))}
          </div>
        )}
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Player</TableHead>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className="ml-0.5 inline-block align-middle">
                        {sortAsc ? (
                          <ChevronUp className="inline h-3 w-3" />
                        ) : (
                          <ChevronDown className="inline h-3 w-3" />
                        )}
                      </span>
                    )}
                  </TableHead>
                ))}
                <TableHead className="text-right">+/-</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((p) => {
                const kd = p.kills - p.deaths;
                const isMvp = p.steamId === mvpSteamId;
                return (
                  <TableRow key={p.steamId}>
                    <TableCell className="pl-4">
                      <span className={`font-medium ${textColor}`}>{p.name}</span>
                      {isMvp && (
                        <Badge
                          variant="outline"
                          className="ml-2 border-yellow-500/50 px-1.5 py-0 text-[10px] text-yellow-400"
                        >
                          <Star className="mr-0.5 inline h-2.5 w-2.5" />
                          MVP
                        </Badge>
                      )}
                    </TableCell>
                    {columns.map((col) => {
                      const tier = col.key === "rating" ? ratingTier(p[col.key]) : null;
                      return (
                        <TableCell
                          key={col.key}
                          className={`text-right tabular-nums ${cellColor(col.key, p[col.key]) ?? ""}`}
                        >
                          {col.fmt ? col.fmt(p[col.key]) : p[col.key]}
                          {tier && (
                            <span className={`ml-1 text-[10px] ${tier.color} opacity-70`}>
                              {tier.label}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className={`text-right tabular-nums ${kdColor(kd)}`}>
                      {kd > 0 ? `+${kd}` : kd}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            {avg && (
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="pl-4 text-xs text-muted-foreground">Average</TableCell>
                  {/* K, D, A columns empty */}
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell className={`text-right tabular-nums text-xs ${adrColor(avg.adr)}`}>
                    {avg.adr.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {avg.kast.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {avg.hsPct.toFixed(1)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums text-xs ${ratingColor(avg.rating)}`}>
                    {avg.rating.toFixed(2)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {renderTeam(teamA, teamAName, teamAScore, "border-team-ct", "text-team-ct", standouts.ct)}
      {renderTeam(teamB, teamBName, teamBScore, "border-team-t", "text-team-t", standouts.t)}
    </div>
  );
}
