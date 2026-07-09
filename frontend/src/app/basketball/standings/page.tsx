import Link from "next/link";
import { getStandings, BBStandingRow } from "@/lib/api/basketball";
import { LEAGUES, leagueName } from "@/types/basketball";
import StandingsTable from "@/components/basketball/StandingsTable";

export const dynamic = "force-dynamic";

interface Props { searchParams: Promise<{ league?: string }> }

// Group standings by conference (Eastern/Western for NBA; single group for WNBA if not divided)
function groupByConference(rows: BBStandingRow[]): { name: string; rows: BBStandingRow[] }[] {
  const buckets = new Map<string, BBStandingRow[]>();
  for (const r of rows) {
    const key = r.conference || "League";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r);
  }
  return Array.from(buckets.entries())
    .map(([name, rs]) => ({ name, rows: rs.sort((a,b) => a.rank - b.rank) }));
}

export default async function StandingsPage({ searchParams }: Props) {
  const { league = "nba" } = await searchParams;
  const rows = await getStandings(league);
  const groups = groupByConference(rows);

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Standings</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{leagueName(league)}</p>
        </div>
        <Link href="/basketball" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>← Basketball</Link>
      </div>

      {/* League tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
        {LEAGUES.map(l => (
          <Link key={l.slug} href={`/basketball/standings?league=${l.slug}`}
            className={`pill${league === l.slug ? " active" : ""}`} style={{ textDecoration: "none" }}>
            {l.short}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>
          No standings data available right now.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {groups.map(g => (
            <section key={g.name}>
              {groups.length > 1 && (
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0, letterSpacing: "-0.3px" }}>
                    {g.name}
                  </h2>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{g.rows.length} teams</span>
                </div>
              )}
              <StandingsTable rows={g.rows} league={league} />
            </section>
          ))}
          <div style={{ display: "flex", gap: 16, marginTop: 4, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
              <div style={{ width: 3, height: 12, borderRadius: 2, background: "#EA580C" }} />
              Playoff position
            </div>
          </div>
        </div>
      )}
    </div>
  );
}