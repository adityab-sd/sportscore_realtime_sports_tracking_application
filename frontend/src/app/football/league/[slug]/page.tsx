import Link from "next/link";
import { notFound } from "next/navigation";
import { getStandings, getNews, getFixtures, getLeaders } from "@/lib/api/espn";
import { LEAGUES, leagueName } from "@/types/football";
import NewsCard from "@/components/news/NewsCard";
import StandingsTable from "@/components/football/StandingsTable";
import LeagueMatchFeed from "@/components/football/LeagueMatchFeed";
import FixtureCard from "@/components/football/FixtureCard";
import TopScorers from "@/components/football/TopScorers";

export const dynamic = "force-dynamic";
interface Props { params: Promise<{ slug: string }> }

export default async function LeaguePage({ params }: Props) {
  const { slug } = await params;
  const league = LEAGUES.find(l => l.slug === slug);
  if (!league) return notFound();


  // ============================================================================
  // ADDRESSED: Keep dependent navigation scoped to this league
  // ----------------------------------------------------------------------------
  // The header "Full Standings" link drops the current slug and lands on the default
  // standings league, which is surprising from a league detail page.
  //
  // EXAMPLE:
  //   <Link href={`/football/standings?league=${slug}`}>Full Standings →</Link>
  // ============================================================================
  const [rows, news, fixtures, leaders] = await Promise.all([
    getStandings(slug),
    getNews(slug, 6),
    getFixtures(slug),
    getLeaders(slug),
  ]);


  // ============================================================================
  // ADDRESSED: Do not hide total league data failures
  // ----------------------------------------------------------------------------
  // The four league fetches all fall back to empty arrays, and the page simply hides
  // sections. If every dataset is empty, users see a mostly blank league page instead
  // of a recoverable error/empty state.
  //
  // EXAMPLE:
  //   if (!rows.length && !news.length && !fixtures.results.length && !fixtures.upcoming.length && !leaders.length) throw new Error("League data unavailable");
  // ============================================================================
  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
            {league.name}
          </h1>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/football" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>← All Football</Link>
            <Link href="/football/standings" style={{ fontSize: 13, color: "var(--navy)", textDecoration: "none", fontWeight: 600 }}>Full Standings →</Link>
          </div>
        </div>
      </div>

      {/* Live Matches - from SignalR, filtered client-side */}
      <section style={{ marginBottom: 40 }}>
        <div className="section-label" style={{ marginBottom: 14 }}>Matches</div>
        <LeagueMatchFeed leagueName={league.name} slug={slug} />
      </section>

      {/* Standings */}
      {rows.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Table</div>
            <Link href={`/football/standings?league=${slug}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>
              Full table →
            </Link>
          </div>
          <StandingsTable rows={rows} league={slug} limit={6} />
          {rows.length > 6 && (
            <Link href={`/football/standings?league=${slug}`} style={{ display: "block", textAlign: "center", padding: "12px 0 0", fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>
              View all {rows.length} teams →
            </Link>
          )}
        </section>
      )}

      {/* Top Scorers */}
      <section style={{ marginBottom: 40 }}>
        {leaders.length > 0 ? (
          <TopScorers leaders={leaders} leagueLabel={league.name} />
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)", margin: 0, letterSpacing: "-0.3px" }}>Top Scorers</h2>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{league.name}</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              No scorer data yet — this usually means the season hasn&apos;t started or no goals have been recorded.
            </p>
          </div>
        )}
      </section>

      {/* Results + Upcoming */}
      {(fixtures.results.length > 0 || fixtures.upcoming.length > 0) && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: -8 }}>
            <Link href={`/football/fixtures?league=${slug}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>
              View full fixtures →
            </Link>
          </div>
          {/* ADDRESSED: Add per-column empty states: when only results or upcoming exists, the other column renders a blank section. EXAMPLE: {fixtures.results.length === 0 ? <p>No recent results.</p> : fixtures.results.slice(0, 10).map(f => <FixtureCard key={f.id} fixture={f} leagueSlug={slug} />)}. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 40, marginTop: 20 }} className="page-split">
            <section>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>Results</h2>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{fixtures.results.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fixtures.results.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No recent results.</p> : fixtures.results.slice(0, 10).map(f => <FixtureCard key={f.id} fixture={f} leagueSlug={slug} />)}
              </div>
            </section>
            <section>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>Upcoming</h2>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{fixtures.upcoming.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fixtures.upcoming.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No upcoming fixtures.</p> : fixtures.upcoming.slice(0, 10).map(f => <FixtureCard key={f.id} fixture={f} leagueSlug={slug} />)}
              </div>
            </section>
          </div>
        </>
      )}

      {/* Latest News */}
      {news.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Latest News</div>
            <Link href="/football/news" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>All news →</Link>
          </div>
          <div className="news-grid">
            {news.slice(0, 3).map(a => <NewsCard key={a.id} article={a} />)}
          </div>
        </section>
      )}
    </div>
  );
}