import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ maxWidth: 520, margin: "80px auto", padding: "0 var(--gap)", textAlign: "center" }}>
      <div className="score-num" style={{
        fontSize: "clamp(80px,20vw,140px)", fontWeight: 800,
        color: "var(--navy-light)", lineHeight: 1, marginBottom: 8,
        letterSpacing: "-4px", userSelect: "none",
      }}>404</div>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: "var(--navy-light)", color: "var(--navy)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 24px",
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          <path d="M2 12h20" />
        </svg>
      </div>
      <h1 style={{ fontSize: "clamp(20px,4vw,26px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 12px", letterSpacing: "-0.3px" }}>
        That page went offside
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.65, margin: "0 0 36px" }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "var(--navy)", color: "#fff",
          fontWeight: 600, fontSize: 14, padding: "11px 24px",
          borderRadius: 10, textDecoration: "none",
        }}>Back to Home</Link>
        <Link href="/football" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "var(--cloud)", color: "var(--obsidian)",
          fontWeight: 600, fontSize: 14, padding: "11px 24px",
          borderRadius: 10, textDecoration: "none", border: "1px solid var(--border)",
        }}>Live Scores</Link>
      </div>
    </div>
  );
}
