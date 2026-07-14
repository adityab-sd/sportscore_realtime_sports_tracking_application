"use client";
import { useSignalR } from "@/hooks/useSignalR";
import { classifyStatus } from "@/types/football";

export default function LiveTicker() {
  const { matches } = useSignalR();
  const live = matches.filter(m => classifyStatus(m.status) === "live");
  if (live.length === 0) return null;
  const items = [...live, ...live];

  return (
    <div style={{ background: "var(--navy-dark)", height: 34, display: "flex", alignItems: "center", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 14px", borderRight: "1px solid rgba(255,255,255,0.1)", flexShrink: 0, height: "100%" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff6b6b", flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "#ff9b9b", letterSpacing: "1px" }}>LIVE</span>
      </div>
      <div style={{ overflow: "hidden", flex: 1 }}>
        <div style={{ display: "flex", animation: `tickerScroll ${Math.max(live.length * 7, 14)}s linear infinite`, willChange: "transform" }}>
          {/* PLEASE review — stable ticker keys: index keys remount rows whenever live matches reorder. EXAMPLE: <div key={`${m.id}-${i >= live.length ? "clone" : "original"}`} ...>. */}
          {items.map((m, i) => (
            <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0 20px", borderRight: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap", flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{m.homeTeam.shortName || m.homeTeam.name}</span>
              <span className="score-num" style={{ fontSize: 13, color: "#fff" }}>{m.homeScore ?? "–"} – {m.awayScore ?? "–"}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{m.awayTeam.shortName || m.awayTeam.name}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#ff9b9b", background: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: 3 }}>{m.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
