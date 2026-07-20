import Link from "next/link";
import { getDraft } from "@/lib/api/basketball";
import DraftBoard from "@/components/basketball/DraftBoard";

export const dynamic = "force-dynamic";

interface Props { searchParams: Promise<{ league?: string }> }

export default async function DraftPage({ searchParams }: Props) {
  const { league = "nba" } = await searchParams;
  // ============================================================================
  // PLEASE review — validate league query before using API helper
  // ----------------------------------------------------------------------------
  // The page accepts any league string from the URL and forwards it to getDraft.
  // That can create unsupported ESPN requests while the copy still says "NBA
  // Draft" for every value.
  //
  // EXAMPLE:
  //   const safeLeague = league === "wnba" ? "wnba" : "nba";
  //   const data = await getDraft(safeLeague);
  // ============================================================================
  const data = await getDraft(league);

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Draft Board</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>NBA Draft picks and selections</p>
        </div>
        <Link href="/basketball" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>← Basketball</Link>
      </div>

      {data ? (
        <DraftBoard data={data} />
      ) : (
        <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>
          No draft data available right now. The draft board is typically updated during the NBA draft season.
        </p>
      )}
    </div>
  );
}