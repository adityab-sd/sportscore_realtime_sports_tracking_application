import { Fragment } from "react";
import { notFound } from "next/navigation";
import {
  getTeam, getRoster, getTeamInjuries, getTeamSchedule,
  getTeamRecord, getTeamDepthChart, getNews, getStandings,
} from "@/lib/api/espn";
import { leagueName, leagueHasFullTable } from "@/types/football";
import TeamLogo from "@/components/football/TeamLogo";
import TeamTabs, { type TeamTab } from "@/components/football/TeamTabs";
import TeamSquadGrid from "@/components/football/TeamSquadGrid";
import StandingsTable from "@/components/football/StandingsTable";
import ExternalNewsCard from "@/components/news/ExternalNewsCard";
import { TeamScheduleList, TeamRecordCard, InjuryList, DepthChart } from "@/components/football/TeamDetailCards";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string; tab?: string }>;
}

export default async function TeamPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { league = "eng.1", tab } = await searchParams;

  const [team, roster, injuries, scheduleRaw, recordRaw, depthRaw, news, standings] = await Promise.all([
    getTeam(league, id),
    getRoster(league, id),
    getTeamInjuries(league, id),
    getTeamSchedule(league, id),
    getTeamRecord(league, id),
    getTeamDepthChart(league, id),
    getNews(league, 8),
    getStandings(league),
  ]);

  if (!team) return notFound();

  const teamNews = news.filter(n =>
    n.headline?.toLowerCase().includes(team.name.toLowerCase()) ||
    n.headline?.toLowerCase().includes(team.shortName.toLowerCase())
  );

  const accent = team.color ? `#${team.color.replace("#", "")}` : "#1e3a5f";
  const bannerGradient = `linear-gradient(135deg, ${accent} 0%, #0a1628 100%)`;

  const tabs: TeamTab[] = [
    {
      id: "fixtures",
      label: "Fixtures",
      content: (
        <Fragment key="fixtures">
          {scheduleRaw
            ? <TeamScheduleList data={scheduleRaw} league={league} />
            : <EmptyState text="Fixture data unavailable." />}
        </Fragment>
      ),
    },
    {
      id: "standings",
      label: "Standings",
      content: (
        <Fragment key="standings">
          {leagueHasFullTable(league) && standings.length > 0
            ? <StandingsTable rows={standings} league={league} highlightTeamIds={[id]} />
            : <EmptyState text="No full league table for this competition." />}
        </Fragment>
      ),
    },
    {
      id: "squad",
      label: "Squad",
      content: (
        <Fragment key="squad">
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {injuries.length > 0 && (
              <section>
                <SectionLabel text="Injuries" />
                <InjuryList injuries={injuries} />
              </section>
            )}
            <TeamSquadGrid roster={roster} league={league} teamId={id} teamColor={team.color} />
          </div>
        </Fragment>
      ),
    },
    {
      id: "news",
      label: "News",
      content: (
        <Fragment key="news">
          {teamNews.length > 0
            ? (
              <div className="news-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                {teamNews.map(n => <ExternalNewsCard key={n.id} article={n} />)}
              </div>
            )
            : <EmptyState text="No team-specific news right now." />}
        </Fragment>
      ),
    },
    {
      id: "stats",
      label: "Team Stats & Achievements",
      content: (
        <Fragment key="stats">
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {recordRaw && (
              <section>
                <SectionLabel text="Record" />
                <TeamRecordCard data={recordRaw} />
              </section>
            )}
            {depthRaw && (
              <section>
                <SectionLabel text="Depth Chart" />
                <DepthChart data={depthRaw} />
              </section>
            )}
            <section>
              <SectionLabel text="Trophies & Achievements" />
              <EmptyState text="Trophy and achievement history isn't available from the current data source yet." />
            </section>
          </div>
        </Fragment>
      ),
    },
  ];

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>
      {/* Hero banner - matches Player/League page banner treatment */}
      <div style={{
        background: bannerGradient, borderRadius: 16, padding: "28px 28px",
        marginBottom: 28, position: "relative", overflow: "hidden",
      }}>
        {team.logo && (
          <div style={{
            position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
            opacity: 0.18, pointerEvents: "none", width: 220, height: 220,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={team.logo} alt="" width={220} height={220} style={{ width: 220, height: 220, objectFit: "contain" }} />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
          <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: "50%", padding: 8, flexShrink: 0 }}>
            <TeamLogo logo={team.logo} shortName={team.shortName} size={56} />
          </div>
          <div>
            <h1 style={{ fontSize: "clamp(24px,4vw,32px)", fontWeight: 900, color: "#fff", margin: "0 0 4px", letterSpacing: "-0.6px" }}>
              {team.name}
            </h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0, fontWeight: 500 }}>
              {[leagueName(league), team.venue, team.record].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      </div>

      {/* Tabbed navigation */}
      <TeamTabs tabs={tabs} initialTab={tab} />
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>{text}</h2>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "24px 0" }}>{text}</p>;
}