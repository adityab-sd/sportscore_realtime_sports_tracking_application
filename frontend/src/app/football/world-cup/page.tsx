import Link from "next/link";
import WorldCupBracket from "@/components/football/WorldCupBracket";

export default function WorldCupPage() {
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