"use client";
import { useMemo, useState } from "react";
import type { Match } from "@/types/football";
import type { PlayPoint } from "@/types/plays";
import BallIcon from "./BallIcon";
import SubIcon from "./SubIcon";

/**
 * MatchTimeline — ESPN-style horizontal event timeline.
 *
 * Goals, cards and subs on a KO→HT→FT bar (home above / away below). Overlapping
 * events are nudged apart. Hovering a marker shows a tooltip with the minute,
 * team and player. No emojis — clean SVG/shape icons only.
 */

interface TimelineItem {
  minute: number;
  effectiveMinute: number;  // includes stoppage: "90+4" -> 94, for positioning
  displayMinute: string;
  kind: "goal" | "yellow" | "red" | "sub";
  side: "home" | "away";
  teamShort: string;
  label?: string;   // e.g. "M. Aguiar replaces J. Miritello" or player name
}

/** Parse a display minute like "90+4" into an effective number (94) for layout. */
function effMin(display: string, fallback: number): number {
  if (!display) return fallback;
  const m = display.replace("'", "").match(/(\d+)(?:\+(\d+))?/);
  if (!m) return fallback;
  const base = parseInt(m[1], 10);
  const added = m[2] ? parseInt(m[2], 10) : 0;
  return base + added;
}

