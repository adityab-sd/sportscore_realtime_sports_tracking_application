"use client";
import { ESPNLeader } from "@/lib/api/espn";

export default function TopScorers({ leaders, leagueLabel }: { leaders: ESPNLeader[]; leagueLabel?: string }) {
  if (leaders.length === 0) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)", margin: 0, letterSpacing: "-0.3px" }}>Top Scorers</h2>
        {leagueLabel && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{leagueLabel}</span>}
      </div>
      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {/* ADDRESSED: leaderboard row identity — replaced index key with player-team composite key. */}
        {/* ADDRESSED: sliced list border math — fixed border condition to use actual array length. */}
        {leaders.slice(0, 10).map((l, i) => (
          <div
            key={`${l.player}-${l.team}`}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < Math.min(leaders.length, 10) - 1 ? "1px solid var(--border)" : "none", transition: "background 100ms" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", width: 18, textAlign: "center", flexShrink: 0 }}>{l.rank}</span>

            {l.headshot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.headshot} alt={l.player} width={32} height={32}
                style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", background: "var(--cloud)", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--navy-light)", color: "var(--navy)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                {l.player.split(" ").pop()?.slice(0, 3)}
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.player}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.team}</div>
            </div>

            <span className="score-num" style={{ fontSize: 18, color: "var(--navy)", flexShrink: 0 }}>{l.displayValue}</span>
          </div>
        ))}
      </div>
    </div>
  );
}