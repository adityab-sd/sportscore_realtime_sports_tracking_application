import Link from "next/link";
import { getPowerIndex, getPowerIndexLeaders } from "@/lib/api/basketball";
import type { RawJSON } from "@/lib/api/basketball";

export const dynamic = "force-dynamic";

interface Props { searchParams: Promise<{ year?: string }> }

interface BPITeam {
  rank: number;
  team: string;
  shortName: string;
  bpi: number;
  offRating: number;
  defRating: number;
  record: string;
}

function parsePowerIndex(data: RawJSON, leadersData: RawJSON | null): BPITeam[] {
  const items = data?.items ?? data?.teams ?? data?.entries ?? [];
  if (!Array.isArray(items)) return [];

  // ============================================================================
  // PLEASE review — leaders fallback is unreachable when items is empty
  // ----------------------------------------------------------------------------
  // Returning items.map(...) exits before the "If main data empty, try leaders"
  // block. Empty primary BPI data will never use the secondary leaders response.
  //
  // EXAMPLE:
  //   if (items.length > 0) return items.map(...);
  //   if (leadersData) return parseLeaders(leadersData);
  // ============================================================================
  return items.map((item: RawJSON, i: number) => {
    const team = item?.team ?? {};
    const stats = item?.statistics ?? item?.stats ?? {};

    return {
      rank: item.rank ?? i + 1,
      team: team.displayName ?? team.name ?? item.displayName ?? "–",
      shortName: team.abbreviation ?? team.shortDisplayName ?? "",
      bpi: stats.bpiRating ?? stats.bpi ?? item.value ?? 0,
      offRating: stats.offensiveRating ?? stats.offRating ?? 0,
      defRating: stats.defensiveRating ?? stats.defRating ?? 0,
      record: team.record ?? item.record ?? "",
    };
  });

  // If main data empty, try leaders
  if (items.length === 0 && leadersData) {
    const leaders = leadersData?.leaders ?? leadersData?.items ?? [];
    if (Array.isArray(leaders)) {
      return leaders.map((l: RawJSON, i: number) => ({
        rank: i + 1,
        team: l.team?.displayName ?? l.displayName ?? "–",
        shortName: l.team?.abbreviation ?? "",
        bpi: l.value ?? 0,
        offRating: 0,
        defRating: 0,
        record: l.team?.record ?? "",
      }));
    }
  }

  return [];
}

export default async function PowerIndexPage({ searchParams }: Props) {
  const { year = String(new Date().getFullYear()) } = await searchParams;
  // PLEASE review — validate year query before fetching: arbitrary strings can be sent to the BPI endpoint. EXAMPLE: const safeYear = /^\d{4}$/.test(year) ? year : String(new Date().getFullYear());

  const [piData, leadersData] = await Promise.all([
    getPowerIndex(year),
    getPowerIndexLeaders(year),
  ]);

  const teams = piData ? parsePowerIndex(piData, leadersData) : [];

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Power Index (BPI)</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Men&apos;s College Basketball · {year}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/basketball/rankings" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>Rankings</Link>
          <Link href="/basketball" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>← Basketball</Link>
        </div>
      </div>

      {teams.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>
          No BPI data available. Power Index ratings are published during the college basketball season.
        </p>
      ) : (
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 64px 64px 64px 80px", padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", gap: 4, minWidth: 480 }}>
            <span>#</span>
            <span>Team</span>
            <span style={{ textAlign: "center" }}>BPI</span>
            <span style={{ textAlign: "center" }}>OFF</span>
            <span style={{ textAlign: "center" }}>DEF</span>
            <span style={{ textAlign: "center" }}>Record</span>
          </div>
          {/* PLEASE review — event handlers in a Server Component: App Router Server Components cannot pass onMouseEnter/onMouseLeave to DOM nodes. EXAMPLE: move this row into a "use client" component, or replace handlers with CSS like .bpi-row:hover { background: var(--cloud); }. */}
          {teams.slice(0, 50).map((t, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 64px 64px 64px 80px",
                padding: "10px 16px",
                borderBottom: i < Math.min(teams.length, 50) - 1 ? "1px solid var(--border)" : "none",
                alignItems: "center",
                gap: 4,
                minWidth: 480,
                transition: "background 100ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cloud)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 12, fontWeight: 800, color: t.rank <= 5 ? "#EA580C" : "var(--text-muted)" }}>{t.rank}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.team}</span>
              <span className="stat-num" style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--obsidian)" }}>{t.bpi ? t.bpi.toFixed(1) : "–"}</span>
              <span className="stat-num" style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>{t.offRating ? t.offRating.toFixed(1) : "–"}</span>
              <span className="stat-num" style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>{t.defRating ? t.defRating.toFixed(1) : "–"}</span>
              <span className="stat-num" style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>{t.record || "–"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}