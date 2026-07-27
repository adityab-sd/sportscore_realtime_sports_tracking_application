"use client";
import Link from "next/link";
import TeamLogo from "./TeamLogo";
import { BBStandingRow } from "@/lib/api/baseball";

interface Props {
  rows: BBStandingRow[];
  league: string;
  limit?: number;
  highlightTeamIds?: string[];
}

const COLS = "36px 1fr 40px 40px 56px 48px 56px";

function pct(v: number): string {
  // Baseball win pct is conventionally shown as .XXX (no leading zero).
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(3).replace(/^0/, "");
}

export default function StandingsTable({ rows, league, limit, highlightTeamIds = [] }: Props) {
  const shown = limit ? rows.slice(0, limit) : rows;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", overflowX: "auto" }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", gap: 4, minWidth: 460 }}>
        <span>#</span><span>Team</span>
        <span style={{ textAlign: "center" }}>W</span>
        <span style={{ textAlign: "center" }}>L</span>
        <span style={{ textAlign: "center" }}>PCT</span>
        <span style={{ textAlign: "center" }}>GB</span>
        <span style={{ textAlign: "center" }}>STRK</span>
      </div>

      {shown.map((r, i) => {
        const highlighted = highlightTeamIds.includes(r.teamId);
        const top = i < 3;

        return (
          <div
            key={r.teamId || i}
            style={{ display: "grid", gridTemplateColumns: COLS, padding: "11px 16px", borderBottom: i < shown.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center", gap: 4, minWidth: 460, transition: "background 100ms", cursor: "default", background: highlighted ? "rgba(59,130,246,0.08)" : "transparent" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud)")}
            onMouseLeave={e => (e.currentTarget.style.background = highlighted ? "rgba(59,130,246,0.08)" : top ? "rgba(0,63,136,0.025)" : "transparent")}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: top ? "var(--navy)" : "var(--text-muted)" }}>{r.rank}</span>

            <Link href={`/baseball/team/${r.teamId}?league=${league}`} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", minWidth: 0 }}>
              <TeamLogo logo={r.logo} shortName={r.shortName} size={24} highlight={top} />
              <span style={{ fontSize: 13, fontWeight: highlighted ? 800 : 600, color: highlighted ? "var(--navy)" : "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.team}</span>
            </Link>

            <span className="stat-num" style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--obsidian)" }}>{r.wins}</span>
            <span className="stat-num" style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>{r.losses}</span>
            <span className="stat-num" style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>{pct(r.winPct)}</span>
            <span className="stat-num" style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>{r.gamesBehind === 0 ? "—" : r.gamesBehind}</span>
            <span className="stat-num" style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: r.streak?.startsWith("W") ? "var(--success)" : r.streak?.startsWith("L") ? "#dc2626" : "var(--text-secondary)" }}>{r.streak ?? "—"}</span>
          </div>
        );
      })}
    </div>
  );
}
