import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useListMatches } from "../api/queries";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MatchTableSkeleton } from "@/components/skeletons";

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
  const hasFilters = mapFilter || playerSearch || dateFrom || dateTo;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Matches</h1>

      {/* filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Select
          value={mapFilter}
          onChange={(e) => setMapFilter(e.target.value)}
          className="w-auto"
        >
          <option value="">All Maps</option>
          {MAPS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>

        <Input
          type="text"
          placeholder="Player Steam ID..."
          value={playerSearch}
          onChange={(e) => setPlayerSearch(e.target.value)}
          className="w-auto max-w-[200px]"
        />

        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-auto"
        />

        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-auto"
        />

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMapFilter("");
              setPlayerSearch("");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* loading state */}
      {isLoading && <MatchTableSkeleton />}

      {/* error state */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {/* empty state */}
      {!isLoading && matches.length === 0 && (
        <div className="rounded-lg border border-border bg-card py-12 text-center text-muted-foreground">
          No matches found. Upload a demo to get started.
        </div>
      )}

      {/* match table */}
      {matches.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Map
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Teams
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                  Score
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr
                  key={m.id}
                  className="border-t border-border transition-colors hover:bg-muted/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      to="/matches/$matchId"
                      params={{ matchId: m.id }}
                      className="font-medium text-foreground hover:text-team-ct transition-colors"
                    >
                      <Badge variant="secondary" className="font-mono text-xs">
                        {m.mapName.replace("de_", "")}
                      </Badge>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(m.date)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-team-ct">{m.teamAName}</span>
                    <span className="mx-2 text-muted-foreground/50">vs</span>
                    <span className="text-team-t">{m.teamBName}</span>
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    <span className="text-team-ct">{m.teamAScore}</span>
                    <span className="mx-1 text-muted-foreground/50">:</span>
                    <span className="text-team-t">{m.teamBScore}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
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
          <Button
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}
