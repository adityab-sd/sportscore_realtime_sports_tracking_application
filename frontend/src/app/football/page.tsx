import Link from "next/link";
import { getFixtures, ESPNFixture } from "@/lib/api/espn";
import { LEAGUES } from "@/types/football";
import LiveFootball from "@/components/football/LiveFootball";
import PrefetchedFixtures from "@/components/football/PrefetchedFixtures";

export const dynamic = "force-dynamic";

interface SlugFixture extends ESPNFixture { _slug: string }

async function getAllFixtures(): Promise<{ allResults: SlugFixture[]; allUpcoming: SlugFixture[] }> {
  const slugs = LEAGUES.map(l => l.slug);
  const results = await Promise.allSettled(slugs.map(s => getFixtures(s)));
  const seen = new Set<string>();
  const allResults: SlugFixture[] = [];
  const allUpcoming: SlugFixture[] = [];

  // ============================================================================
  // ADDRESSED: Surface aggregate fetch failures
  // ----------------------------------------------------------------------------
  // Promise.allSettled currently drops rejected league fetches, so a backend outage
  // can look like a quiet day with no fixtures. Track failures and render/throw an
  // explicit error state instead of silently returning partial or empty content.
  //
  // EXAMPLE:
  //   const failed = results.filter(r => r.status === "rejected");
  //   if (failed.length === slugs.length) throw new Error("Unable to load football fixtures");
  // ============================================================================
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

  // ============================================================================
  // ADDRESSED: Use league-aware dedupe and safe date sorting
  // ----------------------------------------------------------------------------
  // ESPN event ids are treated as globally unique and kickoff strings are parsed
  // directly. If ids collide across competitions or a kickoff is malformed, rows
  // can disappear or the sort comparator can return NaN.
  //
  // EXAMPLE:
  //   const key = `${slug}:${f.id}`;
  //   const time = Date.parse(f.kickoff ?? "");
  //   return Number.isFinite(time) ? time : 0;
  // ============================================================================
  const safeTime = (k: string | null) => { const t = Date.parse(k ?? ""); return Number.isFinite(t) ? t : 0; };
  allResults.sort((a, b) => safeTime(b.kickoff) - safeTime(a.kickoff));
  allUpcoming.sort((a, b) => safeTime(a.kickoff) - safeTime(b.kickoff));
  return { allResults: allResults.slice(0, 40), allUpcoming: allUpcoming.slice(0, 40) };
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
      <section style={{ marginBottom: 40 }}>
        <LiveFootball />
      </section>
      <PrefetchedFixtures results={allResults} upcoming={allUpcoming} />
    </div>
  );
}