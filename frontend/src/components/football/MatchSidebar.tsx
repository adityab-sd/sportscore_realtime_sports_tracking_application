import Link from "next/link";
import { leagueName, leagueHasFullTable } from "@/types/football";

interface TeamRef { id: string; name: string; shortName: string; logo: string | null; }

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
      {label}
      <span style={{ color: "var(--text-muted)" }}>→</span>
    </Link>
  );
}

function QuickLinksPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 16 }}>
      <div style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--obsidian)", textTransform: "uppercase", letterSpacing: "0.8px", borderBottom: "1px solid var(--border)" }}>
        {title}
      </div>
      <div style={{ padding: "0 18px" }}>{children}</div>
    </div>
  );
}

export default function MatchSidebar({
  league, homeTeam, awayTeam,
}: {
  league: string;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
}) {
  const qs = `?league=${league}`;

  return (
    <div>
      <QuickLinksPanel title={`${leagueName(league)} Quick Links`}>
        <LinkRow href={`/football/fixtures${qs}`} label="Fixtures" />
        {leagueHasFullTable(league) && <LinkRow href={`/football/standings${qs}`} label="Standings" />}
        <LinkRow href={`/football/statistics${qs}`} label="Statistics" />
        <LinkRow href={`/football/news${qs}`} label="News" />
        {league === "fifa.world" && <LinkRow href="/football/world-cup" label="Bracket" />}
      </QuickLinksPanel>

      <QuickLinksPanel title={`${homeTeam.shortName || homeTeam.name} Quick Links`}>
        <LinkRow href={`/football/team/${homeTeam.id}${qs}#schedule`} label="Schedule" />
        <LinkRow href={`/football/team/${homeTeam.id}${qs}`} label="Squad" />
      </QuickLinksPanel>

      <QuickLinksPanel title={`${awayTeam.shortName || awayTeam.name} Quick Links`}>
        <LinkRow href={`/football/team/${awayTeam.id}${qs}#schedule`} label="Schedule" />
        <LinkRow href={`/football/team/${awayTeam.id}${qs}`} label="Squad" />
      </QuickLinksPanel>
    </div>
  );
}