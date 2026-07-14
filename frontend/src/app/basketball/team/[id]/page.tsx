import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeam, getRoster, getTeamInjuries, getTeamSchedule, getTeamRecord, getTeamDepthChart } from "@/lib/api/basketball";
import { leagueName } from "@/types/basketball";
import TeamLogo from "@/components/football/TeamLogo";
import RosterList from "@/components/basketball/RosterList";
import InjuryList from "@/components/basketball/InjuryList";
import { TeamScheduleList, DepthChart, TeamRecordCard } from "@/components/basketball/TeamDetailCards";
import ComingSoon from "@/components/basketball/ComingSoon";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string }>;
}

export default async function TeamPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { league = "nba" } = await searchParams;

  const [team, roster, injuries, scheduleRaw, recordRaw, depthRaw] = await Promise.all([
    getTeam(league, id),
    getRoster(league, id),
    getTeamInjuries(league, id),
    getTeamSchedule(league, id),
    getTeamRecord(league, id),
    getTeamDepthChart(league, id),
  ]);

  if (!team) return notFound();

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <Link href={`/basketball/standings?league=${league}`} style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", display: "inline-block", marginBottom: 20 }}>
        ← {leagueName(league)}
      </Link>

      {/* Team header */}
      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, marginBottom: 28, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <TeamLogo logo={team.logo} shortName={team.shortName} size={64} highlight />
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>{team.name}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            {[leagueName(league), team.venue, team.record].filter(Boolean).join(" · ")}
          </p>
        </div>
        {team.color && (
          <div style={{ marginLeft: "auto", width: 36, height: 36, borderRadius: "50%", background: team.color, border: "2px solid var(--border)", flexShrink: 0 }} title="Team colour" />
        )}
      </div>

      {/* Record breakdown */}
      {recordRaw && (
        <section style={{ marginBottom: 28 }}>
          <SectionLabel text="Record" />
          <TeamRecordCard data={recordRaw} />
        </section>
      )}

      {/* Schedule */}
      {scheduleRaw && (
        <section style={{ marginBottom: 28 }}>
          <SectionLabel text="Schedule" />
          <TeamScheduleList data={scheduleRaw} league={league} />
        </section>
      )}

      {/* Injuries */}
      {injuries.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <SectionLabel text="Injuries" />
          <InjuryList injuries={injuries} />
        </section>
      )}

      {/* Depth chart */}
      {depthRaw && (
        <section style={{ marginBottom: 28 }}>
          <SectionLabel text="Depth Chart" />
          <DepthChart data={depthRaw} />
        </section>
      )}

      {/* Team News placeholder */}
      <section style={{ marginBottom: 28 }}>
        <SectionLabel text="Team News" />
        <ComingSoon title="Team News" description="Team-specific news feed — backend endpoint in progress." />
      </section>

      {/* Team Stat Leaders placeholder */}
      <section style={{ marginBottom: 28 }}>
        <SectionLabel text="Team Stat Leaders" />
        <ComingSoon title="Team Leaders" description="Top performers by category — backend endpoint in progress." />
      </section>

      {/* Roster */}
      <SectionLabel text="Roster" />
      <RosterList roster={roster} league={league} teamId={id} />
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>{text}</h2>
  );
}