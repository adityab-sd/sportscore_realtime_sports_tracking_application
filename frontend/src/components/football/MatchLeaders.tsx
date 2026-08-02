"use client";
import Link from "next/link";
import type { MatchLeader } from "@/types/matchSummary";

/**
 * MatchLeaders — Player Stats tab. Renders the match-leader cards (top shooter,
 * pass master, defensive, goalkeeper), each with the player's shirt, name,
 * position and headline stat — like ESPN's "Match Leaders".
 *
 * Reads `leaders` from the match summary (backend must forward it). Shows a
 * graceful message when empty so it never looks broken pre-wiring.
 */
export default function MatchLeaders({
  leaders,
  league,
  homeColor = "#003f88",
  awayColor = "#dc2626",
}: {
  leaders: MatchLeader[] | undefined;
  league?: string;
  homeColor?: string;
  awayColor?: string;
}) {
  if (!leaders || leaders.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "40px 0" }}>
        Player stats will appear once the match data is available.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
      {leaders.map((l, i) => (
        <LeaderCard key={`${l.category}-${i}`} leader={l} league={league} homeColor={homeColor} awayColor={awayColor} />
      ))}
    </div>
  );
}

function LeaderCard({
  leader, league, homeColor, awayColor,
}: {
  leader: MatchLeader; league?: string; homeColor: string; awayColor: string;
}) {
  const teamColor = leader.team === "home" ? homeColor : awayColor;
  const href = leader.playerId && league
    ? `/football/player/${leader.playerId}?league=${league}`
    : null;

  const Shirt = (
    <svg width="44" height="44" viewBox="0 0 46 46" style={{ flexShrink: 0 }}>
      <path d="M14 9 L18 6 L28 6 L32 9 L40 14 L36 20 L33 18 L33 40 L13 40 L13 18 L10 20 L6 14 Z"
        fill={teamColor} stroke="#00000022" strokeWidth="1" />
      <text x="23" y="27" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="800" fill="#fff">
        {leader.jersey ?? ""}
      </text>
    </svg>
  );

  const Body = (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>
        {leader.displayName}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {Shirt}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {leader.player}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {leader.teamShort}{leader.position ? ` · ${leader.position}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--obsidian)" }}>{leader.value}</div>
          {leader.detail && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{leader.detail}</div>}
        </div>
      </div>
    </>
  );

  const cardStyle: React.CSSProperties = {
    background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12,
    padding: "14px 16px", textDecoration: "none", display: "block",
  };

  return href ? <Link href={href} style={cardStyle}>{Body}</Link> : <div style={cardStyle}>{Body}</div>;
}