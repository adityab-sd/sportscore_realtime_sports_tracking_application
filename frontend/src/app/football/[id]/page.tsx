import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMatchDetail, getRoster, getStandings, getTeam,
} from "@/lib/api/espn";
import { leagueHasFullTable } from "@/types/football";
import MatchStatsComparison from "@/components/football/MatchStatsComparison";
import MatchLiveSection from "@/components/football/MatchLiveSection";
import LineupLiveSection from "@/components/football/LineupLiveSection";
import MatchSquadsPreview from "@/components/football/MatchSquadsPreview";
import MiniStandings from "@/components/football/MiniStandings";
import MatchSidebar from "@/components/football/MatchSidebar";
import GameInfoCard from "@/components/football/GameInfoCard";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string }>;
}

export default async function MatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { league = "eng.1" } = await searchParams;

  const match = await getMatchDetail(league, id);
  if (!match) return notFound();

  const isPre = match.statusState === "pre";
  const isPost = match.statusState === "post";

  const [homeRoster, awayRoster] = isPre
    ? await Promise.all([getRoster(league, match.homeTeam.id), getRoster(league, match.awayTeam.id)])
    : [[], []];

  const showStandings = isPost && leagueHasFullTable(league);
  const standings = showStandings ? await getStandings(league) : [];

  const stats = null;

  const [homeTeamInfo, awayTeamInfo] = await Promise.all([
    getTeam(league, match.homeTeam.id),
    getTeam(league, match.awayTeam.id),
  ]);

  return (
    <div style={{ width: "100%", maxWidth: 1600, margin: "0 auto", paddingTop: 24, paddingBottom: 40, paddingLeft: "clamp(12px,2vw,24px)", paddingRight: "clamp(12px,2vw,24px)" }}>
      <Link href="/football" style={{ display: "inline-block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", marginBottom: 20, padding: "6px 10px", borderRadius: 7, background: "var(--cloud)" }}>
        ← Football
      </Link>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* Left column: Lineups / Squads */}
        <div style={{ flex: "1 1 260px", minWidth: 260, maxWidth: 320 }}>
          {isPre ? (
            <MatchSquadsPreview
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              homeRoster={homeRoster}
              awayRoster={awayRoster}
              league={league}
            />
          ) : (
            <LineupLiveSection
              initialDetail={match}
              league={league}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
            />
          )}

          {/* Game Info below lineup */}
          <GameInfoCard match={match} />
        </div>

        {/* Middle column.
            MatchLiveSection owns a single 30s REST poll (0 SignalR messages)
            that keeps the score header, live clock and detail block fresh.
            It renders the ScoreHeader itself and shows the ball tracker /
            shot map + events for live and finished matches. */}
        <div style={{ flex: "4 1 620px", minWidth: 0 }}>
          <MatchLiveSection
            initialDetail={match}
            league={league}
            venue={match.venue}
            competitionHref={`/football/league/${league}`}
          />


          {showStandings && standings.length > 0 && (
            <>
              <SectionHeading text="Standings" />
              <MiniStandings
                rows={standings}
                league={league}
                homeTeamId={match.homeTeam.id}
                awayTeamId={match.awayTeam.id}
              />
            </>
          )}
        </div>

        {/* Right column: Quick links */}
        <div style={{ flex: "1 1 260px", minWidth: 240, maxWidth: 300 }}>
          <MatchSidebar league={league} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ text }: { text: string }) {
  return (
    <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)", margin: "20px 0 10px", letterSpacing: "-0.2px" }}>
      {text}
    </h2>
  );
}