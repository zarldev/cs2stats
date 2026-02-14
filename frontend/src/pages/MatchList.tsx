import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useListMatches } from "../api/queries";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { MatchTableSkeleton } from "@/components/skeletons";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  ChevronRight,
  X,
  Swords,
} from "lucide-react";
import type { Match } from "../api/types";

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

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `${m}m ago`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return `${h}h ago`;
  }
  if (diffSec < 604800) {
    const d = Math.floor(diffSec / 86400);
    return `${d}d ago`;
  }
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
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

type SortField = "mapName" | "date" | "durationSeconds" | "score";
type SortDir = "asc" | "desc";

function matchScore(m: Match): number {
  return m.teamAScore + m.teamBScore;
}

function compareMatches(a: Match, b: Match, field: SortField, dir: SortDir): number {
  let diff = 0;
  switch (field) {
    case "mapName":
      diff = a.mapName.localeCompare(b.mapName);
      break;
    case "date":
      diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      break;
    case "durationSeconds":
      diff = a.durationSeconds - b.durationSeconds;
      break;
    case "score":
      diff = matchScore(a) - matchScore(b);
      break;
  }
  return dir === "asc" ? diff : -diff;
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) {
    return <ChevronsUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />;
  }
  return sortDir === "asc" ? (
    <ChevronUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ChevronDown className="ml-1 inline h-3 w-3" />
  );
}

export function MatchList() {
  const [mapFilter, setMapFilter] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error } =
    useListMatches({
      mapName: mapFilter || undefined,
      playerSteamId: playerSearch || undefined,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
    });

  const matches = data?.pages.flatMap((p) => p.matches) ?? [];
  const hasFilters = mapFilter || playerSearch || dateFrom || dateTo;

  const sorted = useMemo(
    () => [...matches].sort((a, b) => compareMatches(a, b, sortField, sortDir)),
    [matches, sortField, sortDir],
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const clearFilters = () => {
    setMapFilter("");
    setPlayerSearch("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Matches</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="gap-1.5 text-muted-foreground"
        >
          <Filter className="h-4 w-4" />
          Filters
          <ChevronRight
            className={`h-3 w-3 transition-transform ${filtersOpen ? "rotate-90" : ""}`}
          />
        </Button>
      </div>

      {/* collapsible filters */}
      {filtersOpen && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Map</label>
                <Select
                  value={mapFilter}
                  onChange={(e) => setMapFilter(e.target.value)}
                  className="w-[160px]"
                >
                  <option value="">All Maps</option>
                  {MAPS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Player Steam ID</label>
                <Input
                  type="text"
                  placeholder="Search..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="w-[180px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[150px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[150px]"
                />
              </div>

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* loading */}
      {isLoading && <MatchTableSkeleton />}

      {/* error */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {/* empty state */}
      {!isLoading && !isError && matches.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Swords className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">
              {hasFilters ? "No matches found" : "No matches yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              {hasFilters
                ? "Try adjusting your filters"
                : "Upload a demo to get started"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* match table */}
      {sorted.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("mapName")}
                >
                  Map
                  <SortIcon field="mapName" sortField={sortField} sortDir={sortDir} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("date")}
                >
                  Date
                  <SortIcon field="date" sortField={sortField} sortDir={sortDir} />
                </TableHead>
                <TableHead>Teams</TableHead>
                <TableHead
                  className="cursor-pointer select-none text-center"
                  onClick={() => handleSort("score")}
                >
                  Score
                  <SortIcon field="score" sortField={sortField} sortDir={sortDir} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right"
                  onClick={() => handleSort("durationSeconds")}
                >
                  Duration
                  <SortIcon field="durationSeconds" sortField={sortField} sortDir={sortDir} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((m) => {
                const aWon = m.teamAScore > m.teamBScore;
                const bWon = m.teamBScore > m.teamAScore;
                return (
                  <TableRow key={m.id} className="group">
                    <TableCell>
                      <Link
                        to="/matches/$matchId"
                        params={{ matchId: m.id }}
                        className="inline-block"
                      >
                        <Badge variant="secondary" className="font-mono text-xs transition-colors group-hover:bg-primary/20">
                          {m.mapName.replace("de_", "")}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/matches/$matchId"
                        params={{ matchId: m.id }}
                        className="block"
                      >
                        <span className="text-sm text-foreground">{formatRelativeTime(m.date)}</span>
                        <span className="ml-2 hidden text-xs text-muted-foreground/70 sm:inline">
                          {formatDate(m.date)}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/matches/$matchId"
                        params={{ matchId: m.id }}
                        className="block text-sm"
                      >
                        <span className="text-team-ct">{m.teamAName}</span>
                        <span className="mx-2 text-muted-foreground/40">vs</span>
                        <span className="text-team-t">{m.teamBName}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <Link
                        to="/matches/$matchId"
                        params={{ matchId: m.id }}
                        className="block tabular-nums"
                      >
                        <span className={`text-team-ct ${aWon ? "font-bold" : ""}`}>
                          {m.teamAScore}
                        </span>
                        <span className="mx-1 text-muted-foreground/40">:</span>
                        <span className={`text-team-t ${bWon ? "font-bold" : ""}`}>
                          {m.teamBScore}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to="/matches/$matchId"
                        params={{ matchId: m.id }}
                        className="block text-sm tabular-nums text-muted-foreground"
                      >
                        {formatDuration(m.durationSeconds)}
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* load more */}
      {hasNextPage && (
        <div className="mt-4 flex justify-center gap-2">
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
