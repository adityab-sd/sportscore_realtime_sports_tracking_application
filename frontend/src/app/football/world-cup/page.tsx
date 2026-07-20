import Link from "next/link";
import WorldCupBracket from "@/components/football/WorldCupBracket";

export default function WorldCupPage() {
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
        <Link href="/football" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>
          ← Football
        </Link>
      </div>

      <WorldCupBracket />
    </div>
  );
}