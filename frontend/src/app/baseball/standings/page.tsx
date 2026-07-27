import Link from "next/link";
import { getStandings, BBStandingRow } from "@/lib/api/baseball";
import { LEAGUES, leagueName } from "@/types/baseball";
import StandingsTable from "@/components/baseball/StandingsTable";

export const dynamic = "force-dynamic";

interface Props { searchParams: Promise<{ league?: string }> }

function groupByDivision(rows: BBStandingRow[]): { division: string | null; rows: BBStandingRow[] }[] {
  const hasDiv = rows.some(r => r.division);
  if (!hasDiv) return [{ division: null, rows }];
  const buckets = new Map<string, BBStandingRow[]>();
  for (const r of rows) {
    const key = r.division ?? "Other";
    const arr = buckets.get(key) ?? [];
    arr.push(r);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries()).map(([division, rows]) => ({ division, rows }));
}

export default async function StandingsPage({ searchParams }: Props) {
  const { league = "mlb" } = await searchParams;
  const rows = await getStandings(league);
  const groups = groupByDivision(rows);
  const isMultiGroup = groups.length > 1;

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Standings</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{leagueName(league)}</p>
        </div>
        <Link href="/baseball" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>← Baseball</Link>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
        {LEAGUES.map(l => (
          <Link key={l.slug} href={`/baseball/standings?league=${l.slug}`} className={`pill${league === l.slug ? " active" : ""}`} style={{ textDecoration: "none" }}>
            {l.short}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>
          No standings data available right now.
        </p>
      ) : isMultiGroup ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 18 }}>
          {groups.map(g => (
            <div key={g.division}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)", margin: "0 0 8px", letterSpacing: "-0.2px" }}>{g.division}</h2>
              <StandingsTable rows={g.rows} league={league} />
            </div>
          ))}
        </div>
      ) : (
        <StandingsTable rows={groups[0].rows} league={league} />
      )}
    </div>
  );
}
