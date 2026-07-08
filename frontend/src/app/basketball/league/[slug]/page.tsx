import Link from "next/link";
import { notFound } from "next/navigation";
import { getScoreboard, getStandings, getNews, getFixtures, getLeaders } from "@/lib/api/basketball";
import { LEAGUES } from "@/types/basketball";
import NewsCard from "@/components/basketball/NewsCard";
import StandingsTable from "@/components/basketball/StandingsTable";
import TodaysGames from "@/components/basketball/TodaysGames";
import FixtureCard from "@/components/basketball/FixtureCard";
import StatLeaders from "@/components/basketball/StatLeaders";

export const dynamic = "force-dynamic";
interface Props { params: Promise<{ slug: string }> }

export default async function LeaguePage({ params }: Props) {
  const { slug } = await params;
  const league = LEAGUES.find(l => l.slug === slug);
  if (!league) return notFound();

  const [scoreboard, rows, news, fixtures, leaders] = await Promise.all([
    getScoreboard(slug),
    getStandings(slug),
    getNews(slug, 6),
    getFixtures(slug),
    getLeaders(slug),
  ]);

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
            {league.name}
          </h1>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/basketball" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>← All Basketball</Link>
            <Link href={`/basketball/standings?league=${slug}`} style={{ fontSize: 13, color: "var(--navy)", textDecoration: "none", fontWeight: 600 }}>Full Standings →</Link>
          </div>
        </div>
      </div>

      <section style={{ marginBottom: 40 }}>
        <div className="section-label" style={{ marginBottom: 14 }}>Games</div>
        <TodaysGames games={scoreboard} defaultLeague={slug} />
      </section>

      {rows.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Standings</div>
            <Link href={`/basketball/standings?league=${slug}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>
              Full standings →
            </Link>
          </div>
          <StandingsTable rows={rows} league={slug} limit={8} />
        </section>
      )}

      {(fixtures.results.length > 0 || fixtures.upcoming.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 40 }} className="page-split">
          <section>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>Results</h2>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{fixtures.results.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {fixtures.results.slice(0, 10).map(f => <FixtureCard key={f.id} fixture={f} leagueSlug={slug} />)}
            </div>
          </section>
          <section>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>Upcoming</h2>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{fixtures.upcoming.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {fixtures.upcoming.slice(0, 10).map(f => <FixtureCard key={f.id} fixture={f} leagueSlug={slug} />)}
            </div>
          </section>
        </div>
      )}

      {leaders.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <StatLeaders leaders={leaders} leagueLabel={league.name} />
        </section>
      )}

      {news.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Latest News</div>
            <Link href="/basketball/news" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>All news →</Link>
          </div>
          <div className="news-grid">
            {news.slice(0, 3).map(a => <NewsCard key={a.id} article={a} />)}
          </div>
        </section>
      )}
    </div>
  );
}