export default function MatchTimeline({
  match,
  plays,
}: {
  match: Match;
  plays?: PlayPoint[];
}) {
  const items = useMemo(() => buildItems(match, plays), [match, plays]);
  const [hover, setHover] = useState<{ item: Positioned; side: "home" | "away" } | null>(null);

  if (items.length === 0) return null;

  const maxMin = Math.max(90, ...items.map((i) => i.effectiveMinute));
  const homeItems = layout(items.filter((i) => i.side === "home"), maxMin);
  const awayItems = layout(items.filter((i) => i.side === "away"), maxMin);

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: "clamp(16px,3vw,24px)" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--obsidian)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 20 }}>
        Match Timeline
      </div>

      <TeamLabel logo={match.homeTeam.logo} short={match.homeTeam.shortName} />

      <div style={{ position: "relative", height: 116, margin: "12px 0" }}>
        {/* Tooltip */}
        {hover && (
          <div
            style={{
              position: "absolute",
              left: `${hover.item.pct}%`,
              [hover.side === "home" ? "bottom" : "top"]: 92,
              transform: "translateX(-50%)",
              background: "#1e3a8a",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
              zIndex: 10,
              pointerEvents: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              maxWidth: 320,
            }}
          >
            <span style={{ fontWeight: 800 }}>{hover.item.displayMinute}&apos;</span>{" "}
            <span style={{ opacity: 0.85 }}>{hover.item.teamShort}:</span>{" "}
            {hover.item.label ?? kindLabel(hover.item.kind)}
          </div>
        )}

        {homeItems.map((it, i) => (
          <Marker key={`h-${i}`} item={it} side="home" index={i} onHover={setHover} />
        ))}

        <div style={{ position: "absolute", left: 0, right: 0, top: 54, height: 8, background: "linear-gradient(90deg,#16a34a,#22c55e)", borderRadius: 4 }} />
        <div style={{ position: "absolute", left: "50%", top: 8, bottom: 8, width: 0, borderLeft: "1px dotted var(--border)", transform: "translateX(-50%)" }} />

        {awayItems.map((it, i) => (
          <Marker key={`a-${i}`} item={it} side="away" index={i} onHover={setHover} />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12 }}>
        <span>KO</span><span>HT</span><span>FT</span>
      </div>

      <TeamLabel logo={match.awayTeam.logo} short={match.awayTeam.shortName} />

      <style>{`
        @keyframes tl-pop {
          0%   { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.6); }
          60%  { opacity: 1; transform: translateX(-50%) translateY(-2px) scale(1.12); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ── layout ────────────────────────────────────────────────────────────────*/
interface Positioned extends TimelineItem { pct: number; }

function layout(items: TimelineItem[], maxMin: number): Positioned[] {
  const sorted = [...items].sort((a, b) => a.effectiveMinute - b.effectiveMinute);
  const MIN_GAP = 4.5;
  let lastPct = -Infinity;
  return sorted.map((it) => {
    let pct = (it.effectiveMinute / maxMin) * 100;
    if (pct - lastPct < MIN_GAP) pct = lastPct + MIN_GAP;
    pct = Math.min(pct, 100);
    lastPct = pct;
    return { ...it, pct };
  });
}

/* ── marker ────────────────────────────────────────────────────────────────*/
function Marker({
  item, side, index, onHover,
}: {
  item: Positioned; side: "home" | "away"; index: number;
  onHover: (h: { item: Positioned; side: "home" | "away" } | null) => void;
}) {
  const above = side === "home";
  return (
    <div
      style={{
        position: "absolute",
        left: `${item.pct}%`,
        [above ? "bottom" : "top"]: 60,
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: above ? "column" : "column-reverse",
        alignItems: "center",
        gap: 3,
        animation: `tl-pop 0.4s ease ${index * 0.05}s both`,
        cursor: "pointer",
        transition: "transform 0.15s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateX(-50%) translateY(-3px)"; onHover({ item, side }); }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateX(-50%)"; onHover(null); }}
    >
      <Icon kind={item.kind} />
      <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>{item.displayMinute}&apos;</span>
    </div>
  );
}

function Icon({ kind }: { kind: TimelineItem["kind"] }) {
  if (kind === "goal") {
    return (
      <span style={{ width: 20, height: 20, display: "inline-flex", color: "#111", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }}>
        <BallIcon size={20} color="#111" />
      </span>
    );
  }
  if (kind === "sub") {
    return (
      <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.25)", border: "1px solid var(--border)" }}>
        <SubIcon size={15} />
      </span>
    );
  }
  const isRed = kind === "red";
  return <span style={{ width: 14, height: 18, borderRadius: 2, background: isRed ? "#dc2626" : "#facc15", display: "inline-block", boxShadow: "0 1px 2px rgba(0,0,0,0.25)" }} />;
}

function kindLabel(kind: TimelineItem["kind"]): string {
  return kind === "goal" ? "Goal" : kind === "red" ? "Red Card" : kind === "yellow" ? "Yellow Card" : "Substitution";
}

function TeamLabel({ logo, short }: { logo: string | null; short: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
      )}
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)" }}>{short}</span>
    </div>
  );
}

/* ── build items ───────────────────────────────────────────────────────────*/
function buildItems(match: Match, plays?: PlayPoint[]): TimelineItem[] {
  const homeId = match.homeTeam.id;
  const homeShort = match.homeTeam.shortName;
  const awayShort = match.awayTeam.shortName;
  const out: TimelineItem[] = [];

  for (const e of match.events ?? []) {
    const t = `${e.type} ${e.detail ?? ""}`.toLowerCase();
    const side: "home" | "away" = e.teamId === homeId ? "home" : "away";
    const teamShort = side === "home" ? homeShort : awayShort;
    if (t.includes("goal")) out.push({ minute: e.minute, effectiveMinute: effMin(e.displayMinute ?? String(e.minute), e.minute), displayMinute: e.displayMinute ?? String(e.minute), kind: "goal", side, teamShort, label: e.player ?? undefined });
    else if (t.includes("red")) out.push({ minute: e.minute, effectiveMinute: effMin(e.displayMinute ?? String(e.minute), e.minute), displayMinute: e.displayMinute ?? String(e.minute), kind: "red", side, teamShort, label: e.player ?? undefined });
    else if (t.includes("card") || t.includes("yellow")) out.push({ minute: e.minute, effectiveMinute: effMin(e.displayMinute ?? String(e.minute), e.minute), displayMinute: e.displayMinute ?? String(e.minute), kind: "yellow", side, teamShort, label: e.player ?? undefined });
  }

  for (const p of plays ?? []) {
    const isSub = p.substitution || /substitution/i.test(p.type) || /\breplaces\b/i.test(p.text);
    if (!isSub) continue;
    const min = parseInt(p.minute, 10);
    if (Number.isNaN(min)) continue;
    const side: "home" | "away" = p.team === "home" ? "home" : "away";
    const teamShort = side === "home" ? homeShort : awayShort;
    // Prefer the "X replaces Y" phrase from the text for the tooltip.
    const m = p.text.match(/([A-ZÀ-ÿ][^.,]*replaces[^.,]*)/i);
    out.push({ minute: min, effectiveMinute: effMin(p.minute || String(min), min), displayMinute: (p.minute || String(min)).replace("\u0027", ""), kind: "sub", side, teamShort, label: m ? m[1].trim() : (p.player ?? undefined) });
  }

  return out;
}