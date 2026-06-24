import Link from "next/link";
import { getStandings } from "@/lib/api/espn";
import { LEAGUES, leagueName } from "@/types/football";
import StandingsTable from "@/components/football/StandingsTable";

export const dynamic = "force-dynamic";
const TABLE_LEAGUES = LEAGUES.filter(l => !["fifa.world","uefa.champions"].includes(l.slug));

interface Props { searchParams: Promise<{ league?: string }> }

export default async function StandingsPage({ searchParams }: Props) {
  const { league = "eng.1" } = await searchParams;
  const rows = await getStandings(league);

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
          <StandingsTable rows={rows} league={league} />
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
        </>
      )}
    </div>
  );
}