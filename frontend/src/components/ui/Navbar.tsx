"use client";

import { useState, useRef } from "react";
import { useSignalR } from "@/hooks/useSignalR";
import { classifyStatus, LEAGUES as FOOTBALL_LEAGUES } from "@/types/football";
import { LEAGUES as BASKETBALL_LEAGUES } from "@/types/basketball";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio, Bot, Menu, X, ChevronDown, Newspaper, Home } from "lucide-react";
import AssistantSidebar from "@/components/assistant/AssistantSidebar";
import RadioBar from "@/components/radio/RadioBar";

interface DropdownConfig {
  newsHref: string;
  newsLabel: string;
  sportPath: string;
  leagues: { slug: string; name: string; logo: string }[];
}

const DROPDOWN_CONFIGS: Record<string, DropdownConfig> = {
  football: {
    newsHref: "/football/news",
    newsLabel: "Football News",
    sportPath: "/football",
    leagues: FOOTBALL_LEAGUES.filter(l => l.slug !== "fifa.friendly"),
  },
  basketball: {
    newsHref: "/basketball/news",
    newsLabel: "Basketball News",
    sportPath: "/basketball",
    leagues: BASKETBALL_LEAGUES,
  },
};

const sports = [
  { key: "football",   label: "Football",   href: "/football",   hasDropdown: true,  emoji: "⚽" },
  { key: "basketball", label: "Basketball", href: "/basketball", hasDropdown: true,  emoji: "🏀" },
  { key: "cricket",    label: "Cricket",    href: "/cricket",    hasDropdown: false, emoji: "🏏" },
  { key: "f1",         label: "Formula 1",  href: "/f1",         hasDropdown: false, emoji: "🏎" },
];

function LeagueLogo({ src, name, dark = false }: { src: string; name: string; dark?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div style={{ width: 22, height: 22, borderRadius: 4, flexShrink: 0, background: dark ? "var(--cloud)" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: dark ? "var(--text-muted)" : "rgba(255,255,255,0.5)" }}>
        {name.slice(0, 1)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} width={22} height={22} onError={() => setFailed(true)}
      style={{ width: 22, height: 22, objectFit: "contain", flexShrink: 0 }} />
  );
}

