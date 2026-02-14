import { useState, lazy, Suspense } from "react";
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

const KillMap = lazy(() =>
  import("../components/KillMap").then((m) => ({ default: m.KillMap })),
);

type Tab = "scoreboard" | "rounds" | "economy" | "killmap";

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
  const { matchId } = useParams({ from: "/match/$matchId" });
  const [tab, setTab] = useState<Tab>("scoreboard");

  const matchQ = useGetMatch(matchId);
  const statsQ = usePlayerStats(matchId);
  const economyQ = useEconomyStats(matchId);
  const roundsQ = useRoundTimeline(matchId);
  const posQ = usePositionalData(matchId);

  if (matchQ.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-slate-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-team-ct" />
        Loading match...
      </div>
    );
  }

  if (matchQ.isError) {
    return (
      <div className="rounded bg-red-900/30 p-4 text-sm text-red-300">
        {matchQ.error.message}
      </div>
    );
  }

  const match = matchQ.data?.match;
  const players = matchQ.data?.players ?? [];

  if (!match) {
    return (
      <div className="py-8 text-center text-slate-500">Match not found.</div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "scoreboard", label: "Scoreboard" },
    { key: "rounds", label: "Rounds" },
    { key: "economy", label: "Economy" },
    { key: "killmap", label: "Kill Map" },
  ];

  return (
    <div>
      {/* header */}
      <div className="mb-6 rounded-lg bg-slate-900 p-6">
        <div className="mb-2 text-sm text-slate-500">{formatDate(match.date)}</div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-lg font-semibold text-team-ct">{match.teamAName}</div>
          </div>
          <div className="flex items-baseline gap-2 text-3xl font-bold tabular-nums">
            <span className="text-team-ct">{match.teamAScore}</span>
            <span className="text-slate-600">:</span>
            <span className="text-team-t">{match.teamBScore}</span>
          </div>
          <div>
            <div className="text-lg font-semibold text-team-t">{match.teamBName}</div>
          </div>
        </div>
        <div className="mt-2 flex gap-4 text-sm text-slate-400">
          <span>{match.mapName}</span>
          <span>&middot;</span>
          <span>{formatDuration(match.durationSeconds)}</span>
        </div>
      </div>

      {/* tabs */}
      <div className="mb-6 flex gap-1 border-b border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-team-ct text-team-ct"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* tab content */}
      <div>
        {tab === "scoreboard" && (
          <>
            {statsQ.isLoading && (
              <div className="flex items-center gap-2 py-4 text-slate-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-team-ct" />
                Loading stats...
              </div>
            )}
            {statsQ.isError && (
              <div className="rounded bg-red-900/30 p-4 text-sm text-red-300">
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
          </>
        )}

        {tab === "rounds" && (
          <>
            {roundsQ.isLoading && (
              <div className="flex items-center gap-2 py-4 text-slate-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-team-ct" />
                Loading rounds...
              </div>
            )}
            {roundsQ.isError && (
              <div className="rounded bg-red-900/30 p-4 text-sm text-red-300">
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
          </>
        )}

        {tab === "economy" && (
          <>
            {economyQ.isLoading && (
              <div className="flex items-center gap-2 py-4 text-slate-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-team-ct" />
                Loading economy...
              </div>
            )}
            {economyQ.isError && (
              <div className="rounded bg-red-900/30 p-4 text-sm text-red-300">
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
          </>
        )}

        {tab === "killmap" && (
          <Suspense
            fallback={
              <div className="flex items-center gap-2 py-4 text-slate-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-team-ct" />
                Loading kill map...
              </div>
            }
          >
            {posQ.isLoading && (
              <div className="flex items-center gap-2 py-4 text-slate-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-team-ct" />
                Loading positional data...
              </div>
            )}
            {posQ.isError && (
              <div className="rounded bg-red-900/30 p-4 text-sm text-red-300">
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
        )}
      </div>
    </div>
  );
}
