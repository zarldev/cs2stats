import { useState, useMemo } from "react";
import type { RoundEvent, Player, WinMethod } from "../api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skull, Bomb, Shield, Clock, Crosshair, Trophy, Flame } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  CartesianGrid,
} from "recharts";

const CT_COLOR = "#5B9BD5";

interface RoundTimelineProps {
  rounds: RoundEvent[];
  teamAName: string;
  teamBName: string;
  teamAStartedAs: string;
  players: Player[];
}

function WinMethodIcon({ method, className }: { method: WinMethod; className?: string }) {
  const cls = className ?? "h-3 w-3";
  switch (method) {
    case "WIN_METHOD_ELIMINATION":
      return <Skull className={cls} />;
    case "WIN_METHOD_BOMB_EXPLODED":
      return <Bomb className={cls} />;
    case "WIN_METHOD_BOMB_DEFUSED":
      return <Shield className={cls} />;
    case "WIN_METHOD_TIME_EXPIRED":
      return <Clock className={cls} />;
    default:
      return null;
  }
}

function winMethodLabel(method: WinMethod): string {
  switch (method) {
    case "WIN_METHOD_ELIMINATION":
      return "Elimination";
    case "WIN_METHOD_BOMB_EXPLODED":
      return "Bomb Exploded";
    case "WIN_METHOD_BOMB_DEFUSED":
      return "Bomb Defused";
    case "WIN_METHOD_TIME_EXPIRED":
      return "Time Expired";
    default:
      return "Unknown";
  }
}

function playerName(steamId: string, players: Player[]): string {
  return players.find((p) => p.steamId === steamId)?.name ?? steamId;
}

