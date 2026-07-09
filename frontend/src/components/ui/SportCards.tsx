"use client";
import Link from "next/link";

function FootballIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <path d="M2 12h20" />
    </svg>
  );
}
function BasketballIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93c4.08 2.64 6.43 7.11 6.43 12.15" />
      <path d="M19.07 4.93c-4.08 2.64-6.43 7.11-6.43 12.15" />
      <path d="M2 12h20" />
    </svg>
  );
}
function CricketIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21 L17 7" strokeWidth="2.5" />
      <path d="M17 7 L21 3" />
      <circle cx="3" cy="21" r="2" fill="currentColor" stroke="none" />
      <path d="M9 15 L13 19" />
    </svg>
  );
}
function F1Icon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 15 Q5 11 8 14 Q11 17 14 14 Q17 11 22 13" />
      <circle cx="7" cy="17" r="1.5" />
      <circle cx="17" cy="17" r="1.5" />
      <path d="M9 14 L9 10 L15 10 L17 14" />
      <path d="M11 10 L11 8 L14 8 L14 10" />
    </svg>
  );
}
function BasketballIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2c3 3 3 17 0 20" />
      <path d="M12 2c-3 3-3 17 0 20" />
    </svg>
  );
}

const sports = [
  { key: "football",   label: "Football",   href: "/football",   Icon: FootballIcon,   desc: "Live scores, standings & match stats",     live: true },
  { key: "basketball", label: "Basketball", href: "/basketball", Icon: BasketballIcon, desc: "NBA & WNBA scores, standings & rosters",  live: true },
  { key: "cricket",    label: "Cricket",    href: "/cricket",    Icon: CricketIcon,    desc: "Scorecards, NRR & player profiles",       soon: true },
  { key: "f1",         label: "Formula 1",  href: "/f1",         Icon: F1Icon,         desc: "Lap times, standings & race results",     soon: true },
];

export default function SportCards() {
  return (
    <div className="grid-4">
      {sports.map(({ key, label, href, Icon, desc, ...flags }) => {
        const isLive = "live" in flags && flags.live;
        const isSoon = "soon" in flags && flags.soon;
        return (
          <Link key={key} href={href} style={{ textDecoration: "none" }}>
            <div className="card-hover" style={{
              background: "var(--white)",
              border: `1.5px solid ${isLive ? "var(--navy)" : "var(--border)"}`,
              borderRadius: 14,
              padding: "24px 20px",
              cursor: "pointer",
              position: "relative",
              height: "100%",
            }}>
              {isLive && (
                <div style={{
                  position: "absolute", top: 12, right: 12,
                  display: "flex", alignItems: "center", gap: 4,
                  background: "var(--live-bg)", padding: "2px 7px", borderRadius: 4,
                }}>
                  <span className="live-dot" style={{ width: 5, height: 5 }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: "var(--live-text)", letterSpacing: "0.5px" }}>LIVE</span>
                </div>
              )}
              {isSoon && (
                <span style={{
                  position: "absolute", top: 12, right: 12,
                  background: "var(--cloud)", padding: "2px 8px", borderRadius: 4,
                  fontSize: 9, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.5px",
                }}>SOON</span>
              )}
              <div style={{
                width: 52, height: 52, borderRadius: 12,
                background: isLive ? "var(--navy-light)" : "var(--cloud)",
                color: isLive ? "var(--navy)" : "var(--text-secondary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 14,
              }}>
                <Icon />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--obsidian)", marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{desc}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}