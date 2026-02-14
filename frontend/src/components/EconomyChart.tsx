import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { EconomyRound } from "../api/types";
import { BuyType } from "../api/types";

interface EconomyChartProps {
  rounds: EconomyRound[];
  teamAName: string;
  teamBName: string;
}

function buyTypeLabel(bt: BuyType): string {
  switch (bt) {
    case BuyType.ECO:
      return "Eco";
    case BuyType.FORCE:
      return "Force";
    case BuyType.FULL:
      return "Full";
    case BuyType.PISTOL:
      return "Pistol";
    default:
      return "";
  }
}

function buyTypeBadgeColor(bt: BuyType): string {
  switch (bt) {
    case BuyType.ECO:
      return "bg-red-800 text-red-200";
    case BuyType.FORCE:
      return "bg-yellow-800 text-yellow-200";
    case BuyType.FULL:
      return "bg-green-800 text-green-200";
    case BuyType.PISTOL:
      return "bg-purple-800 text-purple-200";
    default:
      return "bg-slate-700 text-slate-300";
  }
}

const CT_COLOR = "#5B9BD5";
const T_COLOR = "#EAC843";

export function EconomyChart({
  rounds,
  teamAName,
  teamBName,
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

  return (
    <div>
      {/* chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="round"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              label={{ value: "Round", fill: "#94a3b8", position: "insideBottom", offset: -5 }}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              label={{
                value: "Equipment Value ($)",
                fill: "#94a3b8",
                angle: -90,
                position: "insideLeft",
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#e2e8f0" }}
            />
            <Legend wrapperStyle={{ color: "#94a3b8" }} />
            <Bar
              dataKey="teamASpend"
              name={`${teamAName} Spend`}
              fill={CT_COLOR}
              opacity={0.3}
              barSize={8}
            />
            <Bar
              dataKey="teamBSpend"
              name={`${teamBName} Spend`}
              fill={T_COLOR}
              opacity={0.3}
              barSize={8}
            />
            <Line
              type="monotone"
              dataKey="teamAEquip"
              name={`${teamAName} Equip`}
              stroke={CT_COLOR}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="teamBEquip"
              name={`${teamBName} Equip`}
              stroke={T_COLOR}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* buy type badges per round */}
      <div className="mt-6">
        <h4 className="mb-2 text-sm font-medium text-slate-400">
          Buy Types
        </h4>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-slate-500">Team</th>
                {rounds.map((r) => (
                  <th
                    key={r.roundNumber}
                    className="px-1 py-1 text-center text-slate-500"
                  >
                    R{r.roundNumber}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1 text-team-ct">{teamAName}</td>
                {rounds.map((r) => (
                  <td key={r.roundNumber} className="px-1 py-1 text-center">
                    <span
                      className={`inline-block rounded px-1 py-0.5 text-[10px] ${buyTypeBadgeColor(r.teamABuyType)}`}
                    >
                      {buyTypeLabel(r.teamABuyType)}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-2 py-1 text-team-t">{teamBName}</td>
                {rounds.map((r) => (
                  <td key={r.roundNumber} className="px-1 py-1 text-center">
                    <span
                      className={`inline-block rounded px-1 py-0.5 text-[10px] ${buyTypeBadgeColor(r.teamBBuyType)}`}
                    >
                      {buyTypeLabel(r.teamBBuyType)}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