export function RoundTimeline({
  rounds,
  teamAName,
  teamBName,
  teamAStartedAs,
  players,
}: RoundTimelineProps) {
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  // determine if teamA won each round (accounts for side swap at half)
  const teamAWonRound = (r: RoundEvent): boolean => {
    if (r.roundNumber <= 12) return r.winner === teamAStartedAs;
    return r.winner !== teamAStartedAs;
  };

  // running score
  let scoreA = 0;
  let scoreB = 0;
  const scores = rounds.map((r) => {
    if (teamAWonRound(r)) scoreA++;
    else scoreB++;
    return { a: scoreA, b: scoreB };
  });

  // momentum data for chart
  const momentumData = useMemo(() => {
    let diff = 0;
    return rounds.map((r) => {
      diff += teamAWonRound(r) ? 1 : -1;
      return { round: r.roundNumber, diff };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds, teamAStartedAs]);

  // compute streaks (4+ rounds)
  const streaks = useMemo(() => {
    const result: { team: "A" | "B"; start: number; end: number; length: number }[] = [];
    let curTeam: "A" | "B" | null = null;
    let curStart = 0;
    let curLen = 0;

    for (const r of rounds) {
      const team = teamAWonRound(r) ? "A" as const : "B" as const;
      if (team === curTeam) {
        curLen++;
      } else {
        if (curTeam && curLen >= 4) {
          result.push({ team: curTeam, start: curStart, end: r.roundNumber - 1, length: curLen });
        }
        curTeam = team;
        curStart = r.roundNumber;
        curLen = 1;
      }
    }
    if (curTeam && curLen >= 4) {
      const lastRound = rounds[rounds.length - 1]?.roundNumber ?? curStart;
      result.push({ team: curTeam, start: curStart, end: lastRound, length: curLen });
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds, teamAStartedAs]);

  // half-time scores
  const htA = scores[11]?.a ?? 0;
  const htB = scores[11]?.b ?? 0;

  const selected =
    selectedRound !== null
      ? rounds.find((r) => r.roundNumber === selectedRound)
      : null;
  const selectedIdx =
    selectedRound !== null
      ? rounds.findIndex((r) => r.roundNumber === selectedRound)
      : -1;

  return (
    <div className="space-y-4">
      {/* momentum graph */}
      {momentumData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Momentum</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={momentumData} margin={{ top: 10, right: 20, bottom: 5, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 20% 18%)" />
                  <XAxis
                    dataKey="round"
                    tick={{ fill: "hsl(215 15% 50%)", fontSize: 11 }}
                    label={{
                      value: "Round",
                      fill: "hsl(215 15% 50%)",
                      position: "insideBottom",
                      offset: -5,
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    tick={{ fill: "hsl(215 15% 50%)", fontSize: 11 }}
                    label={{
                      value: `← ${teamBName}  |  ${teamAName} →`,
                      fill: "hsl(215 15% 50%)",
                      angle: -90,
                      position: "insideLeft",
                      fontSize: 10,
                      offset: -10,
                    }}
                  />
                  <ReferenceLine y={0} stroke="hsl(215 15% 40%)" strokeWidth={1.5} />
                  <ReferenceLine
                    x={12.5}
                    stroke="hsl(215 15% 35%)"
                    strokeDasharray="4 4"
                    label={{
                      value: `HT ${htA}-${htB}`,
                      fill: "hsl(215 15% 55%)",
                      fontSize: 10,
                      position: "top",
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(215 25% 12%)",
                      border: "1px solid hsl(215 20% 22%)",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "hsl(215 15% 80%)" }}
                    labelFormatter={(v) => `Round ${v}`}
                    formatter={(value: number) => {
                      if (value > 0) return [`+${value} ${teamAName}`, "Lead"];
                      if (value < 0) return [`+${Math.abs(value)} ${teamBName}`, "Lead"];
                      return ["Tied", "Score"];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="diff"
                    stroke={CT_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CT_COLOR }}
                    activeDot={{ r: 5, fill: CT_COLOR }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* legend */}
      <div className="flex items-center gap-6 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-team-ct" />
          <span className="text-muted-foreground">{teamAName}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-team-t" />
          <span className="text-muted-foreground">{teamBName}</span>
        </span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
          <span className="flex items-center gap-1"><Skull className="h-3 w-3" /> Elim</span>
          <span className="flex items-center gap-1"><Bomb className="h-3 w-3" /> Bomb</span>
          <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Defuse</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Time</span>
        </div>
      </div>

      {/* timeline - horizontal scroll */}
      <div className="overflow-x-auto pb-2">
        {/* score labels above */}
        <div className="mb-1 flex items-center gap-0.5">
          {scores.map((s, i) => {
            const isHalf = rounds[i]?.roundNumber === 12;
            return (
              <div key={i} className="flex items-center gap-0.5">
                <div className="flex w-10 flex-col items-center text-[10px] tabular-nums text-muted-foreground/60">
                  <span>
                    <span className="text-team-ct">{s.a}</span>
                    <span className="text-muted-foreground/30">-</span>
                    <span className="text-team-t">{s.b}</span>
                  </span>
                </div>
                {isHalf && <div className="mx-0.5 w-px" />}
              </div>
            );
          })}
        </div>

        {/* round pills */}
        <div className="flex items-center gap-0.5">
          {rounds.map((r) => {
            const isTeamAWin = teamAWonRound(r);
            const bg = isTeamAWin ? "bg-team-ct" : "bg-team-t";
            const isSelected = selectedRound === r.roundNumber;
            const isHalf = r.roundNumber === 12;

            return (
              <div key={r.roundNumber} className="flex items-center gap-0.5">
                <button
                  onClick={() =>
                    setSelectedRound(
                      selectedRound === r.roundNumber ? null : r.roundNumber,
                    )
                  }
                  className={`flex h-10 w-10 flex-col items-center justify-center rounded-md text-xs transition-all ${bg} ${
                    isSelected
                      ? "ring-2 ring-white ring-offset-2 ring-offset-background"
                      : "opacity-75 hover:opacity-100"
                  }`}
                  title={`R${r.roundNumber}: ${winMethodLabel(r.winMethod)}`}
                >
                  <span className="text-[10px] font-bold leading-none text-background">
                    {r.roundNumber}
                  </span>
                  <WinMethodIcon
                    method={r.winMethod}
                    className="mt-0.5 h-3 w-3 text-background/80"
                  />
                </button>
                {isHalf && (
                  <div className="flex items-center gap-1">
                    <Separator orientation="vertical" className="mx-1 h-10 bg-muted-foreground/30" />
                    <span className="mx-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {htA}-{htB}
                    </span>
                    <Separator orientation="vertical" className="mx-1 h-10 bg-muted-foreground/30" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* streak badges */}
      {streaks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {streaks.map((s, i) => (
            <Badge
              key={i}
              variant="outline"
              className={`gap-1 ${s.team === "A" ? "border-team-ct/30 text-team-ct" : "border-team-t/30 text-team-t"}`}
            >
              <Flame className="h-3 w-3" />
              {s.length}-round {s.team === "A" ? teamAName : teamBName} streak (R{s.start}-{s.end})
            </Badge>
          ))}
        </div>
      )}

      {/* round detail */}
      {selected && selectedIdx >= 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Round {selected.roundNumber}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    teamAWonRound(selected)
                      ? "bg-team-ct/20 text-team-ct"
                      : "bg-team-t/20 text-team-t"
                  }
                >
                  {teamAWonRound(selected) ? teamAName : teamBName} Win
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <WinMethodIcon method={selected.winMethod} className="h-3 w-3" />
                  {winMethodLabel(selected.winMethod)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {selected.firstKill && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Crosshair className="h-3 w-3" />
                    First Kill
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">
                      {playerName(selected.firstKill.attackerSteamId, players)}
                    </span>
                    <span className="mx-1.5 text-muted-foreground">&rarr;</span>
                    <span className="font-medium">
                      {playerName(selected.firstKill.victimSteamId, players)}
                    </span>
                  </div>
                  {selected.firstKill.weapon && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                        {selected.firstKill.weapon}
                      </Badge>
                      {selected.firstKill.roundTime > 0 && (
                        <span>{selected.firstKill.roundTime.toFixed(1)}s</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selected.clutch && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-yellow-400">
                    <Trophy className="h-3 w-3" />
                    Clutch
                  </div>
                  <div className="text-sm font-medium">
                    {playerName(selected.clutch.playerSteamId, players)}
                  </div>
                  <div className="mt-1">
                    <Badge
                      className={
                        selected.clutch.won
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }
                    >
                      1v{selected.clutch.opponentsAlive}{" "}
                      {selected.clutch.won ? "Won" : "Lost"}
                    </Badge>
                  </div>
                </div>
              )}

              {selected.plant && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Bomb className="h-3 w-3" />
                    Bomb Plant
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">
                      {playerName(selected.plant.planterSteamId, players)}
                    </span>
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                      Site {selected.plant.site}
                    </Badge>
                  </div>
                  {selected.plant.roundTime > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {selected.plant.roundTime.toFixed(1)}s
                    </div>
                  )}
                </div>
              )}

              {selected.defuse && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    Bomb Defuse
                  </div>
                  <div className="text-sm font-medium">
                    {playerName(selected.defuse.defuserSteamId, players)}
                  </div>
                  {selected.defuse.roundTime > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {selected.defuse.roundTime.toFixed(1)}s
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
