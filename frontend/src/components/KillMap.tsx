import { useState, useMemo } from "react";
import type { KillPosition, Player } from "../api/types";

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

  // compute coordinate bounds for normalization
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
    // add padding
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

  const playerName = (steamId: string) =>
    players.find((p) => p.steamId === steamId)?.name ?? steamId;

  const roundOptions = Array.from({ length: totalRounds }, (_, i) => i + 1);

  return (
    <div>
      {/* filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={filterRound}
          onChange={(e) => setFilterRound(Number(e.target.value))}
          className="rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-team-ct"
        >
          <option value={0}>All Rounds</option>
          {roundOptions.map((r) => (
            <option key={r} value={r}>
              Round {r}
            </option>
          ))}
        </select>

        <select
          value={filterPlayer}
          onChange={(e) => setFilterPlayer(e.target.value)}
          className="rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-team-ct"
        >
          <option value="">All Players</option>
          {players.map((p) => (
            <option key={p.steamId} value={p.steamId}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={filterWeapon}
          onChange={(e) => setFilterWeapon(e.target.value)}
          className="rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-team-ct"
        >
          <option value="">All Weapons</option>
          {weapons.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>

      {/* map canvas */}
      <div className="relative inline-block rounded-lg bg-slate-800 p-2">
        <svg
          width={MAP_SIZE}
          height={MAP_SIZE}
          className="rounded bg-slate-900"
        >
          {/* grid lines */}
          {Array.from({ length: 11 }, (_, i) => {
            const pos = (i / 10) * MAP_SIZE;
            return (
              <g key={i}>
                <line
                  x1={pos}
                  y1={0}
                  x2={pos}
                  y2={MAP_SIZE}
                  stroke="#1e293b"
                  strokeWidth={1}
                />
                <line
                  x1={0}
                  y1={pos}
                  x2={MAP_SIZE}
                  y2={pos}
                  stroke="#1e293b"
                  strokeWidth={1}
                />
              </g>
            );
          })}

          {/* kill lines and dots */}
          {filtered.map((k, i) => {
            const ap = normalize(k.attackerPos.x, k.attackerPos.y);
            const vp = normalize(k.victimPos.x, k.victimPos.y);
            return (
              <g key={i}>
                {/* line from attacker to victim */}
                <line
                  x1={ap.nx}
                  y1={ap.ny}
                  x2={vp.nx}
                  y2={vp.ny}
                  stroke="#475569"
                  strokeWidth={0.5}
                  opacity={0.4}
                />
                {/* attacker dot */}
                <circle
                  cx={ap.nx}
                  cy={ap.ny}
                  r={k.isHeadshot ? 5 : 4}
                  fill={teamColor(k.attackerSteamId)}
                  opacity={0.8}
                  stroke={k.isHeadshot ? "#fff" : "none"}
                  strokeWidth={k.isHeadshot ? 1 : 0}
                  onMouseEnter={() =>
                    setHovered({ kill: k, x: ap.nx, y: ap.ny })
                  }
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer"
                />
                {/* victim dot (X mark) */}
                <g
                  onMouseEnter={() =>
                    setHovered({ kill: k, x: vp.nx, y: vp.ny })
                  }
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer"
                >
                  <line
                    x1={vp.nx - 3}
                    y1={vp.ny - 3}
                    x2={vp.nx + 3}
                    y2={vp.ny + 3}
                    stroke={teamColor(k.victimSteamId)}
                    strokeWidth={2}
                    opacity={0.7}
                  />
                  <line
                    x1={vp.nx + 3}
                    y1={vp.ny - 3}
                    x2={vp.nx - 3}
                    y2={vp.ny + 3}
                    stroke={teamColor(k.victimSteamId)}
                    strokeWidth={2}
                    opacity={0.7}
                  />
                </g>
              </g>
            );
          })}
        </svg>

        {/* hover tooltip */}
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 rounded bg-slate-950 px-3 py-2 text-xs shadow-lg"
            style={{
              left: hovered.x + 12,
              top: hovered.y - 10,
            }}
          >
            <div className="text-slate-200">
              {playerName(hovered.kill.attackerSteamId)}{" "}
              <span className="text-slate-500">&rarr;</span>{" "}
              {playerName(hovered.kill.victimSteamId)}
            </div>
            <div className="text-slate-400">
              {hovered.kill.weapon}
              {hovered.kill.isHeadshot && " (HS)"}
            </div>
            <div className="text-slate-500">Round {hovered.kill.roundNumber}</div>
          </div>
        )}

        {/* legend */}
        <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-team-ct" />
            <span>{teamAName} (attacker)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-team-t" />
            <span>{teamBName} (attacker)</span>
          </span>
          <span className="flex items-center gap-1">
            <svg width="10" height="10">
              <line x1="1" y1="1" x2="9" y2="9" stroke="#94a3b8" strokeWidth="2" />
              <line x1="9" y1="1" x2="1" y2="9" stroke="#94a3b8" strokeWidth="2" />
            </svg>
            <span>victim</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-white bg-slate-600" />
            <span>headshot</span>
          </span>
        </div>
      </div>
    </div>
  );
}
