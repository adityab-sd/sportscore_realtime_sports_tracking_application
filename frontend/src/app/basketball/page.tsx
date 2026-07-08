import Link from "next/link";
import { getScoreboard, getFixtures, BBGame, BBFixture } from "@/lib/api/basketball";
import { LEAGUES } from "@/types/basketball";
import TodaysGames from "@/components/basketball/TodaysGames";
import FixtureCard from "@/components/basketball/FixtureCard";

export const dynamic = "force-dynamic";

async function getAllData() {
  const slugs = LEAGUES.map(l => l.slug);
  const [scoreboards, fixtures] = await Promise.all([
    Promise.allSettled(slugs.map(s => getScoreboard(s))),
    Promise.allSettled(slugs.map(s => getFixtures(s))),
  ]);

  const seenScore = new Set<string>();
  const allToday: (BBGame & { _slug: string })[] = [];
  scoreboards.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    r.value.forEach(g => {
      if (!seenScore.has(g.id)) { seenScore.add(g.id); allToday.push({ ...g, _slug: slugs[i] }); }
    });
  });

  const seenFix = new Set<string>(seenScore); // exclude today from fixtures
  const allResults: (BBFixture & { _slug: string })[] = [];
  const allUpcoming: (BBFixture & { _slug: string })[] = [];
  fixtures.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    r.value.results.forEach(f => {
      if (!seenFix.has(f.id)) { seenFix.add(f.id); allResults.push({ ...f, _slug: slugs[i] }); }
    });
    r.value.upcoming.forEach(f => {
      if (!seenFix.has(f.id)) { seenFix.add(f.id); allUpcoming.push({ ...f, _slug: slugs[i] }); }
    });
  });

  allResults.sort((a,b) => new Date(b.tipoff ?? 0).getTime() - new Date(a.tipoff ?? 0).getTime());
  allUpcoming.sort((a,b) => new Date(a.tipoff ?? 0).getTime() - new Date(b.tipoff ?? 0).getTime());

  return {
    allToday,
    allResults: allResults.slice(0, 20),
    allUpcoming: allUpcoming.slice(0, 20),
  };
}

export default async function BasketballPage() {
  const { allToday, allResults, allUpcoming } = await getAllData();

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Basketball</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Live scores, results &amp; upcoming games</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/basketball/news" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>News</Link>
          <Link href="/basketball/standings" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>Standings</Link>
        </div>
      </div>

      {/* Today's games — server-fetched from scoreboard */}
      <section style={{ marginBottom: 40 }}>
        <TodaysGames games={allToday} defaultLeague="nba" />
      </section>

      {/* Recent + Upcoming */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }} className="page-split">

        <section>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0, letterSpacing: "-0.3px" }}>Recent Results</h2>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{allResults.length}</span>
          </div>
          {allResults.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No recent results available.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allResults.map(f => <FixtureCard key={f.id} fixture={f} leagueSlug={f._slug} />)}
            </div>
          )}
        </section>

        <section>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0, letterSpacing: "-0.3px" }}>Upcoming Games</h2>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{allUpcoming.length}</span>
          </div>
          {allUpcoming.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No upcoming games available.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allUpcoming.map(f => <FixtureCard key={f.id} fixture={f} leagueSlug={f._slug} />)}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}