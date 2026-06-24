"use client";
import { Match, MatchEvent } from "@/types/football";

function EventIcon({ type, detail }: { type: string; detail: string }) {
  const d = (detail || "").toLowerCase();
  const t = (type || "").toLowerCase();
  if (t === "goal" || d.includes("goal")) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--obsidian)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Goal">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7l2.9 2.1-1.1 3.4h-3.6l-1.1-3.4z" fill="var(--obsidian)" stroke="none" />
      <path d="M12 2v3M3.5 9l2.8 1M20.5 9l-2.8 1M6 19l2-2.6M18 19l-2-2.6" />
    </svg>
  );
  if (d.includes("yellow")) return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-label="Yellow card"><rect x="6" y="3" width="11" height="18" rx="2" transform="rotate(8 12 12)" fill="#F5B500" /></svg>
  );
  if (d.includes("red")) return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-label="Red card"><rect x="6" y="3" width="11" height="18" rx="2" transform="rotate(8 12 12)" fill="#DC2626" /></svg>
  );
  if (t === "subst" || d.includes("sub")) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-label="Substitution">
      <path d="M16 3l4 4-4 4" /><path d="M20 7H9a4 4 0 0 0-4 4" /><path d="M8 21l-4-4 4-4" /><path d="M4 17h11a4 4 0 0 0 4-4" />
    </svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-label="Event">
      <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

export default function EventFeed({ match }: { match: Match }) {
  if (!match.events || match.events.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "24px 0", margin: 0 }}>No events recorded for this match.</p>;
  }
  const sorted = [...match.events].sort((a, b) => b.minute - a.minute);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {sorted.map((e: MatchEvent, i: number) => {
        const isHome = e.teamId === match.homeTeam.id;
        const sn = isHome ? match.homeTeam.shortName : match.awayTeam.shortName;
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
            borderRadius: 8, flexDirection: isHome ? "row" : "row-reverse",
            transition: "background 100ms",
          }}
            onMouseEnter={ev => (ev.currentTarget.style.background = "var(--cloud)")}
            onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
          >
            <span className="stat-num" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", minWidth: 30, textAlign: "center" }}>{e.minute}&apos;</span>
            <EventIcon type={e.type} detail={e.detail} />
            <div style={{ flex: 1, textAlign: isHome ? "left" : "right", minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)" }}>{e.player ?? e.detail}</div>
              {e.assist && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>Assist: {e.assist}</div>}
              {!e.player && e.detail && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{e.detail}</div>}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", background: "var(--cloud)", padding: "2px 7px", borderRadius: 4, flexShrink: 0 }}>{sn}</div>
          </div>
        );
      })}
    </div>
  );
}
