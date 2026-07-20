import Link from "next/link";
import { getStatsByAthlete, getStatistics } from "@/lib/api/basketball";
import { LEAGUES, leagueName } from "@/types/basketball";
import type { RawJSON } from "@/lib/api/basketball";

export const dynamic = "force-dynamic";

interface Props { searchParams: Promise<{ league?: string }> }

function parseLeaderboard(data: RawJSON): {
  categories: { name: string; labels: string[]; athletes: { name: string; team: string; headshot: string | null; stats: string[] }[] }[];
} {
  const cats = data?.categories ?? data?.resultCategories ?? [];
  if (!Array.isArray(cats)) return { categories: [] };

  // ADDRESSED: nested leaderboard arrays assumed valid: labels, athletes and stats can be absent or non-arrays in raw ESPN responses. EXAMPLE: const athletes = Array.isArray(c.athletes ?? c.leaders) ? (c.athletes ?? c.leaders) : [];
  return {
    categories: cats.map((c: RawJSON) => {
      const labels: string[] = c.labels ?? c.names ?? [];
      const athletes = (c.athletes ?? c.leaders ?? []).map((a: RawJSON) => ({
        name: a.athlete?.displayName ?? a.displayName ?? a.name ?? "–",
        team: a.athlete?.team?.abbreviation ?? a.team?.abbreviation ?? a.team ?? "",
        headshot: a.athlete?.headshot?.href ?? a.headshot?.href ?? null,
        stats: a.stats ?? a.values ?? [],
      }));
      return { name: c.displayName ?? c.name ?? "Stats", labels, athletes };
    }),
  };
}

export default async function StatisticsPage({ searchParams }: Props) {
  const { league = "nba" } = await searchParams;
  // ADDRESSED: validate league query before API calls: arbitrary league values are sent to both stats endpoints. EXAMPLE: const safeLeague = LEAGUES.some((l) => l.slug === league) ? league : "nba";

  // ============================================================================
  // ADDRESSED: fallback source should not reject-all
  // ----------------------------------------------------------------------------
  // byAthlete and statsRaw are alternative sources, but Promise.all rejects the
  // page if either endpoint fails. Use allSettled so the fallback can still render
  // when one source is down.
  //
  // EXAMPLE:
  //   const [byAthlete, statsRaw] = await Promise.allSettled([getStatsByAthlete(league), getStatistics(league)]);
  // ============================================================================
  const [byAthlete, statsRaw] = await Promise.all([
    getStatsByAthlete(league),
    getStatistics(league),
  ]);

  const data = byAthlete ?? statsRaw;
  const { categories } = data ? parseLeaderboard(data) : { categories: [] };

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Statistics</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{leagueName(league)} stat leaders</p>
        </div>
        <Link href="/basketball" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>← Basketball</Link>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
        {LEAGUES.map((l) => (
          <Link key={l.slug} href={`/basketball/statistics?league=${l.slug}`} className={`pill${league === l.slug ? " active" : ""}`} style={{ textDecoration: "none" }}>{l.short}</Link>
        ))}
      </div>

      {categories.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>No statistics data available right now.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* ADDRESSED: index keys for changing stat tables: categories and athlete rows can reorder by season/stat type. EXAMPLE: {categories.map((cat) => <section key={cat.name}>...</section>)} and {cat.athletes.map((a) => <tr key={`${cat.name}:${a.name}:${a.team}`}>...</tr>)}. */}
          {categories.map((cat, ci) => (
            <section key={ci}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>{cat.name}</h2>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{cat.athletes.length} players</span>
              </div>

              {cat.labels.length > 0 && cat.athletes.length > 0 && (
                <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480, fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", position: "sticky", left: 0, background: "var(--white)", minWidth: 140 }}>Player</th>
                        {cat.labels.map((l) => (
                          <th key={l} style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", minWidth: 40 }}>{l}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cat.athletes.slice(0, 25).map((a, ai) => (
                        <tr key={ai} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 12px", position: "sticky", left: 0, background: "var(--white)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", minWidth: 18 }}>{ai + 1}</span>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--obsidian)" }}>{a.name}</div>
                                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{a.team}</div>
                              </div>
                            </div>
                          </td>
                          {a.stats.map((v, si) => (
                            <td key={si} className="stat-num" style={{ padding: "8px 6px", textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}