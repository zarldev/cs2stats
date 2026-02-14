import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Map as MapIcon, Clock, Calendar, Gamepad2, ArrowRight } from "lucide-react";
import { useListMatches } from "../api/queries";
import type { Match } from "../api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/skeletons";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
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

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface SummaryStats {
  totalMatches: number;
  mostPlayedMap: string;
  mostPlayedMapCount: number;
  avgDuration: number;
  lastUpload: string;
}

function computeStats(matches: Match[]): SummaryStats {
  if (matches.length === 0) {
    return {
      totalMatches: 0,
      mostPlayedMap: "-",
      mostPlayedMapCount: 0,
      avgDuration: 0,
      lastUpload: "",
    };
  }

  const mapCounts = new Map<string, number>();
  let totalDuration = 0;
  let latestDate = "";

  for (const m of matches) {
    mapCounts.set(m.mapName, (mapCounts.get(m.mapName) ?? 0) + 1);
    totalDuration += m.durationSeconds;
    if (!latestDate || m.date > latestDate) {
      latestDate = m.date;
    }
  }

  let mostPlayedMap = "";
  let mostPlayedMapCount = 0;
  for (const [map, count] of mapCounts) {
    if (count > mostPlayedMapCount) {
      mostPlayedMap = map;
      mostPlayedMapCount = count;
    }
  }

  return {
    totalMatches: matches.length,
    mostPlayedMap,
    mostPlayedMapCount,
    avgDuration: Math.round(totalDuration / matches.length),
    lastUpload: latestDate,
  };
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function RecentMatchCard({ match }: { match: Match }) {
  return (
    <Link to="/matches/$matchId" params={{ matchId: match.id }}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="flex items-center gap-4 p-4">
          <Badge variant="secondary" className="shrink-0 font-mono text-xs">
            {match.mapName.replace("de_", "")}
          </Badge>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-team-ct">{match.teamAName}</span>
              <span className="tabular-nums font-semibold">
                <span className="text-team-ct">{match.teamAScore}</span>
                <span className="text-muted-foreground mx-0.5">:</span>
                <span className="text-team-t">{match.teamBScore}</span>
              </span>
              <span className="text-team-t">{match.teamBName}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatDate(match.date)}</span>
              <span>&middot;</span>
              <span>{formatDuration(match.durationSeconds)}</span>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}

export function Dashboard() {
  const { data, isLoading, isError, error } = useListMatches();

  const allMatches = useMemo(
    () => data?.pages.flatMap((p) => p.matches) ?? [],
    [data],
  );

  const stats = useMemo(() => computeStats(allMatches), [allMatches]);
  const recentMatches = useMemo(() => allMatches.slice(0, 5), [allMatches]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Matches"
          value={String(stats.totalMatches)}
          subtitle={stats.totalMatches === 1 ? "match parsed" : "matches parsed"}
          icon={Gamepad2}
        />
        <StatCard
          title="Most Played Map"
          value={stats.mostPlayedMap ? stats.mostPlayedMap.replace("de_", "") : "-"}
          subtitle={stats.mostPlayedMapCount > 0 ? `${stats.mostPlayedMapCount} matches` : undefined}
          icon={MapIcon}
        />
        <StatCard
          title="Avg Duration"
          value={stats.avgDuration > 0 ? formatDuration(stats.avgDuration) : "-"}
          subtitle="per match"
          icon={Clock}
        />
        <StatCard
          title="Last Upload"
          value={stats.lastUpload ? formatRelativeDate(stats.lastUpload) : "-"}
          subtitle={stats.lastUpload ? formatDate(stats.lastUpload) : undefined}
          icon={Calendar}
        />
      </div>

      {/* recent matches */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Matches</h2>
          {allMatches.length > 5 && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/matches" className="gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>

        {recentMatches.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No matches yet. Upload a demo to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentMatches.map((m) => (
              <RecentMatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
