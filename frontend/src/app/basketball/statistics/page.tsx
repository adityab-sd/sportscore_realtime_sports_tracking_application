import Link from "next/link";
import { getStatistics, getLeaders, BBLeader } from "@/lib/api/basketball";
import { LEAGUES, leagueName } from "@/types/basketball";

export const dynamic = "force-dynamic";
interface Props { searchParams: Promise<{ league?: string }> }

function groupBy(arr: BBLeader[], key: keyof BBLeader): [string, BBLeader[]][] {
  const map = new Map<string, BBLeader[]>();
  for (const item of arr) { const k = String(item[key] ?? "Other"); if (!map.has(k)) map.set(k, []); map.get(k)!.push(item); }
  return Array.from(map.entries());
}

export default async function StatisticsPage({ searchParams }: Props) {
  const { league = "nba" } = await searchParams;
  const [statsRaw, leaders] = await Promise.all([getStatistics(league), getLeaders(league)]);
  const categories = (statsRaw?.leaders ?? statsRaw?.categories ?? []) as unknown[];
  const hasCats = Array.isArray(categories) && categories.length > 0;
  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>
      <Link href={`/basketball?league=${league}`} style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", display: "inline-block", marginBottom: 20 }}>← {leagueName(league)}</Link>
      <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 8px", letterSpacing: "-0.5px" }}>Statistics</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px" }}>{leagueName(league)}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {LEAGUES.map(l => <Link key={l.slug} href={`/basketball/statistics?league=${l.slug}`} className="pill" style={{ textDecoration: "none", fontWeight: l.slug === league ? 700 : 400, opacity: l.slug === league ? 1 : 0.7 }}>{l.short}</Link>)}
      </div>
      {leaders.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>League Leaders</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {groupBy(leaders, "category").map(([cat, items]) => (
              <div key={cat} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>{cat}</div>
                {items.slice(0, 10).map((l, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: i < Math.min(items.length, 10) - 1 ? "1px solid var(--border)" : "none" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: l.rank <= 3 ? "#EA580C" : "var(--text-muted)", minWidth: 20 }}>{l.rank}</span>
                    {l.headshot && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.headshot} alt={l.player} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.player}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.team}</div>
                    </div>
                    <span className="stat-num" style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)" }}>{l.displayValue}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
      {hasCats && (
        <section>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>League Statistics</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(categories as any[]).map((cat: any, ci: number) => {
              const catName = cat.displayName ?? cat.name ?? "Stats";
              const entries = cat.leaders ?? cat.athletes ?? [];
              if (!Array.isArray(entries) || entries.length === 0) return null;
              return (
                <div key={cat.name ?? ci} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>{catName}</div>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {entries.slice(0, 10).map((e: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: i < Math.min(entries.length, 10) - 1 ? "1px solid var(--border)" : "none" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", minWidth: 20 }}>{i + 1}</span>
                      {e.athlete?.headshot?.href && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.athlete.headshot.href} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)" }}>{e.athlete?.displayName ?? e.displayName ?? "–"}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.team?.displayName ?? ""}</div>
                      </div>
                      <span className="stat-num" style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)" }}>{e.displayValue ?? e.value ?? "–"}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {!hasCats && leaders.length === 0 && <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: 40 }}>No statistics available for {leagueName(league)}.</p>}
    </div>
  );
}
