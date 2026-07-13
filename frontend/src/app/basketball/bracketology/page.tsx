import Link from "next/link";
import { getBracketology } from "@/lib/api/basketball";
import type { RawJSON } from "@/lib/api/basketball";

export const dynamic = "force-dynamic";

interface Props { searchParams: Promise<{ tournament?: string; year?: string }> }

function parseBracket(data: RawJSON): { regions: { name: string; seeds: { seed: number; team: string; record: string }[] }[] } {
  const regions = data?.regions ?? data?.bracket?.regions ?? [];
  if (!Array.isArray(regions)) return { regions: [] };

  return {
    regions: regions.map((r: RawJSON) => ({
      name: r.name ?? r.label ?? "Region",
      seeds: (r.seeds ?? r.teams ?? []).map((s: RawJSON) => ({
        seed: s.seedOrder ?? s.seed ?? s.curatedOrder ?? 0,
        team: s.team?.displayName ?? s.team?.name ?? s.displayName ?? "–",
        record: s.team?.record ?? s.record ?? "",
      })),
    })),
  };
}

export default async function BracketologyPage({ searchParams }: Props) {
  const { tournament = "22", year = String(new Date().getFullYear()) } = await searchParams;
  const data = await getBracketology(tournament, year);
  const { regions } = data ? parseBracket(data) : { regions: [] };

  const tourLabel = tournament === "23" ? "Women's" : "Men's";

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Bracketology</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{tourLabel} NCAA Tournament Projections · {year}</p>
        </div>
        <Link href="/basketball" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>← Basketball</Link>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <Link href={`/basketball/bracketology?tournament=22&year=${year}`} className={`pill${tournament === "22" ? " active" : ""}`} style={{ textDecoration: "none" }}>Men&apos;s</Link>
        <Link href={`/basketball/bracketology?tournament=23&year=${year}`} className={`pill${tournament === "23" ? " active" : ""}`} style={{ textDecoration: "none" }}>Women&apos;s</Link>
      </div>

      {regions.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>
          No bracketology data available. Projections are typically published during the NCAA basketball season.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {regions.map((region, ri) => (
            <div key={ri} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontSize: 14, fontWeight: 800, color: "var(--obsidian)", letterSpacing: "-0.3px" }}>
                {region.name}
              </div>
              {region.seeds.sort((a, b) => a.seed - b.seed).map((s, si) => (
                <div key={si} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: si < region.seeds.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: s.seed <= 4 ? "#EA580C" : "var(--text-muted)", minWidth: 20, textAlign: "center" }}>{s.seed}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.team}</span>
                  {s.record && <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{s.record}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}