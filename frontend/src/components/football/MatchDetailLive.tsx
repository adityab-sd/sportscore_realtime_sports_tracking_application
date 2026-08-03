"use client";
import { adaptPlays } from "@/lib/adaptPlays";
import type { ESPNMatchDetail } from "@/lib/api/espn";
import ShotMap from "./pitch/ShotMap";
import MatchEventsTimeline from "./MatchEventsTimeline";
import LiveCommentary from "./LiveCommentary";
import MatchTimeline from "./MatchTimeline";
import type { Match } from "@/types/football";

/**
 * MatchDetailLive — PRESENTATIONAL. No poll of its own.
 *
 * The parent (MatchLiveSection) owns the single 30s REST poll and passes the
 * fresh `match` (unified, with live elapsed) and raw `detail` (ESPNMatchDetail)
 * down as props. This component just renders from them.
 *
 * COST: 0 — no fetch, no interval, no SignalR. Pure render from props.
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
  // Map the freshly-polled detail's plays[] into PlayPoint[].
  const plays = adaptPlays(detail, match);
  const hasPlays = plays.length > 0;

  const homeColor = "#003f88";
  const awayColor = "#dc2626";
  const homeShort = match.homeTeam.shortName;
  const awayShort = match.awayTeam.shortName;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Shot map — hidden when no play data (old matches where ESPN pruned). */}
      {hasPlays && (
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
      )}

      {/* Match Timeline — events on a KO→HT→FT bar. Always available. */}
      <MatchTimeline match={match} plays={plays} />

      {/* Live commentary — key events from plays[], newest first. Only while live. */}
      {live && hasPlays && (
        <LiveCommentary plays={plays} homeShort={homeShort} awayShort={awayShort} />
      )}

      {/* Match events — OneFootball-style two-sided timeline. */}
      <MatchEventsTimeline match={match} />
    </div>
  );
}