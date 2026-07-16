"use client";
import Link from "next/link";
import TeamLogo from "@/components/football/TeamLogo";
import { BBStandingRow } from "@/lib/api/basketball";

interface Props {
  rows: BBStandingRow[];
  league: string;
  limit?: number;
}

export default function StandingsTable({ rows, league, limit }: Props) {
  const shown = limit ? rows.slice(0, limit) : rows;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", overflowX: "auto" }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 44px 44px 56px 52px 60px", padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", gap: 4, minWidth: 480 }}>
        <span>#</span><span>Team</span>
        <span style={{ textAlign: "center" }}>W</span>
        <span style={{ textAlign: "center" }}>L</span>
        <span style={{ textAlign: "center" }}>PCT</span>
        <span style={{ textAlign: "center" }}>GB</span>
        <span style={{ textAlign: "center" }}>STRK</span>
      </div>

      {shown.map((r, i) => {
        const playoff = i < 8; // top 8 typically make playoffs
        return (
          <div
            key={r.teamId || i}
            style={{ display: "grid", gridTemplateColumns: "36px 1fr 44px 44px 56px 52px 60px", padding: "11px 16px", borderBottom: i < shown.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center", gap: 4, minWidth: 480, transition: "background 100ms", cursor: "default" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud)")}
            onMouseLeave={e => (e.currentTarget.style.background = playoff ? "rgba(234,88,12,0.03)" : "transparent")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {playoff && <div style={{ width: 3, height: 20, borderRadius: 2, background: "#EA580C", flexShrink: 0 }} />}
              <span style={{ fontSize: 12, fontWeight: 700, color: playoff ? "#B45309" : "var(--text-muted)" }}>{r.rank}</span>
            </div>

            <Link href={`/basketball/team/${r.teamId}?league=${league}`} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", minWidth: 0 }}>
              <TeamLogo logo={r.logo} shortName={r.shortName} size={24} highlight={playoff} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.team}</span>
            </Link>

            <span className="stat-num" style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>{r.wins}</span>
            <span className="stat-num" style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>{r.losses}</span>
            <span className="stat-num" style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>
              {r.winPct != null ? r.winPct.toFixed(3).replace(/^0/, "") : "–"}
            </span>
            <span className="stat-num" style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>
              {r.gamesBehind === 0 ? "–" : r.gamesBehind.toFixed(1)}
            </span>
            <span className="stat-num" style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: r.streak?.startsWith("W") ? "var(--success)" : r.streak?.startsWith("L") ? "#dc2626" : "var(--text-secondary)" }}>
              {r.streak ?? "–"}
            </span>
          </div>
        );
      })}
    </div>
  );
}