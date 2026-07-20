import Link from "next/link";

export default function ComingSoonPage() {
  // ============================================================================
  // ADDRESSED: Placeholder route shipped as production page
  // ----------------------------------------------------------------------------
  // /f1 is a public route but only shows a generic coming-soon shell. If the sport
  // is not launched, hide or redirect it; otherwise load real F1 coverage data.
  //
  // EXAMPLE:
  //   redirect("/football");
  //   // or: const races = await getF1Schedule(); return <F1Home races={races} />;
  // ============================================================================
  return (
    <div style={{ maxWidth: 520, margin: "80px auto", padding: "0 var(--gap)", textAlign: "center" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 16,
        background: "var(--navy-light)", color: "var(--navy)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 28px",
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4l3 3" />
        </svg>
      </div>
      <h1 style={{ fontSize: "clamp(24px,5vw,34px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 12px", letterSpacing: "-0.5px" }}>
        Coming Soon
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.65, margin: "0 0 36px" }}>
        We&apos;re building full real-time coverage for f1. Football is live now, more sports dropping soon.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/football" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "var(--navy)", color: "#fff",
          fontWeight: 600, fontSize: 14, padding: "11px 22px",
          borderRadius: 10, textDecoration: "none",
        }}>View Live Football</Link>
        <Link href="/" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "var(--cloud)", color: "var(--obsidian)",
          fontWeight: 600, fontSize: 14, padding: "11px 22px",
          borderRadius: 10, textDecoration: "none", border: "1px solid var(--border)",
        }}>Home</Link>
      </div>
    </div>
  );
}
