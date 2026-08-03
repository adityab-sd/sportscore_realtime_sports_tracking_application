"use client";
import type { Match, MatchEvent } from "@/types/football";
import BallIcon from "./BallIcon";

/**
 * MatchEventsTimeline — OneFootball-style two-sided event list.
 *
 * DESKTOP: a center vertical rail holds the minute markers; each event card
 * fans out to the left (home) or right (away).
 * MOBILE: cards stack vertically, home events left-aligned, away right-aligned,
 * minute on the outer edge.
 *
 * Responsive without JS: a CSS media query flips the grid. Icons for goals,
 * cards and subs. Replaces the old flat Match Events feed.
 */
export default function MatchEventsTimeline({ match }: { match: Match }) {
  const events = [...(match.events ?? [])].sort((a, b) => a.minute - b.minute);
  if (events.length === 0) return null;

  const homeId = match.homeTeam.id;

  return (
    <div className="met-wrap">
      <div className="met-title">Match Events</div>

      <div className="met-list">
        {/* center rail (desktop only) */}
        <div className="met-rail" aria-hidden />

        {events.map((e, i) => {
          const isHome = e.teamId === homeId;
          return (
            <div key={i} className={`met-row ${isHome ? "home" : "away"}`}>
              <div className="met-card">
                <EventCardContent event={e} isHome={isHome} />
              </div>
              <div className="met-minute">{(e as any).displayMinute ?? e.minute}&apos;</div>
            </div>
          );
        })}
      </div>

      <style>{`
        .met-wrap {
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: clamp(14px, 3vw, 22px);
        }
        .met-title {
          font-size: 12px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 18px;
        }
        .met-list { position: relative; }

        /* ── Mobile-first: stacked, home left / away right ───────────────── */
        .met-rail { display: none; }
        .met-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .met-row.home { flex-direction: row; }
        .met-row.away { flex-direction: row-reverse; }
        .met-card {
          flex: 1;
          min-width: 0;
          background: var(--cloud, #f8fafc);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 14px;
        }
        .met-row.away .met-card { text-align: right; }
        .met-minute {
          flex-shrink: 0;
          font-size: 13px; font-weight: 800; color: var(--text-muted);
          min-width: 40px; text-align: center;
        }

        /* ── Desktop: center rail, cards fan left/right ──────────────────── */
        @media (min-width: 640px) {
          .met-rail {
            display: block;
            position: absolute;
            left: 50%; top: 6px; bottom: 6px;
            width: 0;
            border-left: 2px dotted var(--border);
            transform: translateX(-50%);
          }
          .met-row {
            display: grid;
            grid-template-columns: 1fr 56px 1fr;
            align-items: center;
            gap: 0;
            margin-bottom: 14px;
          }
          .met-row .met-card { grid-column: 1; }
          .met-row .met-minute { grid-column: 2; }
          .met-row.away .met-card { grid-column: 3; text-align: left; }
          .met-row.away .met-minute { grid-column: 2; }
          /* home card sits left of rail, away card right of rail */
          .met-row.home .met-card { margin-right: 14px; text-align: right; }
          .met-row.away .met-card { margin-left: 14px; }
          /* keep the empty side clear */
          .met-row.home { grid-template-areas: "card min ."; }
          .met-row.away { grid-template-areas: ". min card"; }
          .met-row.home .met-card { grid-area: card; }
          .met-row.home .met-minute { grid-area: min; }
          .met-row.away .met-card { grid-area: card; }
          .met-row.away .met-minute { grid-area: min; }
        }
      `}</style>
    </div>
  );
}

function EventCardContent({ event, isHome }: { event: MatchEvent; isHome: boolean }) {
  const t = `${event.type} ${event.detail ?? ""}`.toLowerCase();
  const kind: "goal" | "yellow" | "red" | "sub" | "other" =
    t.includes("goal") ? "goal"
    : t.includes("red") ? "red"
    : t.includes("card") || t.includes("yellow") ? "yellow"
    : t.includes("sub") ? "sub"
    : "other";

  const primary = event.player ?? event.detail ?? "Event";
  const secondary =
    kind === "goal" && event.assist ? event.assist
    : kind === "sub" && event.assist ? event.assist
    : kind === "goal" ? (event.detail && event.detail.toLowerCase() !== "goal" ? event.detail : null)
    : null;

  const icon = <EventIcon kind={kind} />;

  // Icon sits toward the center rail: right side for home, left for away.
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: isHome ? "row-reverse" : "row" }}>
      {icon}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{primary}</div>
        {secondary && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{secondary}</div>
        )}
      </div>
    </div>
  );
}

function EventIcon({ kind }: { kind: "goal" | "yellow" | "red" | "sub" | "other" }) {
  if (kind === "goal") {
    return (
      <span style={{ flexShrink: 0, width: 22, height: 22, display: "inline-flex", color: "#111" }}>
        <BallIcon size={22} color="#111" />
      </span>
    );
  }
  if (kind === "sub") {
    return (
      <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "#0ea5e9", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="13" height="13" viewBox="0 0 14 14">
          <path d="M4 4.5 L4 10 M2.2 7 L4 10 L5.8 7" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 9.5 L10 4 M8.2 7 L10 4 L11.8 7" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (kind === "yellow" || kind === "red") {
    return <span style={{ flexShrink: 0, width: 15, height: 19, borderRadius: 2, background: kind === "red" ? "#dc2626" : "#facc15", boxShadow: "0 1px 2px rgba(0,0,0,0.25)" }} />;
  }
  return <span style={{ flexShrink: 0, width: 8, height: 8, borderRadius: "50%", background: "var(--text-muted)" }} />;
}