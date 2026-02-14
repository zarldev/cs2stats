import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useListMatches } from "../api/queries";

const MAPS = [
  "de_dust2",
  "de_mirage",
  "de_inferno",
  "de_nuke",
  "de_overpass",
  "de_ancient",
  "de_vertigo",
  "de_anubis",
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
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

export function MatchList() {
  const [mapFilter, setMapFilter] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error } =
    useListMatches({
      mapName: mapFilter || undefined,
      playerSteamId: playerSearch || undefined,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
    });

  const matches = data?.pages.flatMap((p) => p.matches) ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-100">Matches</h1>

      {/* filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={mapFilter}
          onChange={(e) => setMapFilter(e.target.value)}
          className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-team-ct"
        >
          <option value="">All Maps</option>
          {MAPS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Player Steam ID..."
          value={playerSearch}
          onChange={(e) => setPlayerSearch(e.target.value)}
          className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:ring-1 focus:ring-team-ct"
        />

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-team-ct"
        />

        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-team-ct"
        />

        {(mapFilter || playerSearch || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setMapFilter("");
              setPlayerSearch("");
              setDateFrom("");
              setDateTo("");
            }}
            className="rounded px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
          >
            Clear
          </button>
        )}
      </div>

      {/* loading/error states */}
      {isLoading && (
        <div className="flex items-center gap-2 py-8 text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-team-ct" />
          Loading matches...
        </div>
      )}

      {isError && (
        <div className="rounded bg-red-900/30 p-4 text-sm text-red-300">
          {error.message}
        </div>
      )}

      {/* match table */}
      {!isLoading && matches.length === 0 && (
        <div className="py-8 text-center text-slate-500">
          No matches found. Upload a demo to get started.
        </div>
      )}

      {matches.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">
                  Map
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">
                  Teams
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">
                  Score
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr
                  key={m.id}
                  className="border-t border-slate-800 transition-colors hover:bg-slate-800/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      to="/match/$matchId"
                      params={{ matchId: m.id }}
                      className="font-medium text-slate-200 hover:text-team-ct"
                    >
                      {m.mapName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {formatDate(m.date)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-team-ct">{m.teamAName}</span>
                    <span className="mx-2 text-slate-600">vs</span>
                    <span className="text-team-t">{m.teamBName}</span>
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    <span className="text-team-ct">{m.teamAScore}</span>
                    <span className="mx-1 text-slate-600">:</span>
                    <span className="text-team-t">{m.teamBScore}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-400 tabular-nums">
                    {formatDuration(m.durationSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* load more */}
      {hasNextPage && (
        <div className="mt-4 text-center">
          <button
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-md bg-slate-800 px-6 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
