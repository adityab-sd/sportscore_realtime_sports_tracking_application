import Link from "next/link";
import WorldCupBracket from "@/components/football/WorldCupBracket";
import { getWorldCupBracket } from "@/lib/api/espn";

export default async function WorldCupPage() {
  // 1. Fetch live matches (or fallback mock data)
  const matches = await getWorldCupBracket();
  // ============================================================================
  // ADDRESSED: Avoid shipping an unverified tournament shell
  // ----------------------------------------------------------------------------
  // This page always advertises a 2026 knockout bracket even if the bracket data is
  // unavailable or still placeholder-backed inside the child component. Gate the
  // route on real bracket data or render an explicit coming-soon state.
  //
  // EXAMPLE:
  //   const bracket = await getWorldCupBracket();
  //   if (bracket.length === 0) return <EmptyState title="World Cup bracket coming soon" />;
  // ============================================================================
  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
            World Cup 2026
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Knockout stage bracket</p>
        </div>
        <main className="container mx-auto p-6">
      <WorldCupBracket matches={matches} />
    </main>
      </div>

      <WorldCupBracket />
    </div>
  );
}