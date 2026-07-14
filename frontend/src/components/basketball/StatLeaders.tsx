"use client";
import { BBLeader } from "@/lib/api/basketball";

export default function StatLeaders({ leaders, leagueLabel = "NBA" }: { leaders: BBLeader[]; leagueLabel?: string }) {
  // PLEASE review — missing empty state: returning null makes the whole leaders panel disappear with no explanation. EXAMPLE: if (leaders.length === 0) return <p style={{ fontSize: 13 }}>Leaders unavailable.</p>;
  if (leaders.length === 0) return null;
  const catName = leaders[0]?.category ?? "Scoring Leaders";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)", margin: 0, letterSpacing: "-0.3px" }}>{catName}</h2>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{leagueLabel}</span>
      </div>
      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {/* PLEASE review — index key and fixed border count: re-ranked leaders remount the wrong player row, and i < 9 draws a border after the last row when fewer than 10 leaders exist. EXAMPLE: {leaders.slice(0, 10).map((l, i, arr) => <div key={`${l.player}:${l.team}`} style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>...</div>)}. */}
        {leaders.slice(0, 10).map((l, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < 9 ? "1px solid var(--border)" : "none", transition: "background 100ms" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", width: 18, textAlign: "center", flexShrink: 0 }}>{l.rank}</span>

            {l.headshot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.headshot} alt={l.player} width={32} height={32}
                style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", background: "var(--cloud)", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#FEF3C7", color: "#B45309", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                {l.player.split(" ").pop()?.slice(0, 3)}
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.player}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.team}</div>
            </div>

            <span className="score-num" style={{ fontSize: 18, color: "#EA580C", flexShrink: 0 }}>{l.displayValue}</span>
          </div>
        ))}
      </div>
    </div>
  );
}