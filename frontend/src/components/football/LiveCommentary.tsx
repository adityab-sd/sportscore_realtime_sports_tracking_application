"use client";
import { useMemo } from "react";
import { isShot, type PlayPoint } from "@/types/plays";

/**
 * LiveCommentary — a scrolling card of KEY EVENTS only (goals, cards, subs,
 * shots), newest-first, read from the plays[] array that already drives the
 * shot map. Refreshes whenever plays[] updates (every 30s poll).
 *
 * This is separate from the "Match Events" panel (which is goals/cards only) —
 * it adds the shot commentary and gives a live feel during a 0-0 match.
 *
 * If this renders empty while the shot map has dots, the backend is forwarding
 * coordinates but not each play's `text` — but we've confirmed text IS
 * forwarded, so it should populate.
 */
export default function LiveCommentary({
  plays,
  homeShort = "HOME",
  awayShort = "AWAY",
  max = 40,
}: {
  plays: PlayPoint[];
  homeShort?: string;
  awayShort?: string;
  max?: number;
}) {
  // Key events only: goals, cards, subs, and shots — with commentary text,
  // newest first.
  const feed = useMemo(() => {
    const isKey = (p: PlayPoint) =>
      p.scoring || p.yellowCard || p.redCard || p.substitution || isShot(p);
    return [...plays]
      .filter((p) => isKey(p) && p.text.trim().length > 0)
      .sort((a, b) => b.clockSeconds - a.clockSeconds)
      .slice(0, max);
  }, [plays, max]);

  const teamLabel = (t: PlayPoint["team"]) =>
    t === "home" ? homeShort : t === "away" ? awayShort : null;
  const teamColor = (t: PlayPoint["team"]) =>
    t === "home" ? "var(--navy)" : t === "away" ? "#dc2626" : "var(--text-muted)";

  const iconFor = (p: PlayPoint) => {
    if (p.scoring) return "⚽";
    if (p.redCard) return <span style={{ width: 9, height: 13, background: "#ef4444", borderRadius: 2, display: "inline-block" }} />;
    if (p.yellowCard) return <span style={{ width: 9, height: 13, background: "#facc15", borderRadius: 2, display: "inline-block" }} />;
    if (p.substitution) return "🔁";
    if (isShot(p)) {
      // small target dot for a shot
      return <span style={{ width: 9, height: 9, borderRadius: "50%", border: "2px solid var(--text-muted)", display: "inline-block", boxSizing: "border-box" }} />;
    }
    return <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--border)", display: "inline-block" }} />;
  };

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          Live Commentary
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Key events</span>
      </div>

      {feed.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "24px 0" }}>
          No key events yet — check back once play is under way.
        </div>
      ) : (
        <div style={{ maxHeight: 420, overflowY: "auto", padding: "4px 14px 8px" }}>
          {feed.map((p, i) => {
            const label = teamLabel(p.team);
            const highlight = p.scoring;
            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 4px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  background: highlight ? "rgba(34,197,94,0.06)" : "transparent",
                }}
              >
                {/* Minute + team */}
                <div style={{ flexShrink: 0, width: 50, textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--obsidian)", fontVariantNumeric: "tabular-nums" }}>{p.minute || "—"}</div>
                  {label && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: teamColor(p.team), marginTop: 2 }}>{label}</div>
                  )}
                </div>

                {/* Icon */}
                <div style={{ flexShrink: 0, width: 18, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: 3 }}>
                  {iconFor(p)}
                </div>

                {/* Text */}
                <div style={{ fontSize: 13, lineHeight: 1.5, color: highlight ? "var(--obsidian)" : "var(--text-secondary)", fontWeight: highlight ? 600 : 400 }}>
                  {p.text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
