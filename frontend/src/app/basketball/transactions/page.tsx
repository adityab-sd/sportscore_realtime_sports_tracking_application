import Link from "next/link";
import { getTransactions } from "@/lib/api/basketball";
import { LEAGUES, leagueName } from "@/types/basketball";

export const dynamic = "force-dynamic";
interface Props { searchParams: Promise<{ league?: string }> }

export default async function TransactionsPage({ searchParams }: Props) {
  const { league = "nba" } = await searchParams;
  const transactions = await getTransactions(league, 80);
  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>
      <Link href={`/basketball?league=${league}`} style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", display: "inline-block", marginBottom: 20 }}>← {leagueName(league)}</Link>
      <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 8px", letterSpacing: "-0.5px" }}>Transactions</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px" }}>{leagueName(league)}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {LEAGUES.map(l => <Link key={l.slug} href={`/basketball/transactions?league=${l.slug}`} className="pill" style={{ textDecoration: "none", fontWeight: l.slug === league ? 700 : 400, opacity: l.slug === league ? 1 : 0.7 }}>{l.short}</Link>)}
      </div>
      {transactions.length > 0 ? (
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {transactions.map((tx, i) => {
            const t = tx.date ? Date.parse(tx.date) : NaN;
            const dateStr = Number.isFinite(t) ? new Date(t).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }) : "";
            return (
              <div key={tx.id ?? i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < transactions.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 60, flexShrink: 0 }} suppressHydrationWarning>{dateStr}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {tx.team && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)" }}>{tx.team}</div>}
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.3 }}>{tx.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: 40 }}>No transactions available for {leagueName(league)}.</p>}
    </div>
  );
}
