import { lazy, Suspense } from "react";
import { useParams } from "@tanstack/react-router";
import {
  useGetMatch,
  usePlayerStats,
  useEconomyStats,
  useRoundTimeline,
  usePositionalData,
} from "../api/queries";
import { Scoreboard } from "../components/Scoreboard";
import { RoundTimeline } from "../components/RoundTimeline";
import { EconomyChart } from "../components/EconomyChart";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchDetailSkeleton, ScoreboardSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Copy, Check, Map as MapIcon, Flame, Timer } from "lucide-react";
import { useState, useMemo } from "react";
import type { RoundEvent } from "../api/types";
import { toast } from "sonner";

const KillMap = lazy(() =>
  import("../components/KillMap").then((m) => ({ default: m.KillMap })),
);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function CopyHash({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      toast.success("Demo hash copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy to clipboard: permission denied");
    }
  };

  return (
    <button
      onClick={() => void handleCopy()}
      className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
      title="Copy demo hash"
    >
      {hash.slice(0, 12)}...
      {copied ? (
        <Check className="h-3 w-3 text-green-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

function computeMatchResultLabel(scoreA: number, scoreB: number): { label: string; color: string } {
  const total = scoreA + scoreB;
  const diff = Math.abs(scoreA - scoreB);
  if (total > 30) return { label: "Overtime", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" };
  if (diff === 0) return { label: "Draw", color: "bg-muted text-muted-foreground" };
  if (diff >= 8) return { label: "Decisive Win", color: "bg-green-500/20 text-green-400 border-green-500/30" };
  if (diff >= 4) return { label: "Comfortable Win", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  return { label: "Close Match", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
}

function computeHalftimeScore(
  rounds: RoundEvent[],
  teamAStartedAs: string,
): { teamAFirstHalf: number; teamBFirstHalf: number } {
  let teamAFirstHalf = 0;
  let teamBFirstHalf = 0;
  for (const r of rounds) {
    if (r.roundNumber > 12) break;
    if (r.winner === teamAStartedAs) {
      teamAFirstHalf++;
    } else {
      teamBFirstHalf++;
    }
  }
  return { teamAFirstHalf, teamBFirstHalf };
}

function computeLongestStreak(rounds: RoundEvent[], teamAStartedAs: string): { team: "A" | "B"; length: number } {
  let bestTeam: "A" | "B" = "A";
  let bestLen = 0;
  let curTeam: "A" | "B" | null = null;
  let curLen = 0;

  for (const r of rounds) {
    // in first half, teamA plays as teamAStartedAs. In second half, sides swap.
    const teamAWon =
      r.roundNumber <= 12
        ? r.winner === teamAStartedAs
        : r.winner !== teamAStartedAs;
    const team = teamAWon ? "A" as const : "B" as const;

    if (team === curTeam) {
      curLen++;
    } else {
      curTeam = team;
      curLen = 1;
    }
    if (curLen > bestLen) {
      bestLen = curLen;
      bestTeam = team;
    }
  }
  return { team: bestTeam, length: bestLen };
}

export function MatchDetail() {
  const { matchId } = useParams({ from: "/matches/$matchId" });

  const matchQ = useGetMatch(matchId);
  const statsQ = usePlayerStats(matchId);
  const economyQ = useEconomyStats(matchId);
  const roundsQ = useRoundTimeline(matchId);
  const posQ = usePositionalData(matchId);

  if (matchQ.isLoading) {
    return <MatchDetailSkeleton />;
  }

  if (matchQ.isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {matchQ.error.message}
      </div>
    );
  }

  const match = matchQ.data?.match;
  const players = matchQ.data?.players ?? [];

  if (!match) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium text-muted-foreground">Match not found</p>
        </CardContent>
      </Card>
    );
  }

  const aWon = match.teamAScore > match.teamBScore;
  const bWon = match.teamBScore > match.teamAScore;

  const roundData = roundsQ.data?.rounds ?? [];
  const resultBadge = computeMatchResultLabel(match.teamAScore, match.teamBScore);
  const totalRounds = match.teamAScore + match.teamBScore;
  const isOvertime = totalRounds > 30;

  const halftime = useMemo(() => {
    if (roundData.length === 0 || !match.teamAStartedAs) return null;
    return computeHalftimeScore(roundData, match.teamAStartedAs);
  }, [roundData, match.teamAStartedAs]);

  const longestStreak = useMemo(() => {
    if (roundData.length === 0 || !match.teamAStartedAs) return null;
    return computeLongestStreak(roundData, match.teamAStartedAs);
  }, [roundData, match.teamAStartedAs]);

  return (
    <div className="space-y-6">
      {/* header card */}
      <Card>
        <CardContent className="p-6">
          {/* map name */}
          <div className="mb-4 flex items-center gap-3">
            <MapIcon className="h-5 w-5 text-muted-foreground" />
            <span className="text-xl font-bold">{match.mapName}</span>
          </div>

          {/* team scores */}
          <div className="flex items-center justify-center gap-6 py-4">
            <div className="text-right">
              <div className={`text-lg font-semibold text-team-ct ${aWon ? "text-xl" : ""}`}>
                {match.teamAName}
              </div>
            </div>
            <div className="flex items-baseline gap-3 tabular-nums">
              <span className={`text-team-ct ${aWon ? "text-5xl font-bold" : "text-4xl font-semibold opacity-70"}`}>
                {match.teamAScore}
              </span>
              <span className="text-2xl text-muted-foreground/40">:</span>
              <span className={`text-team-t ${bWon ? "text-5xl font-bold" : "text-4xl font-semibold opacity-70"}`}>
                {match.teamBScore}
              </span>
            </div>
            <div>
              <div className={`text-lg font-semibold text-team-t ${bWon ? "text-xl" : ""}`}>
                {match.teamBName}
              </div>
            </div>
          </div>

          {/* narrative badges */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline" className={resultBadge.color}>
              {resultBadge.label}
            </Badge>
            {halftime && (
              <Badge variant="outline" className="gap-1 tabular-nums text-muted-foreground">
                HT: {halftime.teamAFirstHalf}-{halftime.teamBFirstHalf}
              </Badge>
            )}
            <Badge variant="outline" className="gap-1 tabular-nums text-muted-foreground">
              {totalRounds} rounds
            </Badge>
            {isOvertime && (
              <Badge variant="outline" className="gap-1 bg-purple-500/20 text-purple-400 border-purple-500/30">
                <Timer className="h-3 w-3" />
                OT
              </Badge>
            )}
            {longestStreak && longestStreak.length >= 4 && (
              <Badge variant="outline" className="gap-1 bg-orange-500/20 text-orange-400 border-orange-500/30">
                <Flame className="h-3 w-3" />
                {longestStreak.length}-round streak ({longestStreak.team === "A" ? match.teamAName : match.teamBName})
              </Badge>
            )}
          </div>

          {/* metadata row */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(match.date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(match.durationSeconds)}
            </span>
            {match.demoFileHash && <CopyHash hash={match.demoFileHash} />}
          </div>
        </CardContent>
      </Card>

      {/* tabbed content */}
      <Tabs defaultValue="scoreboard">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="scoreboard">Scoreboard</TabsTrigger>
          <TabsTrigger value="rounds">Rounds</TabsTrigger>
          <TabsTrigger value="economy">Economy</TabsTrigger>
          <TabsTrigger value="killmap">Kill Map</TabsTrigger>
        </TabsList>

        <TabsContent value="scoreboard" className="mt-4">
          {statsQ.isLoading && <ScoreboardSkeleton />}
          {statsQ.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {statsQ.error.message}
            </div>
          )}
          {statsQ.data && (
            <Scoreboard
              players={statsQ.data.players}
              teamAName={match.teamAName}
              teamBName={match.teamBName}
              teamAScore={match.teamAScore}
              teamBScore={match.teamBScore}
            />
          )}
        </TabsContent>

        <TabsContent value="rounds" className="mt-4">
          {roundsQ.isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}
          {roundsQ.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {roundsQ.error.message}
            </div>
          )}
          {roundsQ.data && (
            <RoundTimeline
              rounds={roundsQ.data.rounds}
              teamAName={match.teamAName}
              teamBName={match.teamBName}
              teamAStartedAs={match.teamAStartedAs}
              players={players}
            />
          )}
        </TabsContent>

        <TabsContent value="economy" className="mt-4">
          {economyQ.isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-80 w-full" />
            </div>
          )}
          {economyQ.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {economyQ.error.message}
            </div>
          )}
          {economyQ.data && (
            <EconomyChart
              rounds={economyQ.data.rounds}
              teamAName={match.teamAName}
              teamBName={match.teamBName}
              teamAStartedAs={match.teamAStartedAs}
              roundWinners={roundData.map((r) => r.winner)}
            />
          )}
        </TabsContent>

        <TabsContent value="killmap" className="mt-4">
          <Suspense
            fallback={
              <div className="space-y-2">
                <Skeleton className="h-[600px] w-full max-w-[600px]" />
              </div>
            }
          >
            {posQ.isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-[600px] w-full max-w-[600px]" />
              </div>
            )}
            {posQ.isError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {posQ.error.message}
              </div>
            )}
            {posQ.data && (
              <KillMap
                kills={posQ.data.kills}
                players={players}
                teamAName={match.teamAName}
                teamBName={match.teamBName}
                totalRounds={match.teamAScore + match.teamBScore}
              />
            )}
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
