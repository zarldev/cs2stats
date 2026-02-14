import { useState } from "react";
import type { PlayerStats } from "../api/types";

type SortKey = keyof Pick<
  PlayerStats,
  "kills" | "deaths" | "assists" | "adr" | "kast" | "hsPct" | "rating"
>;

interface ScoreboardProps {
  players: PlayerStats[];
  teamAName: string;
  teamBName: string;
}

export function Scoreboard({ players, teamAName, teamBName }: ScoreboardProps) {
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

  const sorted = [...players].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortAsc ? diff : -diff;
  });

  const teamA = sorted.filter((p) => p.team === "CT");
  const teamB = sorted.filter((p) => p.team === "T");

  const columns: { key: SortKey; label: string; fmt?: (v: number) => string }[] = [
    { key: "kills", label: "K" },
    { key: "deaths", label: "D" },
    { key: "assists", label: "A" },
    { key: "adr", label: "ADR", fmt: (v) => v.toFixed(1) },
    { key: "kast", label: "KAST%", fmt: (v) => v.toFixed(1) },
    { key: "hsPct", label: "HS%", fmt: (v) => v.toFixed(1) },
    { key: "rating", label: "Rating", fmt: (v) => v.toFixed(2) },
  ];

  const headerCell = (col: { key: SortKey; label: string }) => (
    <th
      key={col.key}
      onClick={() => handleSort(col.key)}
      className="cursor-pointer px-3 py-2 text-right text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      {col.label}
      {sortKey === col.key && (
        <span className="ml-1">{sortAsc ? "\u25B2" : "\u25BC"}</span>
      )}
    </th>
  );

  const playerRow = (p: PlayerStats, teamColor: string) => (
    <tr key={p.steamId} className="border-t border-border hover:bg-muted/50">
      <td className="px-3 py-2">
        <span className={teamColor}>{p.name}</span>
      </td>
      {columns.map((col) => (
        <td key={col.key} className="px-3 py-2 text-right text-sm tabular-nums">
          {col.fmt ? col.fmt(p[col.key]) : p[col.key]}
        </td>
      ))}
    </tr>
  );

  const renderTeam = (team: PlayerStats[], name: string, color: string, textColor: string) => (
    <div className="mb-6">
      <div className={`mb-2 flex items-center gap-2 border-l-4 pl-3 ${color}`}>
        <span className="font-semibold">{name}</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Player
            </th>
            {columns.map(headerCell)}
          </tr>
        </thead>
        <tbody>{team.map((p) => playerRow(p, textColor))}</tbody>
      </table>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      {renderTeam(teamA, teamAName, "border-team-ct", "text-team-ct")}
      {renderTeam(teamB, teamBName, "border-team-t", "text-team-t")}
    </div>
  );
}
