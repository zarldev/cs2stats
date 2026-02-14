import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useMemo } from "react";
import type { EconomyRound, BuyType } from "../api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp } from "lucide-react";

interface EconomyChartProps {
  rounds: EconomyRound[];
  teamAName: string;
  teamBName: string;
  teamAStartedAs: string;
  roundWinners: string[];
}

function buyTypeLabel(bt: BuyType): string {
  switch (bt) {
    case "BUY_TYPE_ECO":
      return "Eco";
    case "BUY_TYPE_FORCE":
      return "Force";
    case "BUY_TYPE_FULL":
      return "Full";
    case "BUY_TYPE_PISTOL":
      return "Pistol";
    default:
      return "";
  }
}

function buyTypeBadgeClass(bt: BuyType): string {
  switch (bt) {
    case "BUY_TYPE_ECO":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "BUY_TYPE_FORCE":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "BUY_TYPE_FULL":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "BUY_TYPE_PISTOL":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

const CT_COLOR = "#5B9BD5";
const T_COLOR = "#EAC843";

function teamAWonRound(roundNumber: number, winner: string, teamAStartedAs: string): boolean {
  if (roundNumber <= 12) return winner === teamAStartedAs;
  return winner !== teamAStartedAs;
}

function buyOutcomeBadge(buyType: BuyType, won: boolean): { label: string; cls: string } | null {
  const label = buyTypeLabel(buyType);
  if (!label) return null;
  if (won) {
    if (buyType === "BUY_TYPE_ECO" || buyType === "BUY_TYPE_FORCE") {
      return { label: `${label} Win!`, cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
    }
    return { label: "Won", cls: "bg-green-500/20 text-green-400 border-green-500/30" };
  }
  return { label: "Lost", cls: "bg-red-500/20 text-red-400 border-red-500/30" };
}

export function EconomyChart({
  rounds,
  teamAName,
  teamBName,
  teamAStartedAs,
  roundWinners,
}: EconomyChartProps) {
  const data = rounds.map((r) => ({
    round: r.roundNumber,
    teamAEquip: r.teamAEquipmentValue,
    teamBEquip: r.teamBEquipmentValue,
    teamASpend: r.teamASpend,
    teamBSpend: r.teamBSpend,
    teamABuy: r.teamABuyType,
    teamBBuy: r.teamBBuyType,
  }));

  // economic narrative stats
  const ecoStats = useMemo(() => {
    let teamAEcoWins = 0;
    let teamBEcoWins = 0;
    let teamAForceWins = 0;
    let teamBForceWins = 0;

    for (const r of rounds) {
      const winner = roundWinners[r.roundNumber - 1];
      if (!winner) continue;
      const aWon = teamAWonRound(r.roundNumber, winner, teamAStartedAs);

      if (aWon) {
        if (r.teamABuyType === "BUY_TYPE_ECO") teamAEcoWins++;
        if (r.teamABuyType === "BUY_TYPE_FORCE") teamAForceWins++;
      } else {
        if (r.teamBBuyType === "BUY_TYPE_ECO") teamBEcoWins++;
        if (r.teamBBuyType === "BUY_TYPE_FORCE") teamBForceWins++;
      }
    }
    return { teamAEcoWins, teamBEcoWins, teamAForceWins, teamBForceWins };
  }, [rounds, roundWinners, teamAStartedAs]);

  const hasNarrative =
    ecoStats.teamAEcoWins + ecoStats.teamBEcoWins + ecoStats.teamAForceWins + ecoStats.teamBForceWins > 0;

  return (
    <div className="space-y-4">
      {/* economic narrative badges */}
      {hasNarrative && (
        <div className="flex flex-wrap gap-2">
          {ecoStats.teamAEcoWins > 0 && (
            <Badge variant="outline" className="gap-1 border-team-ct/30 text-team-ct">
              <DollarSign className="h-3 w-3" />
              {teamAName}: {ecoStats.teamAEcoWins} eco win{ecoStats.teamAEcoWins > 1 ? "s" : ""}
            </Badge>
          )}
          {ecoStats.teamBEcoWins > 0 && (
            <Badge variant="outline" className="gap-1 border-team-t/30 text-team-t">
              <DollarSign className="h-3 w-3" />
              {teamBName}: {ecoStats.teamBEcoWins} eco win{ecoStats.teamBEcoWins > 1 ? "s" : ""}
            </Badge>
          )}
          {ecoStats.teamAForceWins > 0 && (
            <Badge variant="outline" className="gap-1 border-team-ct/30 text-team-ct">
              <TrendingUp className="h-3 w-3" />
              {teamAName}: {ecoStats.teamAForceWins} force buy win{ecoStats.teamAForceWins > 1 ? "s" : ""}
            </Badge>
          )}
          {ecoStats.teamBForceWins > 0 && (
            <Badge variant="outline" className="gap-1 border-team-t/30 text-team-t">
              <TrendingUp className="h-3 w-3" />
              {teamBName}: {ecoStats.teamBForceWins} force buy win{ecoStats.teamBForceWins > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      )}

      {/* chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Equipment Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                <defs>
                  <linearGradient id="ctGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CT_COLOR} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CT_COLOR} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="tGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={T_COLOR} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={T_COLOR} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 20% 18%)" />
                <XAxis
                  dataKey="round"
                  tick={{ fill: "hsl(215 15% 50%)", fontSize: 11 }}
                  label={{
                    value: "Round",
                    fill: "hsl(215 15% 50%)",
                    position: "insideBottom",
                    offset: -5,
                    fontSize: 11,
                  }}
                />
                <YAxis
                  tick={{ fill: "hsl(215 15% 50%)", fontSize: 11 }}
                  label={{
                    value: "Value ($)",
                    fill: "hsl(215 15% 50%)",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 11,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(215 25% 12%)",
                    border: "1px solid hsl(215 20% 22%)",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(215 15% 80%)" }}
                />
                <Legend
                  wrapperStyle={{ color: "hsl(215 15% 60%)", fontSize: 12 }}
                />
                <Bar
                  dataKey="teamASpend"
                  name={`${teamAName} Spend`}
                  fill={CT_COLOR}
                  opacity={0.25}
                  barSize={6}
                />
                <Bar
                  dataKey="teamBSpend"
                  name={`${teamBName} Spend`}
                  fill={T_COLOR}
                  opacity={0.25}
                  barSize={6}
                />
                <Area
                  type="monotone"
                  dataKey="teamAEquip"
                  name={`${teamAName} Equip`}
                  stroke={CT_COLOR}
                  strokeWidth={2}
                  fill="url(#ctGradient)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="teamBEquip"
                  name={`${teamBName} Equip`}
                  stroke={T_COLOR}
                  strokeWidth={2}
                  fill="url(#tGradient)"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* buy type table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Buy Types</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 bg-card pl-4">Team</TableHead>
                {rounds.map((r) => (
                  <TableHead
                    key={r.roundNumber}
                    className="text-center text-xs"
                  >
                    R{r.roundNumber}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="sticky left-0 bg-card pl-4 text-team-ct">
                  {teamAName}
                </TableCell>
                {rounds.map((r) => {
                  const winner = roundWinners[r.roundNumber - 1];
                  const aWon = winner ? teamAWonRound(r.roundNumber, winner, teamAStartedAs) : null;
                  const outcome = aWon !== null ? buyOutcomeBadge(r.teamABuyType, aWon) : null;
                  return (
                    <TableCell key={r.roundNumber} className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge
                          variant="outline"
                          className={`px-1.5 py-0 text-[10px] ${buyTypeBadgeClass(r.teamABuyType)}`}
                        >
                          {buyTypeLabel(r.teamABuyType)}
                        </Badge>
                        {outcome && (
                          <span className={`text-[9px] font-medium ${outcome.cls.split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>
                            {outcome.label}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
              <TableRow>
                <TableCell className="sticky left-0 bg-card pl-4 text-team-t">
                  {teamBName}
                </TableCell>
                {rounds.map((r) => {
                  const winner = roundWinners[r.roundNumber - 1];
                  const bWon = winner ? !teamAWonRound(r.roundNumber, winner, teamAStartedAs) : null;
                  const outcome = bWon !== null ? buyOutcomeBadge(r.teamBBuyType, bWon) : null;
                  return (
                    <TableCell key={r.roundNumber} className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge
                          variant="outline"
                          className={`px-1.5 py-0 text-[10px] ${buyTypeBadgeClass(r.teamBBuyType)}`}
                        >
                          {buyTypeLabel(r.teamBBuyType)}
                        </Badge>
                        {outcome && (
                          <span className={`text-[9px] font-medium ${outcome.cls.split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>
                            {outcome.label}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
