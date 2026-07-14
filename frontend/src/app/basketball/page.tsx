import Link from "next/link";
import { getScoreboard, getFixtures, getStandings, getLeaders, getNews } from "@/lib/api/basketball";
import { LEAGUES, leagueName } from "@/types/basketball";
import TodaysGames from "@/components/basketball/TodaysGames";
import FixtureCard from "@/components/basketball/FixtureCard";
import StandingsTable from "@/components/basketball/StandingsTable";
import StatLeaders from "@/components/basketball/StatLeaders";
import NewsCard from "@/components/basketball/NewsCard";
import ComingSoon from "@/components/basketball/ComingSoon";
import type { Metadata } from "next";
import type { BBGame, BBFixture } from "@/lib/api/basketball";

export const metadata: Metadata = {
  title: "Basketball — SportScore",
  description: "Live NBA & WNBA scores, standings, fixtures and news.",
};

export const dynamic = "force-dynamic";

interface SlugGame extends BBGame { _slug: string }
interface SlugFixture extends BBFixture { _slug: string }

async function getAggregatedData() {
  const slugs = LEAGUES.map((l) => l.slug);

  // ============================================================================
  // PLEASE review — partial failure handling is already correct — keep this
  // ----------------------------------------------------------------------------
  // Using Promise.allSettled per data family lets one failing league/feed degrade
  // instead of taking down the basketball landing page. Keep that pattern when
  // adding more league-wide fetches.
  //
  // EXAMPLE:
  //   const results = await Promise.allSettled(slugs.map((s) => getNews(s, 4)));
  // ============================================================================
  const [scoreResults, fixtureResults, standingResults, leaderResults, newsResults] =
    await Promise.all([
      Promise.allSettled(slugs.map((s) => getScoreboard(s))),
      Promise.allSettled(slugs.map((s) => getFixtures(s))),
      Promise.allSettled(slugs.map((s) => getStandings(s))),
      Promise.allSettled(slugs.map((s) => getLeaders(s))),
      Promise.allSettled(slugs.map((s) => getNews(s, 4))),
    ]);

  const seenGames = new Set<string>();
  const allGames: SlugGame[] = [];
  scoreResults.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    for (const g of r.value) {
      if (!seenGames.has(g.id)) { seenGames.add(g.id); allGames.push({ ...g, _slug: slugs[i] }); }
    }
  });

  const seenFix = new Set<string>();
  const allResults: SlugFixture[] = [];
  const allUpcoming: SlugFixture[] = [];
  fixtureResults.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    // PLEASE review — missing null payload guard: a fulfilled helper can still return null/undefined, so r.value.results can crash the page. EXAMPLE: if (r.status !== "fulfilled" || !r.value) return;
    for (const f of r.value.results) {
      if (!seenFix.has(f.id)) { seenFix.add(f.id); allResults.push({ ...f, _slug: slugs[i] }); }
    }
    for (const f of r.value.upcoming) {
      if (!seenFix.has(f.id)) { seenFix.add(f.id); allUpcoming.push({ ...f, _slug: slugs[i] }); }
    }
  });
  // PLEASE review — invalid dates sort as NaN: new Date(undefined or bad ESPN dates).getTime() makes the comparator unstable. EXAMPLE: const time = (v?: string) => { const t = v ? Date.parse(v) : 0; return Number.isFinite(t) ? t : 0; };
  allResults.sort((a, b) => new Date(b.tipoff ?? 0).getTime() - new Date(a.tipoff ?? 0).getTime());
  allUpcoming.sort((a, b) => new Date(a.tipoff ?? 0).getTime() - new Date(b.tipoff ?? 0).getTime());

  const standings = standingResults
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof getStandings>>> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  const leaders = leaderResults
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof getLeaders>>> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  const seenNews = new Set<string>();
  const news = newsResults
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof getNews>>> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .filter((a) => { if (seenNews.has(a.id)) return false; seenNews.add(a.id); return true; })
    .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())
    .slice(0, 6);

  // PLEASE review — cross-league id collisions: deduping games/fixtures/news by id alone assumes ESPN ids are globally unique across NBA, WNBA and NCAA. EXAMPLE: const key = `${slugs[i]}:${g.id}`;
  return { allGames, allResults: allResults.slice(0, 20), allUpcoming: allUpcoming.slice(0, 20), standings, leaders, news };
}

export default async function BasketballPage() {
  const { allGames, allResults, allUpcoming, standings, leaders, news } = await getAggregatedData();

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Basketball</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Live scores, standings, fixtures &amp; news</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/basketball/news" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>News</Link>
          <Link href="/basketball/standings" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>Standings</Link>
          <Link href="/basketball/statistics" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>Stats</Link>
          <Link href="/basketball/draft" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>Draft</Link>
        </div>
      </div>

      {/* League pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28, overflowX: "auto", paddingBottom: 4 }}>
        {LEAGUES.map((l) => (
          <Link key={l.slug} href={`/basketball/league/${l.slug}`} className="pill" style={{ textDecoration: "none" }}>{l.short}</Link>
        ))}
      </div>

      {/* Date-filtered scoreboard placeholder */}
      <div style={{ marginBottom: 20 }}>
        <ComingSoon title="Date Picker" description="Browse scores by date — backend endpoint in progress." />
      </div>

      {/* Today's Games */}
      <section style={{ marginBottom: 40 }}>
        <div className="section-label" style={{ marginBottom: 14 }}>Today&apos;s Games</div>
        <TodaysGames games={allGames} defaultLeague="nba" />
      </section>

      {/* Fixtures */}
      {(allResults.length > 0 || allUpcoming.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 40 }} className="page-split">
          {allResults.length > 0 && (
            <section>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>Recent Results</h2>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{allResults.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {allResults.slice(0, 10).map((f) => <FixtureCard key={f.id} fixture={f} leagueSlug={f._slug} />)}
              </div>
            </section>
          )}
          {allUpcoming.length > 0 && (
            <section>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>Upcoming</h2>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{allUpcoming.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {allUpcoming.slice(0, 10).map((f) => <FixtureCard key={f.id} fixture={f} leagueSlug={f._slug} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Standings */}
      {standings.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Standings</div>
            <Link href="/basketball/standings" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>Full standings →</Link>
          </div>
          {/* PLEASE review — hard-coded standings league: aggregated standings include multiple leagues but this renders them as NBA links/formatting. EXAMPLE: <StandingsTable rows={standings.filter((r) => r.league === "nba")} league="nba" limit={8} />. */}
          <StandingsTable rows={standings} league="nba" limit={8} />
        </section>
      )}

      {/* Leaders */}
      {leaders.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <StatLeaders leaders={leaders} leagueLabel="NBA" />
        </section>
      )}

      {/* News */}
      {news.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Latest News</div>
            <Link href="/basketball/news" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>All news →</Link>
          </div>
          <div className="news-grid">
            {news.slice(0, 3).map((a) => <NewsCard key={a.id} article={a} />)}
          </div>
        </section>
      )}
    </div>
  );
}