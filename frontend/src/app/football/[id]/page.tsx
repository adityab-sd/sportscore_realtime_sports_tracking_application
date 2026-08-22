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
import OddsCard from "@/components/football/OddsCard";
import MatchPreview from "@/components/football/MatchPreview";
import { MatchRadioBinder } from "@/hooks/useRadio";

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
      <MatchRadioBinder sport="football" league={league} initialDetail={match} />
      <Link href="/football" style={{ display: "inline-block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", marginBottom: 20, padding: "6px 10px", borderRadius: 7, background: "var(--cloud)" }}>
        ← Football
      </Link>

      <div className="match-cols">

        {/* Left column: Lineups / Squads */}
        <div className="match-col-left">
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
        <div className="match-col-mid">
          {isPre && (
          <MatchPreview
            match={match}
            league={league}
            homeInfo={homeTeamInfo}
            awayInfo={awayTeamInfo}
          />
        )}
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

        {/* Right column: Quick links + Game Odds */}
        <div className="match-col-right">
          <MatchSidebar league={league} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
          <OddsCard
            odds={match.odds}
            homeShort={match.homeTeam.shortName}
            awayShort={match.awayTeam.shortName}
            homeTeamId={match.homeTeam.id}
          />
        </div>
      </div>

      <style>{`
        .match-cols {
          display: flex;
          gap: 20px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .match-col-left  { flex: 1 1 260px; min-width: 260px; max-width: 320px; }
        .match-col-mid   { flex: 4 1 620px; min-width: 0; }
        .match-col-right { flex: 1 1 260px; min-width: 240px; max-width: 300px; }

        /* Mobile: single column, and put the match (score + events) FIRST,
           then lineups, then the quick-links sidebar. */
        @media (max-width: 900px) {
          .match-cols { flex-direction: column; flex-wrap: nowrap; }
          .match-col-left, .match-col-mid, .match-col-right {
            flex: 1 1 auto;
            width: 100%;
            max-width: 100%;
            min-width: 0;
          }
          .match-col-mid   { order: 1; }
          .match-col-left  { order: 2; }
          .match-col-right { order: 3; }
        }
      `}</style>
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