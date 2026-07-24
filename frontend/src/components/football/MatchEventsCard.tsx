"use client";
import { useState } from "react";
import EventFeed from "./EventFeed";
import TeamLogo from "./TeamLogo";
import type { Match } from "@/types/football";
import type { ESPNTeamLineup } from "@/lib/api/espn";

const INITIAL_COUNT = 6;

export default function MatchEventsCard({
  match, lineups, league,
}: {
  match: Match;
  lineups?: ESPNTeamLineup[];
  league?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasEvents = match.events && match.events.length > 0;
  const overflow = hasEvents && match.events.length > INITIAL_COUNT;

  const visibleMatch: Match = expanded || !overflow
    ? match
    : { ...match, events: [...match.events].sort((a, b) => b.minute - a.minute).slice(0, INITIAL_COUNT) };

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 16 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <TeamLogo logo={match.homeTeam.logo} shortName={match.homeTeam.shortName} size={26} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          Match Events
        </span>
        <TeamLogo logo={match.awayTeam.logo} shortName={match.awayTeam.shortName} size={26} />
      </div>
      <div style={{ padding: "8px 0" }}>
        <EventFeed match={visibleMatch} lineups={lineups} league={league} />
      </div>
      {overflow && (
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 16px" }}>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", background: "transparent", border: "1px solid var(--border)", borderRadius: 999, padding: "8px 20px", cursor: "pointer" }}
          >
            {expanded ? "Show less" : "View all"}
          </button>
        </div>
      )}
    </div>
  );
}