import Link from "next/link";

// FIXED: every link below points to a route that actually exists in app/.
//  - removed "Cricket" (no /cricket route → dead link)
//  - added Basketball & Baseball (real sections that were missing)
//  - dropped the "Features" column: Radio Mode / Knowledge Assistant / Live
//    Updates are in-app toggles, not pages, so those links just sent people
//    to /football. They're still described in the brand blurb below.
//  - the three columns are now parallel across all four sports, so every sport
//    has a direct link to its hub, standings, and fixtures.
// Ideally build this from the same sport registry the Navbar uses so routes
// can't drift out of sync again — hardcoded here to keep it self-contained.
const columns = [
  {
    title: "Sports",
    links: [
      { label: "Football", href: "/football" },
      { label: "Basketball", href: "/basketball" },
      { label: "Baseball", href: "/baseball" },
      { label: "Formula 1", href: "/f1" },
    ],
  },
  {
    title: "Standings",
    links: [
      { label: "Football", href: "/football/standings" },
      { label: "Basketball", href: "/basketball/standings" },
      { label: "Baseball", href: "/baseball/standings" },
      { label: "Formula 1", href: "/f1/standings" },
    ],
  },
  {
    title: "Fixtures & Schedule",
    links: [
      { label: "Football", href: "/football/fixtures" },
      { label: "Basketball", href: "/basketball/fixtures" },
      { label: "Baseball", href: "/baseball/fixtures" },
      { label: "Formula 1", href: "/f1/schedule" }, // F1 uses /schedule, not /fixtures
    ],
  },

{
    title: "Security",
    links: [
      { label: "Security & Privacy", href: "/security" },
    ],
  },
]

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

      {/* Bottom bar — copyright only; dropped the placeholder legal links
          (Terms / Privacy / Cookie / Accessibility) since those pages don't exist. */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="container" style={{
          paddingTop: 20, paddingBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
            © 2026 SportScore
          </span>
        </div>
      </div>
    </footer>
  );
}