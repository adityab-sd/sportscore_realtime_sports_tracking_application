import Link from "next/link";

const columns = [
  // ============================================================================
  // ADDRESSED: avoid hard-coded footer routes
  // ----------------------------------------------------------------------------
  // Footer links are maintained separately from the Navbar/SportCards configs, so
  // unavailable sports or renamed routes can drift and produce dead navigation.
  // Generate this from the same sport registry used by the primary navigation.
  //
  // EXAMPLE:
  //   const columns = buildFooterColumns(SPORTS_NAV.filter((sport) => sport.enabled));
  // ============================================================================
  {
    title: "Sports",
    links: [
      { label: "Football", href: "/football" },
      { label: "Cricket", href: "/cricket" },
      { label: "Rugby", href: "/rugby" },
      { label: "Formula 1", href: "/f1" },
    ],
  },
  {
    title: "Football",
    links: [
      { label: "Live Scores", href: "/football" },
      { label: "Standings", href: "/football/standings" },
      { label: "News", href: "/football/news" },
      { label: "World Cup", href: "/football" },
    ],
  },
  {
    title: "Features",
    links: [
      { label: "Radio Mode", href: "/football" },
      { label: "Knowledge Assistant", href: "/football" },
      { label: "Live Updates", href: "/football" },
      { label: "Accessibility", href: "/" },
    ],
  },

{
    title: "Security",
    links: [
      { label: "Security & Privacy", href: "/security" },
    ],
  },
]

const legal = ["Terms of Use", "Privacy Policy", "Cookie Policy", "Accessibility Statement"];

export default function Footer() {
  return (
    <footer style={{ background: "var(--navy)", color: "#fff" }}>
      <div className="container" style={{ paddingTop: 48, paddingBottom: 32 }}>
        <div className="footer-cols">
          {/* Brand column */}
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 12 }}>
              Sport<span style={{ color: "var(--color-accent)" }}>Score</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, margin: "0 0 20px", maxWidth: 280 }}>
              Real-time, cross-sport intelligence built for everyone - live scores, AI commentary, and instant answers.
            </p>
            <Link href="/football" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 13,
              padding: "9px 18px", borderRadius: 8, textDecoration: "none",
            }}>
              View Live Scores
            </Link>
          </div>

          {/* Link columns */}
          {columns.map(col => (
            <div key={col.title}>
              <h4 style={{
                fontSize: 12, fontWeight: 700, color: "#fff",
                textTransform: "uppercase", letterSpacing: "0.8px",
                margin: "0 0 16px", paddingBottom: 10,
                borderBottom: "1px solid rgba(255,255,255,0.12)",
              }}>{col.title}</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 11 }}>
                {col.links.map(l => (
                  <li key={l.label}>
                    <Link href={l.href} className="hl" style={{
                      fontSize: 13.5, color: "rgba(255,255,255,0.7)", textDecoration: "none",
                      transition: "color 120ms",
                    }}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Legal bar */}
      {/* <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="container" style={{
          paddingTop: 20, paddingBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {legal.map(item => (
              <span key={item} className="hl" style={{
                fontSize: 12, color: "rgba(255,255,255,0.6)", cursor: "pointer", transition: "color 120ms",
              }}>{item}</span>
            ))}
          </div>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            ©️ 2026 SportScore · Built for COMP47250
          </span>
        </div>
      </div> */}
    </footer>
  );
}