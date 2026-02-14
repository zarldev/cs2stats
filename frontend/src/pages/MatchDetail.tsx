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
import { Clock, Calendar, Copy, Check, Map as MapIcon } from "lucide-react";
import { useState } from "react";
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
