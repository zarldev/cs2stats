import { useState, useMemo } from "react";
import type { KillPosition, Player } from "../api/types";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KillMapProps {
  kills: KillPosition[];
  players: Player[];
  teamAName: string;
  teamBName: string;
  totalRounds: number;
}

const MAP_SIZE = 600;
const CT_COLOR = "#5B9BD5";
const T_COLOR = "#EAC843";

interface HoveredKill {
  kill: KillPosition;
  x: number;
  y: number;
}

export function KillMap({
  kills,
  players,
  teamAName,
  teamBName,
  totalRounds,
}: KillMapProps) {
  const [filterRound, setFilterRound] = useState(0);
  const [filterPlayer, setFilterPlayer] = useState("");
  const [filterWeapon, setFilterWeapon] = useState("");
  const [hovered, setHovered] = useState<HoveredKill | null>(null);

  const weapons = useMemo(
    () => [...new Set(kills.map((k) => k.weapon))].sort(),
    [kills],
  );

  const bounds = useMemo(() => {
    if (kills.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const k of kills) {
      for (const pos of [k.attackerPos, k.victimPos]) {
        if (pos.x < minX) minX = pos.x;
        if (pos.x > maxX) maxX = pos.x;
        if (pos.y < minY) minY = pos.y;
        if (pos.y > maxY) maxY = pos.y;
      }
    }
    const padX = (maxX - minX) * 0.05 || 1;
    const padY = (maxY - minY) * 0.05 || 1;
    return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
  }, [kills]);

  const normalize = (x: number, y: number) => ({
    nx: ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (MAP_SIZE - 40) + 20,
    ny: ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * (MAP_SIZE - 40) + 20,
  });

  const filtered = useMemo(() => {
    return kills.filter((k) => {
      if (filterRound > 0 && k.roundNumber !== filterRound) return false;
      if (filterPlayer && k.attackerSteamId !== filterPlayer && k.victimSteamId !== filterPlayer)
        return false;
      if (filterWeapon && k.weapon !== filterWeapon) return false;
      return true;
    });
  }, [kills, filterRound, filterPlayer, filterWeapon]);

  const playerTeam = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of players) map.set(p.steamId, p.team);
    return map;
  }, [players]);

  const teamColor = (steamId: string) =>
    playerTeam.get(steamId) === "CT" ? CT_COLOR : T_COLOR;

  const getPlayerName = (steamId: string) =>
    players.find((p) => p.steamId === steamId)?.name ?? steamId;

  const roundOptions = Array.from({ length: totalRounds }, (_, i) => i + 1);

  return (
    <div className="space-y-4">
      {/* filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Round</label>
              <Select
                value={filterRound}
                onChange={(e) => setFilterRound(Number(e.target.value))}
                className="w-[140px]"
              >
                <option value={0}>All Rounds</option>
                {roundOptions.map((r) => (
                  <option key={r} value={r}>
                    Round {r}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Player</label>
              <Select
                value={filterPlayer}
                onChange={(e) => setFilterPlayer(e.target.value)}
                className="w-[160px]"
              >
                <option value="">All Players</option>
                {players.map((p) => (
                  <option key={p.steamId} value={p.steamId}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Weapon</label>
              <Select
                value={filterWeapon}
                onChange={(e) => setFilterWeapon(e.target.value)}
                className="w-[160px]"
              >
                <option value="">All Weapons</option>
                {weapons.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* map canvas */}
      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <div className="relative inline-block rounded-lg border border-border bg-card p-3">
          <svg
            width={MAP_SIZE}
            height={MAP_SIZE}
            className="rounded bg-background"
            style={{ maxWidth: "100%", height: "auto" }}
          >
            {/* grid */}
            {Array.from({ length: 11 }, (_, i) => {
              const pos = (i / 10) * MAP_SIZE;
              return (
                <g key={i}>
                  <line
                    x1={pos} y1={0} x2={pos} y2={MAP_SIZE}
                    stroke="hsl(215 25% 13%)" strokeWidth={1}
                  />
                  <line
                    x1={0} y1={pos} x2={MAP_SIZE} y2={pos}
                    stroke="hsl(215 25% 13%)" strokeWidth={1}
                  />
                </g>
              );
            })}

            {/* glow filter */}
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* kill lines and markers */}
            {filtered.map((k, i) => {
              const ap = normalize(k.attackerPos.x, k.attackerPos.y);
              const vp = normalize(k.victimPos.x, k.victimPos.y);
              const aColor = teamColor(k.attackerSteamId);
              const vColor = teamColor(k.victimSteamId);
              // when a player filter is active, dim kills that don't involve the selected player as attacker
              const isPlayerFiltered = filterPlayer !== "";
              const isHighlighted = !isPlayerFiltered || k.attackerSteamId === filterPlayer;
              const baseOpacity = isHighlighted ? 0.9 : 0.08;
              const lineOpacity = isHighlighted ? 0.4 : 0.05;
              const dotRadius = isHighlighted && isPlayerFiltered ? (k.isHeadshot ? 6 : 5) : (k.isHeadshot ? 5 : 4);
              return (
                <g key={i}>
                  {/* dotted line */}
                  <line
                    x1={ap.nx} y1={ap.ny} x2={vp.nx} y2={vp.ny}
                    stroke="hsl(215 15% 30%)"
                    strokeWidth={0.8}
                    strokeDasharray="3 3"
                    opacity={lineOpacity}
                  />
                  {/* attacker dot with glow */}
                  <circle
                    cx={ap.nx} cy={ap.ny}
                    r={dotRadius}
                    fill={aColor}
                    opacity={baseOpacity}
                    filter={isHighlighted ? "url(#glow)" : undefined}
                    stroke={k.isHeadshot ? "#fff" : aColor}
                    strokeWidth={k.isHeadshot ? 1.5 : 0.5}
                    strokeOpacity={isHighlighted ? (k.isHeadshot ? 0.8 : 0.3) : 0.05}
                    onMouseEnter={() => setHovered({ kill: k, x: ap.nx, y: ap.ny })}
                    onMouseLeave={() => setHovered(null)}
                    className="cursor-pointer"
                  />
                  {/* victim X mark */}
                  <g
                    onMouseEnter={() => setHovered({ kill: k, x: vp.nx, y: vp.ny })}
                    onMouseLeave={() => setHovered(null)}
                    className="cursor-pointer"
                  >
                    <line
                      x1={vp.nx - 4} y1={vp.ny - 4} x2={vp.nx + 4} y2={vp.ny + 4}
                      stroke={vColor} strokeWidth={2} opacity={isHighlighted ? 0.8 : 0.08}
                    />
                    <line
                      x1={vp.nx + 4} y1={vp.ny - 4} x2={vp.nx - 4} y2={vp.ny + 4}
                      stroke={vColor} strokeWidth={2} opacity={isHighlighted ? 0.8 : 0.08}
                    />
                  </g>
                </g>
              );
            })}
          </svg>

          {/* hover tooltip */}
          {hovered && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg"
              style={{
                left: Math.min(hovered.x + 16, MAP_SIZE - 120),
                top: Math.max(hovered.y - 10, 0),
              }}
            >
              <div className="font-medium text-foreground">
                {getPlayerName(hovered.kill.attackerSteamId)}{" "}
                <span className="text-muted-foreground">&rarr;</span>{" "}
                {getPlayerName(hovered.kill.victimSteamId)}
              </div>
              <div className="text-muted-foreground">
                {hovered.kill.weapon}
                {hovered.kill.isHeadshot && (
                  <span className="ml-1 text-yellow-400">(HS)</span>
                )}
              </div>
              <div className="text-muted-foreground/60">Round {hovered.kill.roundNumber}</div>
            </div>
          )}
        </div>

        {/* legend card */}
        <Card className="w-full lg:w-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Legend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-team-ct shadow-[0_0_6px_rgba(91,155,213,0.5)]" />
              <span>{teamAName} (CT)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-team-t shadow-[0_0_6px_rgba(234,200,67,0.5)]" />
              <span>{teamBName} (T)</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="12" height="12">
                <circle cx="6" cy="6" r="4" fill="currentColor" opacity={0.6} />
              </svg>
              <span>Attacker position</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="12" height="12">
                <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="2" />
                <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span>Victim position</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-muted" />
              <span>Headshot</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="20" height="2">
                <line x1="0" y1="1" x2="20" y2="1" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity={0.5} />
              </svg>
              <span>Kill line</span>
            </div>
            <div className="pt-1 tabular-nums text-muted-foreground/70">
              {filtered.length} kill{filtered.length !== 1 ? "s" : ""} shown
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
