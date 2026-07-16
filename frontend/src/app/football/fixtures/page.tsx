import Link from "next/link";
import { notFound } from "next/navigation";
import { getFixtures } from "@/lib/api/espn";
import { LEAGUES, leagueName } from "@/types/football";
import FixtureCard from "@/components/football/FixtureCard";

export const dynamic = "force-dynamic";

interface Props { searchParams: Promise<{ league?: string }> }

export default async function FixturesPage({ searchParams }: Props) {
  const { league = "eng.1" } = await searchParams;
  const info = LEAGUES.find(l => l.slug === league);
  if (!info) return notFound();

  const { results, upcoming } = await getFixtures(league);

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
            {leagueName(league)} Fixtures
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>All results &amp; upcoming matches</p>
        </div>
        <Link href={`/football/league/${league}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>
          ← League home
        </Link>
      </div>

      {/* League tabs so it's easy to switch */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
        {LEAGUES.map(l => (
          <Link
            key={l.slug}
            href={`/football/fixtures?league=${l.slug}`}
            className={`pill${league === l.slug ? " active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            {l.short}
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }} className="page-split">
        <section>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>Results</h2>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{results.length}</span>
          </div>
          {results.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No results in the recent window.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {results.map(f => <FixtureCard key={f.id} fixture={f} leagueSlug={league} />)}
            </div>
          )}
        </section>
        <section>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>Upcoming</h2>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{upcoming.length}</span>
          </div>
          {upcoming.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No upcoming fixtures in the next window.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcoming.map(f => <FixtureCard key={f.id} fixture={f} leagueSlug={league} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}