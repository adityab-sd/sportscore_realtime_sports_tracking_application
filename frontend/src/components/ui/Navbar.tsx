"use client";

import { useState, useRef } from "react";
import { useSignalR } from "@/hooks/useSignalR";
import { classifyStatus, LEAGUES as FOOTBALL_LEAGUES } from "@/types/football";
import { LEAGUES as BASKETBALL_LEAGUES } from "@/types/basketball";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio, Bot, Menu, X, ChevronDown, Newspaper } from "lucide-react";
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
    newsLabel: "Latest Football News",
    sportPath: "/football",
    leagues: FOOTBALL_LEAGUES.filter(l => l.slug !== "fifa.friendly"),
  },
  basketball: {
    newsHref: "/basketball/news",
    newsLabel: "Latest Basketball News",
    sportPath: "/basketball",
    leagues: BASKETBALL_LEAGUES,
  },
};

const sports = [
  { key: "football",   label: "Football",   href: "/football",   hasDropdown: true  },
  { key: "basketball", label: "Basketball", href: "/basketball", hasDropdown: true  },
  { key: "cricket",    label: "Cricket",    href: "/cricket",    hasDropdown: false },
  { key: "f1",         label: "F1",         href: "/f1",         hasDropdown: false },
];

function LeagueLogo({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div style={{
        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
        background: "var(--border)", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 9, fontWeight: 700, color: "var(--text-muted)",
      }}>
        {name.slice(0, 1)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      width={20}
      height={20}
      onError={() => setFailed(true)}
      style={{ width: 20, height: 20, objectFit: "contain", flexShrink: 0 }}
    />
  );
}

export default function Navbar() {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [radioOpen,     setRadioOpen]     = useState(false);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [openDropdown,  setOpenDropdown]  = useState<string | null>(null);
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

  return (
    <>
      <header style={{ background: "var(--navy)", position: "sticky", top: 0, zIndex: 40, boxShadow: "0 1px 0 rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: "var(--container)", margin: "0 auto", padding: "0 var(--gap)", height: 60, display: "flex", alignItems: "center", gap: 8 }}>

          {/* Brand */}
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
                <div
                  key={key}
                  style={{ position: "relative" }}
                  onMouseEnter={() => handleMouseEnter(key)}
                  onMouseLeave={handleMouseLeave}
                >
                  <Link
                    href={href}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 8, fontWeight: 500, fontSize: 14, textDecoration: "none", color: active ? "#fff" : "rgba(255,255,255,0.65)", background: (active || isOpen) ? "rgba(255,255,255,0.14)" : "transparent", transition: "background 120ms, color 120ms" }}
                  >
                    {label}
                    {key === "football" && liveCount > 0 && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />}
                    <ChevronDown size={12} style={{ opacity: 0.7, transition: "transform 150ms", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                  </Link>

                  {isOpen && (
                    <div
                      onMouseEnter={() => handleMouseEnter(key)}
                      onMouseLeave={handleMouseLeave}
                      style={{
                        position: "absolute", top: "calc(100% + 6px)", left: 0,
                        background: "var(--white)", border: "1px solid var(--border)",
                        borderRadius: 12, minWidth: 240, boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
                        overflow: "hidden", zIndex: 50,
                        animation: "fadeSlideUp 0.15s ease both",
                      }}
                    >
                      {/* News link */}
                      <Link
                        href={config.newsHref}
                        onClick={() => setOpenDropdown(null)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", textDecoration: "none", color: "var(--obsidian)", fontWeight: 600, fontSize: 13, borderBottom: "1px solid var(--border)", background: "var(--cloud)", transition: "background 100ms" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud-hover)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "var(--cloud)")}
                      >
                        <Newspaper size={14} style={{ color: "var(--navy)", flexShrink: 0 }} />
                        {config.newsLabel}
                      </Link>

                      {/* League list */}
                      <div style={{ padding: "6px 0" }}>
                        <div style={{ padding: "4px 16px 6px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                          Leagues
                        </div>
                        {config.leagues.map(l => {
                          const leaguePath = `${config.sportPath}/league/${l.slug}`;
                          const isActive = pathname === leaguePath;
                          return (
                            <Link
                              key={l.slug}
                              href={leaguePath}
                              onClick={() => setOpenDropdown(null)}
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", textDecoration: "none", color: isActive ? "var(--navy)" : "var(--obsidian)", fontWeight: isActive ? 700 : 500, fontSize: 13, background: isActive ? "var(--navy-light)" : "transparent", transition: "background 100ms" }}
                              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--cloud)"; }}
                              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                            >
                              <LeagueLogo src={l.logo} name={l.name} />
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

          {/* Right actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {liveCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 600, paddingRight: 4 }} className="desktop-only">
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />
                {liveCount} Live
              </div>
            )}

            <button onClick={() => setRadioOpen(!radioOpen)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: `1px solid ${radioOpen ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)"}`, background: radioOpen ? "rgba(255,255,255,0.14)" : "transparent", color: "rgba(255,255,255,0.85)", fontWeight: 500, fontSize: 13, cursor: "pointer", transition: "all 120ms" }}>
              <Radio size={15} /><span className="desktop-inline">Radio</span>
            </button>

            <button onClick={() => setAssistantOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "var(--navy)", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "opacity 120ms" }}>
              <Bot size={15} /><span className="desktop-inline">Assistant</span>
            </button>

            <button onClick={() => setMenuOpen(!menuOpen)} style={{ padding: "6px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "rgba(255,255,255,0.85)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} className="mobile-only">
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", background: "var(--navy-dark)", padding: "8px var(--gap) 12px" }} className="mobile-only">
            {sports.map(({ key, label, href }) => {
              const active = activeSport === key;
              return (
                <Link key={key} href={href} onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: "none", color: active ? "#fff" : "rgba(255,255,255,0.7)", background: active ? "rgba(255,255,255,0.1)" : "transparent" }}>
                  {label}
                  {key === "football" && liveCount > 0 && <span style={{ marginLeft: "auto", fontSize: 11, color: "#ff9b9b", fontWeight: 600 }}>{liveCount} live</span>}
                </Link>
              );
            })}
            {/* Mobile league submenu for whichever sport is active */}
            {activeSport && DROPDOWN_CONFIGS[activeSport] && (
              <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
                <div style={{ padding: "4px 12px 6px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Leagues</div>
                {DROPDOWN_CONFIGS[activeSport].leagues.map(l => (
                  <Link key={l.slug} href={`${DROPDOWN_CONFIGS[activeSport].sportPath}/league/${l.slug}`} onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 6, fontSize: 13, fontWeight: 500, textDecoration: "none", color: "rgba(255,255,255,0.7)" }}>
                    <LeagueLogo src={l.logo} name={l.name} />
                    {l.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      <AssistantSidebar open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      <RadioBar open={radioOpen} onClose={() => setRadioOpen(false)} />
    </>
  );
}