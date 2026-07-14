import Link from "next/link";
import { getStandings, ESPNStandingRow } from "@/lib/api/espn";
import { LEAGUES, leagueName } from "@/types/football";
import StandingsTable from "@/components/football/StandingsTable";

export const dynamic = "force-dynamic";


const TABLE_LEAGUES = LEAGUES;

interface Props { searchParams: Promise<{ league?: string }> }

function groupRows(rows: ESPNStandingRow[]): { group: string | null; rows: ESPNStandingRow[] }[] {
  const hasGroups = rows.some(r => r.group);
  if (!hasGroups) return [{ group: null, rows }];
  const buckets = new Map<string, ESPNStandingRow[]>();
  for (const r of rows) {
    const key = r.group ?? "Other";
    const arr = buckets.get(key) ?? [];
    arr.push(r);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries()).map(([group, rows]) => ({ group, rows }));
}

export default async function StandingsPage({ searchParams }: Props) {
  const { league = "eng.1" } = await searchParams;

  // ============================================================================
  // PLEASE review — Validate standings league
  // ----------------------------------------------------------------------------
  // Unlike the fixtures page, this accepts any league query and sends it to the API.
  // Unknown public URLs should not masquerade as an empty standings table.
  //
  // EXAMPLE:
  //   if (!TABLE_LEAGUES.some(l => l.slug === league)) return notFound();
  // ============================================================================
  const rows = await getStandings(league);
  const groups = groupRows(rows);
  const isMultiGroup = groups.length > 1;

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Standings</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{leagueName(league)}</p>
        </div>
        <Link href="/football" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>← Football</Link>
      </div>

      {/* League tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
        {TABLE_LEAGUES.map(l => (
          <Link
            key={l.slug}
            href={`/football/standings?league=${l.slug}`}
            className={`pill${league === l.slug ? " active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            {l.short}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>
          No standings data available right now.
        </p>
      ) : (
        <>
          {isMultiGroup ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 18 }}>
              {groups.map(g => (
                <div key={g.group}>
                  <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)", margin: "0 0 8px", letterSpacing: "-0.2px" }}>
                    {g.group}
                  </h2>
                  <StandingsTable rows={g.rows} league={league} />
                </div>
              ))}
            </div>
          ) : (
            <StandingsTable rows={groups[0].rows} league={league} />
          )}

          {!isMultiGroup && (
            <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
              {[
                { label: "Champions League", color: "#003f88" },
                { label: "Europa League",    color: "#f97316" },
                { label: "Relegation",       color: "#dc2626" },
              ].map(n => (
                <div key={n.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
                  <div style={{ width: 3, height: 12, borderRadius: 2, background: n.color }} />
                  {n.label}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}