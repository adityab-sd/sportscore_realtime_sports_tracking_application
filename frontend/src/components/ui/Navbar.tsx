"use client";

import { useState, useRef, useCallback } from "react";
import { useSignalR } from "@/hooks/useSignalR";
import { classifyStatus, LEAGUES as FOOTBALL_LEAGUES } from "@/types/football";
import { LEAGUES as BASKETBALL_LEAGUES } from "@/types/basketball";
import { LEAGUES as BASEBALL_LEAGUES } from "@/types/baseball";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";
import {
  Radio,
  Bot,
  Menu,
  X,
  ChevronDown,
  Newspaper,
  Home,
} from "lucide-react";
import AssistantSidebar from "@/components/assistant/AssistantSidebar";
import RadioBar from "@/components/radio/RadioBar";

/* ================================================================== */
/* CONFIG                                                             */
/* ================================================================== */

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
    leagues: FOOTBALL_LEAGUES,
  },
  basketball: {
    newsHref: "/basketball/news",
    newsLabel: "Basketball News",
    sportPath: "/basketball",
    leagues: BASKETBALL_LEAGUES,
  },
  baseball: {
    newsHref: "/baseball/news",
    newsLabel: "Baseball News",
    sportPath: "/baseball",
    leagues: BASEBALL_LEAGUES,
  },
};

// CHANGED: dropped the per-sport `emoji` field — the mobile menu no longer uses
// emojis, so it matches the desktop bar (text labels + the F1 logo image).
const SPORTS = [
  { key: "football", label: "Football", href: "/football", hasDropdown: true },
  { key: "basketball", label: "Basketball", href: "/basketball", hasDropdown: true },
  { key: "baseball", label: "Baseball", href: "/baseball", hasDropdown: true },
  { key: "f1", label: "Formula 1", href: "/f1", hasDropdown: false },
];

// ADDED: F1 has no "leagues", so the mobile panel used to fall through to a
// misleading "Coming soon" state. F1 is live — these are its real sections.
const F1_LINKS = [
  { label: "Standings", href: "/f1/standings" },
  { label: "Schedule", href: "/f1/schedule" },
  { label: "Results", href: "/f1/results" },
  { label: "Drivers", href: "/f1/drivers" },
  { label: "Teams", href: "/f1/teams" },
];

/* ================================================================== */
/* SMALL COMPONENTS                                                   */
/* ================================================================== */

function LeagueLogo({ src, name, dark = false }: { src: string; name: string; dark?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div
        className={cn(
          "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded text-[9px] font-bold",
          dark ? "bg-gray-100 text-gray-400" : "bg-white/10 text-white/50"
        )}
      >
        {name.slice(0, 1)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      width={22}
      height={22}
      onError={() => setFailed(true)}
      className="h-[22px] w-[22px] shrink-0 object-contain"
    />
  );
}

function LiveDot() {
  return <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-red-500 animate-pulse" />;
}

// ADDED: shared glyph so the F1 logo is rendered identically wherever a sport is
// shown (desktop bar + mobile rail), instead of an emoji.
function SportGlyph({ sportKey, label, className }: { sportKey: string; label: string; className?: string }) {
  if (sportKey === "f1") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/f1.png"
        alt="Formula 1"
        className={className}
        style={{ height: 26, width: "auto", maxWidth: 46, filter: "invert(1)" }}
      />
    );
  }
  return <span className={cn("text-center text-[11px] font-semibold leading-tight", className)}>{label}</span>;
}

/* ================================================================== */
/* DESKTOP DROPDOWN                                                   */
/* ================================================================== */

