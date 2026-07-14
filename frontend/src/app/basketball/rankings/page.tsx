import Link from "next/link";
import { getRankings } from "@/lib/api/basketball";
import type { RawJSON } from "@/lib/api/basketball";

export const dynamic = "force-dynamic";

interface Props { searchParams: Promise<{ league?: string }> }

function parseRankings(data: RawJSON): { polls: { name: string; ranks: { rank: number; team: string; shortName: string; logo: string | null; record: string; points: number; trend: string }[] }[] } {
  const rankings = data?.rankings ?? data?.polls ?? [];
  if (!Array.isArray(rankings)) return { polls: [] };

  // PLEASE review — rank arrays assumed valid: (poll.ranks ?? poll.entries ?? []) can be a non-array response shape, so .map may throw. EXAMPLE: const entries = Array.isArray(poll.ranks ?? poll.entries) ? (poll.ranks ?? poll.entries) : [];
  return {
    polls: rankings.map((poll: RawJSON) => ({
      name: poll.name ?? poll.headline ?? "Rankings",
      ranks: (poll.ranks ?? poll.entries ?? []).map((r: RawJSON) => ({
        rank: r.current ?? r.rank ?? 0,
        team: r.team?.displayName ?? r.team?.name ?? r.displayName ?? "–",
        shortName: r.team?.abbreviation ?? r.team?.shortDisplayName ?? "",
        logo: r.team?.logos?.[0]?.href ?? r.team?.logo ?? null,
        record: r.recordSummary ?? r.record ?? "",
        points: r.points ?? 0,
        trend: r.previous && r.current ? (r.current < r.previous ? "up" : r.current > r.previous ? "down" : "same") : "same",
      })),
    })),
  };
}

export default async function RankingsPage({ searchParams }: Props) {
  const { league = "mens-college-basketball" } = await searchParams;
  // PLEASE review — validate league query before fetching: any string is accepted, but the UI only offers men's/women's CBB. EXAMPLE: const safeLeague = league === "womens-college-basketball" ? league : "mens-college-basketball";
  const data = await getRankings(league);
  const { polls } = data ? parseRankings(data) : { polls: [] };

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Rankings</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>NCAA Basketball poll rankings</p>
        </div>
        <Link href="/basketball" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>← Basketball</Link>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
        <Link href="/basketball/rankings?league=mens-college-basketball" className={`pill${league === "mens-college-basketball" ? " active" : ""}`} style={{ textDecoration: "none" }}>Men&apos;s CBB</Link>
        <Link href="/basketball/rankings?league=womens-college-basketball" className={`pill${league === "womens-college-basketball" ? " active" : ""}`} style={{ textDecoration: "none" }}>Women&apos;s CBB</Link>
      </div>

      {polls.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>No rankings data available. Rankings are typically updated during the college basketball season.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* PLEASE review — index keys for polls/ranks: ranking lists reorder weekly, so key={pi}/key={ri} can preserve the wrong row. EXAMPLE: {polls.map((poll) => <section key={poll.name}>...</section>)} and {poll.ranks.map((r) => <div key={`${poll.name}:${r.rank}:${r.team}`}>...</div>)}. */}
          {polls.map((poll, pi) => (
            <section key={pi}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>{poll.name}</h2>
              </div>
              <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px 60px", padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                  <span>#</span><span>Team</span><span style={{ textAlign: "center" }}>Record</span><span style={{ textAlign: "center" }}>Pts</span>
                </div>
                {poll.ranks.map((r, ri) => (
                  <div key={ri} style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px 60px", padding: "10px 16px", borderBottom: ri < poll.ranks.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: r.rank <= 4 ? "#EA580C" : "var(--text-muted)" }}>{r.rank}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)" }}>{r.team}</span>
                    <span className="stat-num" style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>{r.record || "–"}</span>
                    {/* PLEASE review — zero points display as missing: || treats legitimate 0 as "–". EXAMPLE: {r.points != null ? r.points : "–"}. */}
                    <span className="stat-num" style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>{r.points || "–"}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}