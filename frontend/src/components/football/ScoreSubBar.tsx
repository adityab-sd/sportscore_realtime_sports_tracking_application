"use client";
import type { Match } from "@/types/football";
import BallIcon from "./BallIcon";

/**
 * ScoreSubBar — compact goalscorer + red-card strip under the header.
 * Home scorers on the left, away on the right. Hidden entirely if no goals
 * and no red cards. Like OneFootball's under-score summary.
 */
export default function ScoreSubBar({ match }: { match: Match }) {
  const events = match.events ?? [];
  const homeId = match.homeTeam.id;

  const relevant = events.filter((e) => {
    const t = `${e.type} ${e.detail ?? ""}`.toLowerCase();
    return t.includes("goal") || t.includes("red");
  });

  if (relevant.length === 0) return null;

  const home = relevant.filter((e) => e.teamId === homeId);
  const away = relevant.filter((e) => e.teamId !== homeId);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        gap: 12,
        alignItems: "start",
        padding: "12px 18px",
        borderTop: "1px solid var(--border)",
      }}
    >
      {/* Home scorers (right-aligned toward center) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", textAlign: "right" }}>
        {home.map((e, i) => (
          <ScorerLine key={`h-${i}`} event={e} align="right" />
        ))}
      </div>

      {/* Center ball icon divider */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 1 }}>
        <BallIcon size={16} color="var(--text-muted)" />
      </div>

      {/* Away scorers (left-aligned from center) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", textAlign: "left" }}>
        {away.map((e, i) => (
          <ScorerLine key={`a-${i}`} event={e} align="left" />
        ))}
      </div>
    </div>
  );
}

function ScorerLine({ event, align }: { event: Match["events"][number]; align: "left" | "right" }) {
  const t = `${event.type} ${event.detail ?? ""}`.toLowerCase();
  const isRed = t.includes("red");
  const minute = (event as any).displayMinute ?? String(event.minute);
  const name = event.player ?? event.detail ?? "";

  const marker = isRed ? (
    <span style={{ width: 9, height: 12, borderRadius: 1.5, background: "#dc2626", flexShrink: 0 }} />
  ) : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, flexDirection: align === "right" ? "row-reverse" : "row" }}>
      {marker}
      <span style={{ color: "var(--text-secondary)" }}>
        {name} <span style={{ color: "var(--text-muted)" }}>{minute}&apos;</span>
      </span>
    </div>
  );
}