function DesktopDropdown({
  config,
  onClose,
  pathname,
}: {
  config: DropdownConfig;
  onClose: () => void;
  pathname: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="absolute left-0 top-[calc(100%+8px)] z-50 w-max min-w-[200px] max-w-[360px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:border-neutral-700 dark:bg-neutral-900"
    >
      <Link
        href={config.newsHref}
        onClick={onClose}
        className="flex items-center gap-2.5 border-b border-gray-100 bg-gray-50 px-4 py-3 text-[13px] font-semibold text-gray-800 transition-colors hover:bg-gray-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200"
      >
        <Newspaper size={14} className="shrink-0 text-blue-600" />
        {config.newsLabel}
      </Link>
      <div className="py-1.5">
        <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Leagues
        </div>
        {config.leagues.map((l) => {
          const leaguePath = `${config.sportPath}/league/${l.slug}`;
          const isActive = pathname === leaguePath;
          return (
            <Link
              key={l.slug}
              href={leaguePath}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2.5 text-[13px] transition-colors",
                isActive
                  ? "border-l-[3px] border-blue-600 bg-blue-50 font-bold text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                  : "border-l-[3px] border-transparent font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-neutral-800"
              )}
            >
              <LeagueLogo src={l.logo} name={l.name} dark />
              <span className="flex-1 truncate whitespace-nowrap">{l.name}</span>
              {isActive && <LiveDot />}
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ================================================================== */
/* MOBILE MENU                                                        */
/* ================================================================== */

function MobileMenu({
  isOpen,
  onClose,
  liveCount,
  onRadio,
  onAssistant,
}: {
  isOpen: boolean;
  onClose: () => void;
  liveCount: number;
  onRadio: () => void;
  onAssistant: () => void;
}) {
  const [activePanel, setActivePanel] = useState("football");
  const pathname = usePathname();
  const panelConfig = DROPDOWN_CONFIGS[activePanel];
  const panelSport = SPORTS.find((s) => s.key === activePanel);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden dark:bg-neutral-950"
        >
          {/* Top bar */}
          <div className="flex h-14 shrink-0 items-center justify-between bg-[var(--navy)] px-4 shadow-md">
            <span className="text-lg font-extrabold tracking-tight text-white">
              Sport<span className="text-[var(--color-accent)]">Score</span>
            </span>
            <div className="flex items-center gap-2.5">
              {liveCount > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-300">
                  <LiveDot />
                  {liveCount} live
                </div>
              )}
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="flex items-center justify-center rounded-full bg-white/10 p-1.5 text-white transition-colors hover:bg-white/20"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Two-column body */}
          <div className="flex flex-1 overflow-hidden">
            {/* CHANGED: left rail is now navy (echoes the desktop bar) with text
                labels + the F1 logo instead of emojis; yellow accent marks the
                active sport, same as the desktop hover/active treatment. */}
            <div className="w-[92px] shrink-0 overflow-y-auto bg-[var(--navy)]">
              <Link
                href="/"
                onClick={onClose}
                className="flex flex-col items-center justify-center gap-1.5 border-b border-white/10 p-4 text-white/60 transition-colors hover:bg-white/5 hover:text-white"
              >
                <Home size={20} strokeWidth={1.8} />
                <span className="text-[10px] font-semibold">Home</span>
              </Link>
              {SPORTS.map(({ key, label }) => {
                const isSelected = activePanel === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActivePanel(key)}
                    className={cn(
                      "flex w-full flex-col items-center justify-center gap-1.5 border-b border-white/10 px-2 py-4 transition-colors",
                      isSelected
                        ? "border-l-[3px] border-l-[var(--color-accent)] bg-white/10 font-bold text-white"
                        : "border-l-[3px] border-l-transparent text-white/55 hover:bg-white/5 hover:text-white/90"
                    )}
                  >
                    <SportGlyph sportKey={key} label={label} className={cn(!isSelected && key === "f1" && "opacity-75")} />
                  </button>
                );
              })}
            </div>

            {/* Right panel */}
            <motion.div
              key={activePanel}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18 }}
              className="flex-1 overflow-y-auto bg-white"
            >
              {panelSport && (
                <>
                  <div className="border-b border-gray-200 p-4">
                    <div className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {panelSport.label}
                    </div>
                    <Link
                      href="/"
                      onClick={onClose}
                      className="mb-1.5 flex items-center gap-2.5 rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200"
                    >
                      <Home size={16} className="shrink-0 text-gray-500" />
                      Home
                    </Link>
                    {/* CHANGED: removed the emoji before the sport name */}
                    <Link
                      href={panelSport.href}
                      onClick={onClose}
                      className="mb-1.5 flex items-center gap-2.5 rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200"
                    >
                      {panelSport.label} Home
                    </Link>
                    {panelConfig && (
                      <Link
                        href={panelConfig.newsHref}
                        onClick={onClose}
                        className="flex items-center gap-2.5 rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200"
                      >
                        <Newspaper size={16} className="shrink-0 text-gray-500" />
                        {panelConfig.newsLabel}
                      </Link>
                    )}
                  </div>

                  {panelConfig ? (
                    <div className="py-2">
                      <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Leagues
                      </div>
                      {panelConfig.leagues.map((l) => {
                        const leaguePath = `${panelConfig.sportPath}/league/${l.slug}`;
                        const isActive = pathname === leaguePath;
                        return (
                          <Link
                            key={l.slug}
                            href={leaguePath}
                            onClick={onClose}
                            className={cn(
                              "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                              isActive
                                ? "border-l-[3px] border-l-[var(--navy)] bg-blue-50 font-bold text-[var(--navy)]"
                                : "border-l-[3px] border-l-transparent font-normal text-gray-800 hover:bg-gray-50"
                            )}
                          >
                            <LeagueLogo src={l.logo} name={l.name} dark />
                            <span className="flex-1">{l.name}</span>
                            {isActive && <LiveDot />}
                          </Link>
                        );
                      })}
                    </div>
                  ) : activePanel === "f1" ? (
                    /* CHANGED: F1 now shows its real sections instead of "Coming soon". */
                    <div className="py-2">
                      <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Explore
                      </div>
                      {F1_LINKS.map((l) => {
                        const isActive = pathname === l.href;
                        return (
                          <Link
                            key={l.href}
                            href={l.href}
                            onClick={onClose}
                            className={cn(
                              "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                              isActive
                                ? "border-l-[3px] border-l-[var(--navy)] bg-blue-50 font-bold text-[var(--navy)]"
                                : "border-l-[3px] border-l-transparent font-normal text-gray-800 hover:bg-gray-50"
                            )}
                          >
                            <span className="flex-1">{l.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-5 py-12 text-center">
                      <div className="mb-2 text-base font-bold text-gray-800">{panelSport.label}</div>
                      <div className="mb-6 text-[13px] leading-relaxed text-gray-400">
                        Live coverage is on the way.
                      </div>
                      <Link
                        href={panelSport.href}
                        onClick={onClose}
                        className="inline-flex items-center gap-2 rounded-lg bg-[var(--navy)] px-5 py-2.5 text-[13px] font-semibold text-white"
                      >
                        Go to {panelSport.label}
                      </Link>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </div>

          {/* Bottom bar */}
          <div className="flex shrink-0 gap-2.5 border-t border-gray-200 bg-white p-3">
            <button
              onClick={() => { onRadio(); onClose(); }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-[13px] font-semibold text-gray-800 transition-colors hover:bg-gray-50"
            >
              <Radio size={15} /> Radio
            </button>
            <button
              onClick={() => { onAssistant(); onClose(); }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] py-3 text-[13px] font-bold text-[var(--navy)] transition-opacity hover:opacity-90"
            >
              <Bot size={15} /> Assistant
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ================================================================== */
/* MAIN NAVBAR                                                        */
/* ================================================================== */

export default function Navbar() {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [radioOpen, setRadioOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { matches } = useSignalR();
  const liveCount = matches.filter((m) => classifyStatus(m.status) === "live").length;
  const pathname = usePathname();
  const activeSport = SPORTS.find((s) => pathname.startsWith(s.href))?.key ?? null;

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 60));

  const handleMouseEnter = useCallback((key: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenDropdown(key);
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpenDropdown(null), 120);
  }, []);

  return (
    <>
      {/* ── Outer wrapper: FIXED ensures it stays perfectly anchored to viewport top ── */}
      <div className="fixed inset-x-0 top-0 z-40 w-full transition-all">
        {/* ── Desktop bar ── */}
        <motion.div
          animate={{
            backdropFilter: scrolled ? "blur(12px)" : "none",
            boxShadow: scrolled
              ? "0 0 24px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.06) inset"
              : "none",
            width: scrolled ? "min(860px, 92%)" : "100%",
            borderRadius: scrolled ? 9999 : 0,
            y: scrolled ? 12 : 0,
          }}
          transition={{ type: "spring", stiffness: 220, damping: 50 }}
          className={cn(
            "relative z-[60] mx-auto hidden h-[56px] items-center justify-between px-5 lg:flex",
            scrolled
              ? "bg-[var(--navy)]/85 dark:bg-neutral-950/85"
              : "bg-[var(--navy)] dark:bg-neutral-950"
          )}
          style={{
            // Fallback — Tailwind opacity syntax on CSS vars can be flakey
            background: scrolled ? "rgba(10, 15, 36, 0.88)" : "var(--navy)",
          }}
        >
          {/* Logo */}
          <Link href="/" className="relative z-20 mr-6 shrink-0 text-xl font-extrabold tracking-tight text-white no-underline">
            Sport<span className="text-[var(--color-accent)]">Score</span>
          </Link>

          {/* Nav items — centered with hover highlight */}
          <nav
            className="flex flex-1 items-center justify-center gap-0.5"
            onMouseLeave={() => setHovered(null)}
          >
            {SPORTS.map((sport, idx) => {
              const active = activeSport === sport.key;
              const isOpen = openDropdown === sport.key;
              const config = DROPDOWN_CONFIGS[sport.key];

              const link = (
                <Link
                  href={sport.href}
                  onMouseEnter={() => {
                    setHovered(idx);
                    if (sport.hasDropdown && config) handleMouseEnter(sport.key);
                  }}
                  className={cn(
                    "relative z-20 flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-medium transition-colors",
                    active ? "text-white" : "text-white/65 hover:text-white"
                  )}
                >
                  {hovered === idx && (
                    <motion.div
                      layoutId="nav-hover"
                      className="absolute inset-0 rounded-full bg-white/[0.12]"
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">
                    {sport.key === "f1" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src="/f1.png"
                        alt="Formula 1"
                        style={{ height: 45, width: "auto", maxWidth: 50, filter: "invert(1)" }}
                      />
                    ) : sport.label}
                  </span>
                  {sport.key === "football" && liveCount > 0 && <LiveDot />}
                  {sport.hasDropdown && config && (
                    <ChevronDown
                      size={12}
                      className={cn(
                        "relative z-10 opacity-60 transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                  )}
                </Link>
              );

              if (!sport.hasDropdown || !config) {
                return <div key={sport.key}>{link}</div>;
              }

              return (
                <div
                  key={sport.key}
                  className="relative"
                  onMouseEnter={() => handleMouseEnter(sport.key)}
                  onMouseLeave={handleMouseLeave}
                >
                  {link}
                  <AnimatePresence>
                    {isOpen && (
                      <DesktopDropdown
                        config={config}
                        onClose={() => setOpenDropdown(null)}
                        pathname={pathname}
                      />
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="relative z-20 flex shrink-0 items-center gap-2">
            {liveCount > 0 && (
              <div className="flex items-center gap-1.5 pr-1 text-xs font-semibold text-white/90">
                <LiveDot />
                {liveCount} Live
              </div>
            )}
            <button
              onClick={() => setRadioOpen(!radioOpen)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium text-white/85 transition-all",
                radioOpen
                  ? "border border-white/40 bg-white/15"
                  : "border border-white/20 bg-transparent hover:bg-white/10"
              )}
            >
              <Radio size={14} />
              Radio
            </button>
            <button
              onClick={() => setAssistantOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-[13px] font-bold text-[var(--navy)] transition-opacity hover:opacity-90"
            >
              <Bot size={14} />
              Assistant
            </button>
          </div>
        </motion.div>

        {/* ── Mobile bar ── */}
        <motion.div
          animate={{
            backdropFilter: scrolled ? "blur(12px)" : "none",
            boxShadow: scrolled
              ? "0 0 24px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.06) inset"
              : "none",
            width: scrolled ? "92%" : "100%",
            borderRadius: scrolled ? 16 : 0,
            y: scrolled ? 8 : 0,
          }}
          transition={{ type: "spring", stiffness: 220, damping: 50 }}
          className="relative z-[60] mx-auto flex h-[56px] items-center justify-between px-4 lg:hidden"
          style={{ background: scrolled ? "rgba(10, 15, 36, 0.88)" : "var(--navy)" }}
        >
          {/* CHANGED: match desktop logo weight/size (text-xl) so the wordmark
              reads the same on both; vertically centered by the flex row. */}
          <Link href="/" className="shrink-0 text-xl font-extrabold tracking-tight leading-none text-white no-underline">
            Sport<span className="text-[var(--color-accent)]">Score</span>
          </Link>

          {/* CHANGED: the three actions are now uniform round pills, matching the
              desktop bar's rounded-full buttons (outline for Radio/Menu, accent
              fill for Assistant). Added aria-labels since they're icon-only. */}
          <div className="flex items-center gap-2">
            {liveCount > 0 && (
              <div className="flex items-center gap-1.5 pr-0.5 text-[11px] font-bold text-white/90">
                <LiveDot />
                {liveCount}
              </div>
            )}
            <button
              onClick={() => setRadioOpen(!radioOpen)}
              aria-label="Toggle radio"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors",
                radioOpen ? "border border-white/40 bg-white/15" : "border border-white/20 hover:bg-white/10"
              )}
            >
              <Radio size={16} />
            </button>
            <button
              onClick={() => setAssistantOpen(true)}
              aria-label="Open assistant"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--navy)] transition-opacity hover:opacity-90"
            >
              <Bot size={16} />
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/85 transition-colors hover:bg-white/10"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </motion.div>
      </div>

      {/* ── Mobile mega-menu ── */}
      <MobileMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        liveCount={liveCount}
        onRadio={() => setRadioOpen(true)}
        onAssistant={() => setAssistantOpen(true)}
      />

      <AssistantSidebar open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      <RadioBar open={radioOpen} onClose={() => setRadioOpen(false)} />
    </>
  );
}