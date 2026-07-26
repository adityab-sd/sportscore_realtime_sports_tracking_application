import Link from "next/link";
import { getLeagueInjuries } from "@/lib/api/baseball";
import { LEAGUES, leagueName } from "@/types/baseball";
import InjuryList from "@/components/baseball/InjuryList";

export const dynamic = "force-dynamic";
interface Props { searchParams: Promise<{ league?: string }> }

export default async function InjuriesPage({ searchParams }: Props) {
  const { league = "mlb" } = await searchParams;
  const injuries = await getLeagueInjuries(league);

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>
      <Link href={`/baseball?league=${league}`} style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", display: "inline-block", marginBottom: 20 }}>
        ← {leagueName(league)}
      </Link>

      <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 8px", letterSpacing: "-0.5px" }}>
        Injury Report
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px" }}>{leagueName(league)}</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {LEAGUES.map(l => (
          <Link key={l.slug} href={`/baseball/injuries?league=${l.slug}`} className="pill" style={{ textDecoration: "none", fontWeight: l.slug === league ? 700 : 400, opacity: l.slug === league ? 1 : 0.7 }}>
            {l.short}
          </Link>
        ))}
      </div>

      {injuries.length > 0 ? (
        <InjuryList injuries={injuries} />
      ) : (
        <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: 40 }}>
          No injuries reported for {leagueName(league)}.
        </p>
      )}
    </div>
  );
}