export default function Navbar() {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [radioOpen,     setRadioOpen]     = useState(false);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [openDropdown,  setOpenDropdown]  = useState<string | null>(null);
  const [activePanel,   setActivePanel]   = useState<string>("football");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { matches } = useSignalR();
  const liveCount   = matches.filter(m => classifyStatus(m.status) === "live").length;
  const pathname    = usePathname();
  const activeSport = sports.find(s => pathname.startsWith(s.href))?.key ?? null;

  const handleMouseEnter = (key: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenDropdown(key);
  };
  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => setOpenDropdown(null), 120);
  };

  const closeMenu = () => setMenuOpen(false);

  const panelConfig = DROPDOWN_CONFIGS[activePanel];
  const panelSport  = sports.find(s => s.key === activePanel);

  return (
    <>
      {/* Animations */}
      <style>{`
        @keyframes menuSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes panelFade {
          from { opacity: 0; transform: translateX(10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes menuSheetIn {
          from { opacity: 0; transform: translateY(-12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sport-tab { transition: background 150ms, color 150ms, border-color 150ms; }
        .sport-tab:hover { background: rgba(0,0,0,0.06) !important; }
        .league-row { transition: background 120ms, border-color 120ms; }
        .league-row:hover { background: rgba(0,0,0,0.04) !important; }
        .quick-link { transition: background 120ms; }
        .quick-link:hover { background: rgba(0,0,0,0.06) !important; }
      `}</style>

      <header style={{ background: "var(--navy)", position: "sticky", top: 0, zIndex: 40, boxShadow: "0 1px 0 rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: "var(--container)", margin: "0 auto", padding: "0 var(--gap)", height: 60, display: "flex", alignItems: "center", gap: 8 }}>

          <Link href="/" style={{ fontWeight: 800, fontSize: 20, color: "#fff", textDecoration: "none", letterSpacing: "-0.5px", flexShrink: 0, marginRight: 8 }}>
            Sport<span style={{ color: "var(--color-accent)", fontWeight: 800 }}>Score</span>
          </Link>

          {/* Desktop nav */}
          <nav style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }} className="desktop-only">
            {sports.map(({ key, label, href, hasDropdown }) => {
              const active = activeSport === key;
              const isOpen = openDropdown === key;
              const config = DROPDOWN_CONFIGS[key];

              if (!hasDropdown || !config) {
                return (
                  <Link key={key} href={href} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 8, fontWeight: 500, fontSize: 14, textDecoration: "none", color: active ? "#fff" : "rgba(255,255,255,0.65)", background: active ? "rgba(255,255,255,0.14)" : "transparent", transition: "background 120ms, color 120ms" }}>
                    {label}
                  </Link>
                );
              }

              return (
                <div key={key} style={{ position: "relative" }}
                  onMouseEnter={() => handleMouseEnter(key)}
                  onMouseLeave={handleMouseLeave}
                >
                  <Link href={href} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 8, fontWeight: 500, fontSize: 14, textDecoration: "none", color: active ? "#fff" : "rgba(255,255,255,0.65)", background: (active || isOpen) ? "rgba(255,255,255,0.14)" : "transparent", transition: "background 120ms, color 120ms" }}>
                    {label}
                    {key === "football" && liveCount > 0 && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />}
                    <ChevronDown size={12} style={{ opacity: 0.7, transition: "transform 150ms", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                  </Link>
                  {isOpen && (
                    <div onMouseEnter={() => handleMouseEnter(key)} onMouseLeave={handleMouseLeave}
                      style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, minWidth: 240, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", overflow: "hidden", zIndex: 50, animation: "fadeSlideUp 0.15s ease both" }}>
                      <Link href={config.newsHref} onClick={() => setOpenDropdown(null)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", textDecoration: "none", color: "var(--obsidian)", fontWeight: 600, fontSize: 13, borderBottom: "1px solid var(--border)", background: "var(--cloud)", transition: "background 100ms" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud-hover)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "var(--cloud)")}
                      >
                        <Newspaper size={14} style={{ color: "var(--navy)", flexShrink: 0 }} />
                        {config.newsLabel}
                      </Link>
                      <div style={{ padding: "6px 0" }}>
                        <div style={{ padding: "4px 16px 6px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Leagues</div>
                        {config.leagues.map(l => {
                          const leaguePath = `${config.sportPath}/league/${l.slug}`;
                          const isActive   = pathname === leaguePath;
                          return (
                            <Link key={l.slug} href={leaguePath} onClick={() => setOpenDropdown(null)}
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", textDecoration: "none", color: isActive ? "var(--navy)" : "var(--obsidian)", fontWeight: isActive ? 700 : 500, fontSize: 13, background: isActive ? "var(--navy-light)" : "transparent", transition: "background 100ms" }}
                              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--cloud)"; }}
                              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                            >
                              <LeagueLogo src={l.logo} name={l.name} dark />
                              <span style={{ flex: 1 }}>{l.name}</span>
                              {isActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--navy)", flexShrink: 0 }} />}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div style={{ flex: 1 }} className="mobile-only" />

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {liveCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 600, paddingRight: 4 }} className="desktop-only">
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />
                {liveCount} Live
              </div>
            )}
            <button onClick={() => setRadioOpen(!radioOpen)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: `1px solid ${radioOpen ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)"}`, background: radioOpen ? "rgba(255,255,255,0.14)" : "transparent", color: "rgba(255,255,255,0.85)", fontWeight: 500, fontSize: 13, cursor: "pointer", transition: "all 120ms" }}>
              <Radio size={15} /><span className="desktop-inline">Radio</span>
            </button>
            <button onClick={() => setAssistantOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "var(--navy)", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "opacity 120ms" }}>
              <Bot size={15} /><span className="desktop-inline">Assistant</span>
            </button>
            <button onClick={() => { setMenuOpen(!menuOpen); }}
              style={{ padding: "6px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "rgba(255,255,255,0.85)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              className="mobile-only">
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile full-screen menu ─────────────────────────────────────────── */}
      {menuOpen && (
        <div className="mobile-only" style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex", flexDirection: "column",
          background: "#fff",
          animation: "menuSheetIn 0.22s cubic-bezier(0.16,1,0.3,1) both",
        }}>
          {/* Top bar */}
          <div style={{ height: 56, background: "var(--navy)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0, boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#fff", letterSpacing: "-0.5px" }}>
              Sport<span style={{ color: "var(--color-accent)" }}>Score</span>
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {liveCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#ff9b9b" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff4d4d" }} className="live-dot" />
                  {liveCount} live
                </div>
              )}
              <button onClick={closeMenu}
                style={{ padding: "6px", background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 120ms" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.22)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Two-column body */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* Left sidebar — white with subtle border */}
            <div style={{ width: 90, background: "#f8f9fa", borderRight: "1px solid #e5e7eb", overflowY: "auto", flexShrink: 0 }}>

              {/* Home tab */}
              <Link href="/" onClick={closeMenu}
                className="sport-tab"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: "16px 8px", textDecoration: "none", borderBottom: "1px solid #e5e7eb", color: "#6b7280", background: "transparent" }}>
                <Home size={20} strokeWidth={1.8} />
                <span style={{ fontSize: 10, fontWeight: 600, textAlign: "center" }}>Home</span>
              </Link>

              {/* Sport tabs */}
              {sports.map(({ key, label, emoji }) => {
                const isSelected = activePanel === key;
                return (
                  <button key={key}
                    onClick={() => setActivePanel(key)}
                    className="sport-tab"
                    style={{
                      width: "100%", display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 5, padding: "16px 8px",
                      background: isSelected ? "#fff" : "transparent",
                      border: "none",
                      borderLeft: isSelected ? "3px solid var(--navy)" : "3px solid transparent",
                      borderBottom: "1px solid #e5e7eb",
                      cursor: "pointer",
                      color: isSelected ? "var(--navy)" : "#6b7280",
                      fontFamily: "inherit",
                    }}>
                    <span style={{ fontSize: 22, filter: isSelected ? "none" : "grayscale(0.3)" }}>{emoji}</span>
                    <span style={{ fontSize: 10, fontWeight: isSelected ? 700 : 500, textAlign: "center", lineHeight: 1.2 }}>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right panel */}
            <div key={activePanel} style={{ flex: 1, overflowY: "auto", background: "#fff", animation: "panelFade 0.18s ease both" }}>
              {panelSport && (
                <>
                  {/* Panel header */}
                  <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>
                      {panelSport.label}
                    </div>

                    <Link href="/" onClick={closeMenu}
                      className="quick-link"
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 6, borderRadius: 8, textDecoration: "none", color: "var(--obsidian)", fontSize: 14, fontWeight: 500, background: "#f3f4f6" }}>
                      <Home size={16} style={{ flexShrink: 0, color: "#6b7280" }} />
                      Home
                    </Link>

                    <Link href={panelSport.href} onClick={closeMenu}
                      className="quick-link"
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 6, borderRadius: 8, textDecoration: "none", color: "var(--obsidian)", fontSize: 14, fontWeight: 500, background: "#f3f4f6" }}>
                      <span style={{ fontSize: 16 }}>{panelSport.emoji}</span>
                      {panelSport.label} Home
                    </Link>

                    {panelConfig && (
                      <Link href={panelConfig.newsHref} onClick={closeMenu}
                        className="quick-link"
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, textDecoration: "none", color: "var(--obsidian)", fontSize: 14, fontWeight: 500, background: "#f3f4f6" }}>
                        <Newspaper size={16} style={{ flexShrink: 0, color: "#6b7280" }} />
                        {panelConfig.newsLabel}
                      </Link>
                    )}
                  </div>

                  {/* Leagues */}
                  {panelConfig && (
                    <div style={{ padding: "8px 0" }}>
                      <div style={{ padding: "6px 16px 8px", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                        Leagues
                      </div>
                      {panelConfig.leagues.map(l => {
                        const leaguePath = `${panelConfig.sportPath}/league/${l.slug}`;
                        const isActive   = pathname === leaguePath;
                        return (
                          <Link key={l.slug} href={leaguePath} onClick={closeMenu}
                            className="league-row"
                            style={{
                              display: "flex", alignItems: "center", gap: 12,
                              padding: "11px 16px", textDecoration: "none",
                              color: isActive ? "var(--navy)" : "var(--obsidian)",
                              fontWeight: isActive ? 700 : 400, fontSize: 14,
                              background: isActive ? "var(--navy-light)" : "transparent",
                              borderLeft: isActive ? "3px solid var(--navy)" : "3px solid transparent",
                            }}>
                            <LeagueLogo src={l.logo} name={l.name} dark />
                            <span style={{ flex: 1 }}>{l.name}</span>
                            {isActive && (
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--navy)", flexShrink: 0 }} />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* Coming soon */}
                  {!panelConfig && (
                    <div style={{ padding: "48px 20px", textAlign: "center" }}>
                      <div style={{ fontSize: 40, marginBottom: 14 }}>{panelSport.emoji}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--obsidian)", marginBottom: 8 }}>{panelSport.label}</div>
                      <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6, marginBottom: 24 }}>
                        Coming soon — live coverage is on the way.
                      </div>
                      <Link href={panelSport.href} onClick={closeMenu}
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", background: "var(--navy)", borderRadius: 8, textDecoration: "none", color: "#fff", fontSize: 13, fontWeight: 600 }}>
                        Go to {panelSport.label}
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 10, flexShrink: 0, background: "#fff" }}>
            <button onClick={() => { setRadioOpen(true); closeMenu(); }}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#fff", color: "var(--obsidian)", fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "background 120ms", fontFamily: "inherit" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
            >
              <Radio size={15} /> Radio
            </button>
            <button onClick={() => { setAssistantOpen(true); closeMenu(); }}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "none", background: "var(--color-accent)", color: "var(--navy)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "opacity 120ms" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              <Bot size={15} /> Assistant
            </button>
          </div>
        </div>
      )}

      <AssistantSidebar open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      <RadioBar open={radioOpen} onClose={() => setRadioOpen(false)} />
    </>
  );
}