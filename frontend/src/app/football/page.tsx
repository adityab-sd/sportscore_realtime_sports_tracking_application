import Link from "next/link";
import { getFixtures } from "@/lib/api/espn";
import { LEAGUES } from "@/types/football";
import LiveFootball from "@/components/football/LiveFootball";
import FixtureCard from "@/components/football/FixtureCard";

export const dynamic = "force-dynamic";

// Fetch results + upcoming across all leagues in parallel
async function getAllFixtures() {
  const slugs = LEAGUES.map(l => l.slug);
  const results = await Promise.allSettled(slugs.map(s => getFixtures(s)));
  const seen = new Set<string>();
  let allResults: any[] = [];
  let allUpcoming: any[] = [];

  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const slug = slugs[i];
    r.value.results.forEach(f => {
      if (!seen.has(f.id)) { seen.add(f.id); allResults.push({ ...f, _slug: slug }); }
    });
    r.value.upcoming.forEach(f => {
      if (!seen.has(f.id)) { seen.add(f.id); allUpcoming.push({ ...f, _slug: slug }); }
    });
  });

  // Sort: results newest first, upcoming earliest first
  allResults.sort((a,b) => new Date(b.kickoff ?? 0).getTime() - new Date(a.kickoff ?? 0).getTime());
  allUpcoming.sort((a,b) => new Date(a.kickoff ?? 0).getTime() - new Date(b.kickoff ?? 0).getTime());
  return { allResults: allResults.slice(0, 20), allUpcoming: allUpcoming.slice(0, 20) };
}

export default async function FootballPage() {
  const { allResults, allUpcoming } = await getAllFixtures();

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Football</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Live scores, results &amp; upcoming fixtures</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/football/news" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>News</Link>
          <Link href="/football/standings" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>Standings</Link>
        </div>
      </div>

      {/* Live - from SignalR */}
      <section style={{ marginBottom: 40 }}>
        <LiveFootball />
      </section>

      {/* Two column: Results + Upcoming */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }} className="page-split">

        {/* Recent Results */}
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

        {/* Upcoming Fixtures */}
        <section>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0, letterSpacing: "-0.3px" }}>Upcoming Fixtures</h2>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{allUpcoming.length}</span>
          </div>
          {allUpcoming.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No upcoming fixtures available.</p>
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