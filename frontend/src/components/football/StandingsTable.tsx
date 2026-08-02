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

// ── Column header row (reused per group) ──────────────────────────────────────
function ColumnHeader() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 40px 40px 40px 40px 48px 48px", padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", gap: 4, minWidth: 480 }}>
      <span>#</span><span>Club</span>
      <span style={{ textAlign: "center" }}>P</span>
      <span style={{ textAlign: "center" }}>W</span>
      <span style={{ textAlign: "center" }}>D</span>
      <span style={{ textAlign: "center" }}>L</span>
      <span style={{ textAlign: "center" }}>GD</span>
      <span style={{ textAlign: "center" }}>Pts</span>
    </div>
  );
}

// ── Single team row ───────────────────────────────────────────────────────────
function TeamRow({ r, i, total, league, highlightTeamIds }: {
  r: ESPNStandingRow; i: number; total: number; league: string; highlightTeamIds: string[];
}) {
  const cl = i < 4;
  const noteColor = r.note
    ? (Object.entries(noteColors).find(([k]) => r.note?.includes(k))?.[1] ?? null)
    : null;
  const highlighted = highlightTeamIds.includes(r.teamId);

  return (
    <div
      key={r.teamId || i}
      style={{ display: "grid", gridTemplateColumns: "36px 1fr 40px 40px 40px 40px 48px 48px", padding: "11px 16px", borderBottom: i < total - 1 ? "1px solid var(--border)" : "none", alignItems: "center", gap: 4, minWidth: 480, transition: "background 100ms", cursor: "default", background: highlighted ? "rgba(59,130,246,0.08)" : "transparent" }}
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
}

export default function StandingsTable({ rows, league, limit, highlightTeamIds = [] }: Props) {
  // Sort all rows by rank
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);

  // When limit is set (e.g. mini-standings on match page), just show top N flat
  if (limit) {
    const shown = sorted.slice(0, limit);
    return (
      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", overflowX: "auto" }}>
        <ColumnHeader />
        {shown.map((r, i) => (
          <TeamRow key={r.teamId || i} r={r} i={i} total={shown.length} league={league} highlightTeamIds={highlightTeamIds} />
        ))}
      </div>
    );
  }

  // Group rows by the `group` field (e.g. "Group A" / "Group B" for arg.1).
  // Leagues without groups (eng.1, bra.1, etc.) have group=null → one flat table.
  const groups = new Map<string, ESPNStandingRow[]>();
  for (const r of sorted) {
    const key = r.group ?? "__all__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const hasGroups = groups.size > 1 || (groups.size === 1 && !groups.has("__all__"));

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", overflowX: "auto" }}>
      {hasGroups ? (
        // Grouped layout (arg.1, MLS, etc.)
        [...groups.entries()].map(([groupName, groupRows]) => (
          <div key={groupName}>
            {groupName !== "__all__" && (
              <div style={{
                padding: "10px 16px", background: "var(--cloud)",
                borderBottom: "1px solid var(--border)",
                fontSize: 12, fontWeight: 800, color: "var(--navy)",
                textTransform: "uppercase", letterSpacing: "0.6px",
              }}>
                {groupName}
              </div>
            )}
            <ColumnHeader />
            {groupRows.map((r, i) => (
              <TeamRow key={r.teamId || i} r={r} i={i} total={groupRows.length} league={league} highlightTeamIds={highlightTeamIds} />
            ))}
          </div>
        ))
      ) : (
        // Flat layout (Premier League, Brasileirão, etc.)
        <>
          <ColumnHeader />
          {sorted.map((r, i) => (
            <TeamRow key={r.teamId || i} r={r} i={i} total={sorted.length} league={league} highlightTeamIds={highlightTeamIds} />
          ))}
        </>
      )}
    </div>
  );
}