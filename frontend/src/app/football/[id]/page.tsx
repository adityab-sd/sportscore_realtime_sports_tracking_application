import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMatchDetail, getRoster, getStandings, getTeam,
  type ESPNMatchDetail,
} from "@/lib/api/espn";
import type { Match as FootballMatch } from "@/types/football";
import { leagueHasFullTable } from "@/types/football";
import ScoreHeader from "@/components/football/ScoreHeader";
import MatchStatsComparison from "@/components/football/MatchStatsComparison";
import MatchEventsCard from "@/components/football/MatchEventsCard";
import MatchDetailLive from "@/components/football/MatchDetailLive";
import MatchLineupSection from "@/components/football/MatchLineupSection";
import MatchSquadsPreview from "@/components/football/MatchSquadsPreview";
import MiniStandings from "@/components/football/MiniStandings";
import MatchSidebar from "@/components/football/MatchSidebar";
import GameInfoCard from "@/components/football/GameInfoCard";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string }>;
}

function toUnifiedMatch(m: ESPNMatchDetail): FootballMatch {
  return {
    id: Number(m.id),
    sport: "football",
    status: m.status,
    elapsed: null,
    kickoff: m.kickoff,
    competition: m.competition,
    homeTeam: { id: Number(m.homeTeam.id), name: m.homeTeam.name, shortName: m.homeTeam.shortName, logo: m.homeTeam.logo },
    awayTeam: { id: Number(m.awayTeam.id), name: m.awayTeam.name, shortName: m.awayTeam.shortName, logo: m.awayTeam.logo },
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    events: m.events.map(e => ({
      minute: e.minute, type: e.type, detail: e.detail,
      player: e.player, assist: e.assist, teamId: Number(e.teamId),
    })),
  };
}

export default async function MatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { league = "eng.1" } = await searchParams;

  const match = await getMatchDetail(league, id);
  if (!match) return notFound();

  const isPre = match.statusState === "pre";
  const isPost = match.statusState === "post";
  const isLive = match.statusState === "in";

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

  const unified = toUnifiedMatch(match);

  return (
    <div className="container" style={{ maxWidth: 1240, paddingTop: 24, paddingBottom: 40 }}>
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
            <MatchLineupSection
              lineups={match.lineups ?? []}
              events={match.events}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              league={league}
            />
          )}

          {/* Game Info below lineup */}
          <GameInfoCard match={match} />
        </div>

        {/* Middle column */}
        <div style={{ flex: "3 1 500px", minWidth: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <ScoreHeader
              match={unified}
              league={league}
              venue={match.venue}
              competitionHref={`/football/league/${league}`}
              compact
            />
          </div>

          {isLive && <MatchDetailLive id={Number(id)} />}

          {!isPre && (
            <>
              <SectionHeading text="Match Events" />
              <MatchEventsCard match={unified} lineups={match.lineups} league={league} />
            </>
          )}

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