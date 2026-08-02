"use client";
import { adaptPlays } from "@/lib/adaptPlays";
import type { ESPNMatchDetail } from "@/lib/api/espn";
import ShotMap from "./pitch/ShotMap";
import EventFeed from "./EventFeed";
import LiveCommentary from "./LiveCommentary";
import type { Match } from "@/types/football";

/**
 * MatchDetailLive — presentational live detail block.
 *
 * It runs NO poll of its own. The parent (MatchLiveSection) owns the single 30s
 * REST poll and passes the FRESH unified `match` (with a live `elapsed` derived
 * from status) and raw `detail` down. Every child renders from that fresh data,
 * so the shot map, events and commentary all update live.
 *
 * The live ball tracker was intentionally removed (it was heavy and unreliable,
 * and only had per-30s data to animate). Instead the shot map (which works for
 * both in-progress and finished matches) plus a key-events LiveCommentary feed
 * give a live feel with none of the jank.
 *
 * COST: 0 SignalR messages — the parent drives this purely via REST polling.
 */
export default function MatchDetailLive({
  match,
  detail,
  league,
  live,
  lastUpdated,
  isFetching,
}: {
  match: Match;
  detail: ESPNMatchDetail;
  league: string;
  live: boolean;
  lastUpdated: Date | null;
  isFetching: boolean;
}) {
  // Map the freshly-polled detail's plays[] into our PlayPoint[].
  const plays = adaptPlays(detail, match);

  const homeColor = "#003f88";
  const awayColor = "#dc2626";
  const homeShort = match.homeTeam.shortName;
  const awayShort = match.awayTeam.shortName;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Shot map — works for both live and finished. Refreshes every 30s. */}
      <div>
        {live && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 6 }}>
            <span suppressHydrationWarning style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {isFetching ? "Updating…" : lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
            </span>
          </div>
        )}
        <ShotMap
          plays={plays}
          homeColor={homeColor}
          awayColor={awayColor}
          homeShort={homeShort}
          awayShort={awayShort}
          league={league}
          homeTeamId={match.homeTeam.id}
          awayTeamId={match.awayTeam.id}
        />
      </div>

      {/* Live commentary — key events (goals/cards/subs/shots) from plays[],
          newest first. Only while live. */}
      {live && (
        <LiveCommentary plays={plays} homeShort={homeShort} awayShort={awayShort} />
      )}

      {/* Match events — goals/cards from the freshly-polled match. */}
      {match.events && match.events.length > 0 && (
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Match Events
            </span>
          </div>
          <div style={{ padding: "8px 0" }}>
            <EventFeed match={match} />
          </div>
        </div>
      )}
    </div>
  );
}