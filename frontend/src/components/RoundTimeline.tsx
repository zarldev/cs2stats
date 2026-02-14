import { useState } from "react";
import type { RoundEvent, Player, WinMethod } from "../api/types";

interface RoundTimelineProps {
  rounds: RoundEvent[];
  teamAName: string;
  teamBName: string;
  players: Player[];
}

function winMethodIcon(method: WinMethod): string {
  switch (method) {
    case "WIN_METHOD_ELIMINATION":
      return "\u2620"; // skull
    case "WIN_METHOD_BOMB_EXPLODED":
      return "\uD83D\uDCA3"; // bomb
    case "WIN_METHOD_BOMB_DEFUSED":
      return "\uD83D\uDEE1"; // shield
    case "WIN_METHOD_TIME_EXPIRED":
      return "\u23F1"; // timer
    default:
      return "?";
  }
}

function winMethodLabel(method: WinMethod): string {
  switch (method) {
    case "WIN_METHOD_ELIMINATION":
      return "Elimination";
    case "WIN_METHOD_BOMB_EXPLODED":
      return "Bomb Exploded";
    case "WIN_METHOD_BOMB_DEFUSED":
      return "Bomb Defused";
    case "WIN_METHOD_TIME_EXPIRED":
      return "Time Expired";
    default:
      return "Unknown";
  }
}

function playerName(steamId: string, players: Player[]): string {
  return players.find((p) => p.steamId === steamId)?.name ?? steamId;
}

export function RoundTimeline({
  rounds,
  teamAName,
  teamBName,
  players,
}: RoundTimelineProps) {
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  // compute running score -- winner is "CT" or "T"
  let scoreA = 0;
  let scoreB = 0;
  const scores = rounds.map((r) => {
    if (r.winner === "CT") scoreA++;
    else scoreB++;
    return { a: scoreA, b: scoreB };
  });

  const selected = selectedRound !== null
    ? rounds.find((r) => r.roundNumber === selectedRound)
    : null;

  return (
    <div>
      {/* score legend */}
      <div className="mb-4 flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-team-ct" />
          <span className="text-muted-foreground">{teamAName}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-team-t" />
          <span className="text-muted-foreground">{teamBName}</span>
        </span>
      </div>

      {/* round pills */}
      <div className="flex flex-wrap gap-1">
        {rounds.map((r, i) => {
          const isTeamA = r.winner === "CT";
          const bg = isTeamA ? "bg-team-ct" : "bg-team-t";
          const isSelected = selectedRound === r.roundNumber;

          return (
            <button
              key={r.roundNumber}
              onClick={() =>
                setSelectedRound(
                  selectedRound === r.roundNumber ? null : r.roundNumber,
                )
              }
              className={`flex h-10 w-10 flex-col items-center justify-center rounded text-xs font-medium transition-all ${bg} ${
                isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-background" : "opacity-80 hover:opacity-100"
              }`}
              title={`R${r.roundNumber}: ${scores[i]?.a}-${scores[i]?.b} (${winMethodLabel(r.winMethod)})`}
            >
              <span className="text-[10px] text-background font-bold">{r.roundNumber}</span>
              <span className="text-[10px]">{winMethodIcon(r.winMethod)}</span>
            </button>
          );
        })}
      </div>

      {/* score progression */}
      <div className="mt-4 flex flex-wrap gap-1 text-xs text-muted-foreground">
        {scores.map((s, i) => (
          <span key={i} className="w-10 text-center">
            {s.a}-{s.b}
          </span>
        ))}
      </div>

      {/* round detail */}
      {selected && (
        <div className="mt-6 rounded-lg bg-muted p-4">
          <h4 className="mb-3 font-semibold">
            Round {selected.roundNumber} &mdash;{" "}
            <span
              className={
                selected.winner === "CT" ? "text-team-ct" : "text-team-t"
              }
            >
              {selected.winner}
            </span>{" "}
            ({winMethodLabel(selected.winMethod)})
          </h4>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {selected.firstKill && (
              <div className="rounded bg-background p-3">
                <div className="text-xs text-muted-foreground">First Kill</div>
                <div>
                  {playerName(selected.firstKill.attackerSteamId, players)}{" "}
                  <span className="text-muted-foreground">&rarr;</span>{" "}
                  {playerName(selected.firstKill.victimSteamId, players)}
                </div>
                {selected.firstKill.weapon && (
                  <div className="text-xs text-muted-foreground">
                    {selected.firstKill.weapon}
                    {selected.firstKill.roundTime > 0 && ` at ${selected.firstKill.roundTime.toFixed(1)}s`}
                  </div>
                )}
              </div>
            )}

            {selected.clutch && (
              <div className="rounded bg-background p-3">
                <div className="text-xs text-muted-foreground">Clutch</div>
                <div>
                  {playerName(selected.clutch.playerSteamId, players)} 1v
                  {selected.clutch.opponentsAlive}
                </div>
                <div
                  className={`text-xs ${selected.clutch.won ? "text-green-400" : "text-red-400"}`}
                >
                  {selected.clutch.won ? "Won" : "Lost"}
                </div>
              </div>
            )}

            {selected.plant && (
              <div className="rounded bg-background p-3">
                <div className="text-xs text-muted-foreground">Bomb Plant</div>
                <div>
                  {playerName(selected.plant.planterSteamId, players)} &rarr;
                  Site {selected.plant.site}
                </div>
                {selected.plant.roundTime > 0 && (
                  <div className="text-xs text-muted-foreground">
                    at {selected.plant.roundTime.toFixed(1)}s
                  </div>
                )}
              </div>
            )}

            {selected.defuse && (
              <div className="rounded bg-background p-3">
                <div className="text-xs text-muted-foreground">Bomb Defuse</div>
                <div>
                  {playerName(selected.defuse.defuserSteamId, players)}
                </div>
                {selected.defuse.roundTime > 0 && (
                  <div className="text-xs text-muted-foreground">
                    at {selected.defuse.roundTime.toFixed(1)}s
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
