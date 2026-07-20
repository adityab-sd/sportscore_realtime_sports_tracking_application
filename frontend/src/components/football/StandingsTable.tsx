"use client";
import Link from "next/link";
import TeamLogo from "./TeamLogo";
import { ESPNStandingRow } from "@/lib/api/espn";

const noteColors: Record<string, string> = {
  "Champions League": "#003f88",
  "Europa League":    "#f97316",
  "Conference":       "#8b5cf6",
  "Relegation":       "#dc2626",
};

interface Props {
  rows: ESPNStandingRow[];
  league: string;
  limit?: number;
  highlightTeamIds?: string[];
}

export default function StandingsTable({ rows, league, limit, highlightTeamIds = [] }: Props) {
  const shown = limit ? rows.slice(0, limit) : rows;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", overflowX: "auto" }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 40px 40px 40px 40px 48px 48px", padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", gap: 4, minWidth: 480 }}>
        <span>#</span><span>Club</span>
        <span style={{ textAlign: "center" }}>P</span>
        <span style={{ textAlign: "center" }}>W</span>
        <span style={{ textAlign: "center" }}>D</span>
        <span style={{ textAlign: "center" }}>L</span>
        <span style={{ textAlign: "center" }}>GD</span>
        <span style={{ textAlign: "center" }}>Pts</span>
      </div>

      {/* PLEASE review — competition qualification assumptions: cl = i < 4 marks the top four as Champions League for every table, including leagues with different qualification/relegation rules. EXAMPLE: const cl = r.note?.includes("Champions League") === true; */}
      {shown.map((r, i) => {
        const cl = i < 4;
        const noteColor = r.note
          ? (Object.entries(noteColors).find(([k]) => r.note?.includes(k))?.[1] ?? null)
          : null;
        const highlighted = highlightTeamIds.includes(r.teamId);

        // PLEASE review — stable standing key: falling back to the row index can remount rows when live standings reorder. EXAMPLE: key={`${league}-${r.rank}-${r.team}`}.
        return (
          <div
            key={r.teamId || i}
            style={{ display: "grid", gridTemplateColumns: "36px 1fr 40px 40px 40px 40px 48px 48px", padding: "11px 16px", borderBottom: i < shown.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center", gap: 4, minWidth: 480, transition: "background 100ms", cursor: "default", background: highlighted ? "rgba(59,130,246,0.08)" : "transparent" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud)")}
            onMouseLeave={e => (e.currentTarget.style.background = highlighted ? "rgba(59,130,246,0.08)" : cl ? "rgba(0,63,136,0.025)" : "transparent")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {noteColor && <div style={{ width: 3, height: 20, borderRadius: 2, background: noteColor, flexShrink: 0 }} />}
              <span style={{ fontSize: 12, fontWeight: 700, color: cl ? "var(--navy)" : "var(--text-muted)" }}>{r.rank}</span>
            </div>

            <Link href={`/football/team/${r.teamId}?league=${league}`} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", minWidth: 0 }}>
              <TeamLogo logo={r.logo} shortName={r.shortName} size={24} highlight={cl} />
              <span style={{ fontSize: 13, fontWeight: highlighted ? 800 : 600, color: highlighted ? "var(--navy)" : "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.team}</span>
            </Link>

            {[r.played, r.won, r.drawn, r.lost].map((v, vi) => (
              <span key={vi} className="stat-num" style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>{v}</span>
            ))}

            <span className="stat-num" style={{ textAlign: "center", fontSize: 13, fontWeight: r.goalDiff !== 0 ? 600 : 400, color: r.goalDiff > 0 ? "var(--success)" : r.goalDiff < 0 ? "#dc2626" : "var(--text-secondary)" }}>
              {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
            </span>

            <span className="stat-num" style={{ textAlign: "center", fontSize: 14, fontWeight: 800, color: cl ? "var(--navy)" : "var(--obsidian)" }}>{r.points}</span>
          </div>
        );
      })}
    </div>
  );
}