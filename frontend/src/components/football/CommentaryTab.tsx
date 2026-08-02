"use client";
import { useMemo, useState } from "react";
import { isShot, type PlayPoint } from "@/types/plays";

/**
 * CommentaryTab — ESPN "Play by Play" layout.
 *
 * Each entry: event-type heading (from play.type) + team crest, minute below,
 * commentary text, and an indented player card (shirt/number/name/position)
 * when the play has a named player. A dotted vertical rail threads the entries.
 * All Plays / Key Events toggle at the top.
 */
export default function CommentaryTab({
  plays,
  homeShort = "HOME",
  awayShort = "AWAY",
  homeColor = "#003f88",
  awayColor = "#dc2626",
  homeLogo,
  awayLogo,
}: {
  plays: PlayPoint[];
  homeShort?: string;
  awayShort?: string;
  homeColor?: string;
  awayColor?: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
}) {
  const [mode, setMode] = useState<"all" | "key">("all");

  const isKey = (p: PlayPoint) =>
    p.scoring || p.yellowCard || p.redCard || p.substitution || isShot(p);

  const feed = useMemo(() => {
    const base = [...plays]
      .filter((p) => p.text.trim().length > 0)
      .sort((a, b) => b.clockSeconds - a.clockSeconds);
    return mode === "key" ? base.filter(isKey) : base;
  }, [plays, mode]);

  // Title-case the event type: "shot-blocked" → "Shot Blocked".
  const titleFor = (p: PlayPoint) => {
    const t = (p.type || "Play").replace(/-/g, " ").trim();
    return t.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const teamColor = (t: PlayPoint["team"]) => (t === "home" ? homeColor : t === "away" ? awayColor : "#64748b");
  const teamLogo = (t: PlayPoint["team"]) => (t === "home" ? homeLogo : t === "away" ? awayLogo : null);
  const teamShort = (t: PlayPoint["team"]) => (t === "home" ? homeShort : t === "away" ? awayShort : "");

  const toggle = (m: "all" | "key", label: string) => {
    const on = mode === m;
    return (
      <button
        onClick={() => setMode(m)}
        style={{
          flex: 1, padding: "12px 16px", border: "none", cursor: "pointer",
          fontSize: 14, fontWeight: 700, borderRadius: 24,
          background: on ? "#e2e8f0" : "transparent",
          color: on ? "var(--obsidian)" : "var(--text-muted)",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "clamp(16px,3vw,28px)" }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 18 }}>
        Play by Play
      </div>

      {/* Toggle */}
      <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 26, padding: 4, marginBottom: 8 }}>
        {toggle("all", "All Plays")}
        {toggle("key", "Key Events")}
      </div>

      {feed.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "40px 0" }}>
          {mode === "key" ? "No key events yet." : "No commentary yet — check back once play is under way."}
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Dotted vertical rail */}
          <div style={{ position: "absolute", left: 15, top: 8, bottom: 8, width: 0, borderLeft: "2px dotted var(--border)" }} />

          {feed.map((p) => {
            const highlight = p.scoring;
            const logo = teamLogo(p.team);
            const hasPlayer = !!p.player;
            return (
              <div
                key={p.id}
                style={{
                  position: "relative",
                  padding: "18px 4px 18px 46px",
                  borderTop: "1px solid var(--border)",
                  background: highlight ? "rgba(34,197,94,0.06)" : "transparent",
                }}
              >
                {/* Crest / marker on the rail */}
                <div style={{ position: "absolute", left: 4, top: 18, width: 24, height: 24, borderRadius: "50%", background: "var(--white)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="" style={{ width: 18, height: 18, objectFit: "contain" }} />
                  ) : (
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: teamColor(p.team) }} />
                  )}
                </div>

                {/* Heading + minute */}
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)" }}>{titleFor(p)}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 8px" }}>{p.minute || "—"}</div>

                {/* Commentary text */}
                <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-secondary)" }}>{p.text}</div>

                {/* Player card (when we have a named player) */}
                {hasPlayer && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                    <svg width="40" height="40" viewBox="0 0 46 46" style={{ flexShrink: 0 }}>
                      <path d="M14 9 L18 6 L28 6 L32 9 L40 14 L36 20 L33 18 L33 40 L13 40 L13 18 L10 20 L6 14 Z" fill={teamColor(p.team)} stroke="#00000022" strokeWidth="1" />
                      {p.jersey && (
                        <text x="23" y="27" textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="800" fill="#fff">{p.jersey}</text>
                      )}
                    </svg>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)" }}>{p.player}</div>
                      {p.position && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.position}</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}