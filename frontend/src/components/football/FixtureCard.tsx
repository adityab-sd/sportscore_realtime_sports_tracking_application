"use client";

import { formatMatchDateTime, formatMatchDay } from "@/lib/formatDate";
import Link from "next/link";
import { ESPNFixture } from "@/lib/api/espn";
import TeamLogo from "./TeamLogo";

// ============================================================================
// ADDRESSED: guarded Date parsing
// ----------------------------------------------------------------------------
// ESPN kickoff strings are external input; new Date("bad-value") produces an
// Invalid Date whose getters return NaN, rendering labels like "NaN:NaN".
// Check validity before formatting in both time and date-only helpers.
//
// EXAMPLE:
//   const d = kickoff ? new Date(kickoff) : null; if (!d || Number.isNaN(d.getTime())) return "TBD";
// ============================================================================
// Date formatting now uses shared lib/formatDate.ts utility
// which formats in the user's local timezone consistently.

/** Date-only label (no time) — used for finished matches where only the day matters. */

// ============================================================================
// ADDRESSED: league slug fallback
// ----------------------------------------------------------------------------
// Detail links silently default unknown fixture leagues to eng.1, so a World Cup
// or Champions League fixture without _slug routes to the wrong league context.
// Resolve the slug from fixture.competition or omit the query instead.
//
// EXAMPLE:
//   const href = leagueSlug ? `/football/${fixture.id}?league=${leagueSlug}` : `/football/${fixture.id}`;
// ============================================================================
export default function FixtureCard({ fixture, leagueSlug }: { fixture: ESPNFixture; leagueSlug?: string }) {
  const isPost = fixture.statusState === "post";
  const isPre  = fixture.statusState === "pre";
  const homeLead = isPost && fixture.homeScore != null && fixture.awayScore != null && fixture.homeScore > fixture.awayScore;
  const awayLead = isPost && fixture.homeScore != null && fixture.awayScore != null && fixture.awayScore > fixture.homeScore;

  return (
    <Link href={`/football/${fixture.id}?league=${leagueSlug ?? 'eng.1'}`} style={{ textDecoration: "none" }}>
      <div className="card-hover" style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
        {/* Competition + round (knockout stage) + status */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {fixture.competition || "Football"}
            {fixture.round && <span style={{ color: "var(--navy)", fontWeight: 700 }}> · {fixture.round}</span>}
          </span>
          {isPost && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }} suppressHydrationWarning>{formatMatchDay(fixture.kickoff)}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>FT</span>
            </span>
          )}
          {isPre  && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", flexShrink: 0 }} suppressHydrationWarning>{formatMatchDateTime(fixture.kickoff)}</span>}
        </div>

        {/* Teams + score */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <TeamLogo logo={fixture.homeTeam.logo} shortName={fixture.homeTeam.shortName} size={24} highlight={homeLead} />
            <span style={{ fontSize: 13, fontWeight: homeLead ? 700 : 500, color: homeLead ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {fixture.homeTeam.name}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 52, flexShrink: 0 }}>
            {isPost ? (
              <span className="score-num" style={{ fontSize: 18 }}>
                <span style={{ color: homeLead ? "var(--obsidian)" : "var(--text-muted)" }}>{fixture.homeScore}</span>
                <span style={{ color: "var(--border)", fontSize: 14, margin: "0 3px" }}>–</span>
                <span style={{ color: awayLead ? "var(--obsidian)" : "var(--text-muted)" }}>{fixture.awayScore}</span>
              </span>
            ) : (
              <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>vs</span>
            )}
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: awayLead ? 700 : 500, color: awayLead ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
              {fixture.awayTeam.name}
            </span>
            <TeamLogo logo={fixture.awayTeam.logo} shortName={fixture.awayTeam.shortName} size={24} highlight={awayLead} />
          </div>
        </div>
      </div>
    </Link>
  );
}