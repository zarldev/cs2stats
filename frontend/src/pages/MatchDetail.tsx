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
      <div className="rounded-lg border border-border bg-card py-12 text-center text-muted-foreground">
        Match not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* header card */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-2 text-sm text-muted-foreground">{formatDate(match.date)}</div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-semibold text-team-ct">{match.teamAName}</div>
            </div>
            <div className="flex items-baseline gap-2 text-3xl font-bold tabular-nums">
              <span className="text-team-ct">{match.teamAScore}</span>
              <span className="text-muted-foreground/50">:</span>
              <span className="text-team-t">{match.teamBScore}</span>
            </div>
            <div>
              <div className="text-lg font-semibold text-team-t">{match.teamBName}</div>
            </div>
          </div>
          <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
            <span>{match.mapName}</span>
            <span>&middot;</span>
            <span>{formatDuration(match.durationSeconds)}</span>
          </div>
        </CardContent>
      </Card>

      {/* tabbed content */}
      <Tabs defaultValue="scoreboard">
        <TabsList>
          <TabsTrigger value="scoreboard">Scoreboard</TabsTrigger>
          <TabsTrigger value="rounds">Rounds</TabsTrigger>
          <TabsTrigger value="economy">Economy</TabsTrigger>
          <TabsTrigger value="killmap">Kill Map</TabsTrigger>
        </TabsList>

        <TabsContent value="scoreboard">
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
            />
          )}
        </TabsContent>

        <TabsContent value="rounds">
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
              players={players}
            />
          )}
        </TabsContent>

        <TabsContent value="economy">
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
            />
          )}
        </TabsContent>

        <TabsContent value="killmap">
          <Suspense
            fallback={
              <div className="space-y-2">
                <Skeleton className="h-[600px] w-[600px]" />
              </div>
            }
          >
            {posQ.isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-[600px] w-[600px]" />
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
