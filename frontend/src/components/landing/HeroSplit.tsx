"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSignalR } from "@/hooks/useSignalR";
import { classifyStatus } from "@/types/football";

/* ================================================================== */
/* CONFIG                                                              */
/* ================================================================== */
/*
 * Every sport SportScore covers gets ONE entry here. Nothing downstream
 * (grid shape, timing, rendering) hardcodes which sport goes where or how
 * many sports exist — see the GRID SHAPE note below for exactly how adding
 * a 5th/6th sport reflows both the desktop and mobile layouts automatically.
 *
 * Images live in `public/carousel/<sport>/` and are referenced with
 * root-relative paths, matching the convention already used for
 * `/cards/*` elsewhere in this app (see components/home/HeroStrip.tsx).
 */
interface SportConfig {
  /** Stable machine key, used as the React key seed. */
  key: string;
  /** Human label used in alt text, e.g. "Football". */
  label: string;
  /** Flip to false to pull a sport out of the hero without deleting its config. */
  active: boolean;
  /** Root-relative paths into public/carousel/<sport>/ — all portrait/vertical. */
  images: string[];
}

const SPORTS_CONFIG: SportConfig[] = [
  {
    key: "football",
    label: "Football",
    active: true,
    images: [
      "/carousel/football/messi.jpg",
      "/carousel/football/ronaldo.jpg",
      "/carousel/football/mbappe.jpg",
      "/carousel/football/haaland.jpg",
      "/carousel/football/kvara.jpg",
      "/carousel/football/olise.jpg",
      "/carousel/football/yammal.jpg",
      "/carousel/football/Dimarco.jpg",
    ],
  },
  {
    key: "baseball",
    label: "Baseball",
    active: true,
    images: [
      "/carousel/baseball/baseball-1.jpg",
      "/carousel/baseball/baseball-2.jpg",
      "/carousel/baseball/baseball-3.jpg",
      "/carousel/baseball/baseball-4.jpg",
      "/carousel/baseball/baseball-5.jpg",
    ],
  },
  {
    key: "f1",
    label: "Formula 1",
    active: true,
    images: [
      "/carousel/f1/f1-1.jpg",
      "/carousel/f1/f1-2.jpg",
      "/carousel/f1/f1-3.jpg",
      "/carousel/f1/f1-4.jpg",
      "/carousel/f1/f1-5.jpg",
    ],
  },
  {
    key: "basketball",
    label: "Basketball",
    active: true,
    images: [
      "/carousel/basketball/curry.jpg",
      "/carousel/basketball/lebron.jpg",
      "/carousel/basketball/Westbrook.jpg",
      "/carousel/basketball/Wilson.jpg",
      "/carousel/basketball/caitlin.jpg",
      "/carousel/basketball/Reese.jpg",
    ],
  },
];

/** Universal cadence every column shares, in milliseconds. */
const CAROUSEL_INTERVAL_MS = 5000;
/** Crossfade duration + premium "ease out expo"-style curve. */
const CROSSFADE_DURATION_S = 1.1;
const PREMIUM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Fisher–Yates shuffle (returns a new array; input untouched). */
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ================================================================== */
/* SINGLE SPORT COLUMN                                                 */
/* ================================================================== */

interface SportColumnProps {
  sport: SportConfig;
  intervalMs: number;
  initialDelayMs: number;
}

function SportColumn({ sport, intervalMs, initialDelayMs }: SportColumnProps) {
  const [index, setIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const images = sport.images;

  useEffect(() => {
    // Nothing to rotate through — render a single static frame.
    if (images.length < 2) return;

    // Shuffle-bag ordering: play through a randomized queue of all indices,
    // then reshuffle for the next cycle. Every image shows once per cycle
    // (nothing starved), but the order changes each cycle and never repeats
    // an image back-to-back — so there's no sequence a viewer can predict.
    // Randomness lives here in the effect (client-only), so the SSR frame
    // stays deterministic (index 0) and there's no hydration mismatch.
    let current = 0;            // mirrors the initial useState(0)
    let queue: number[] = [];

    const refill = () => {
      const next = shuffle(images.map((_, i) => i));
      // Avoid the same image twice across the reshuffle boundary.
      if (next[0] === current && next.length > 1) [next[0], next[1]] = [next[1], next[0]];
      queue = next;
    };

    const nextIndex = () => {
      if (queue.length === 0) refill();
      current = queue.shift()!;
      return current;
    };

    // Self-scheduling setTimeout so the FIRST tick can use `initialDelayMs`
    // (a per-column offset — see <HeroSplit>) and every tick after it uses
    // the shared `intervalMs`, keeping columns desynced.
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNext = (delay: number) => {
      timeoutId = setTimeout(() => {
        setIndex(nextIndex());
        scheduleNext(intervalMs);
      }, delay);
    };
    scheduleNext(initialDelayMs);

    return () => clearTimeout(timeoutId);
  }, [images.length, intervalMs, initialDelayMs]);

  if (images.length === 0) {
    // Defensive fallback — only reachable if a sport's folder is empty.
    return <div className="relative h-full w-full bg-neutral-900" />;
  }

  const currentSrc = images[index];

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/*
        <img> (via motion.img) instead of next/image so Framer can animate a
        real DOM node directly. Files are local, already portrait-cropped.

        The trailing "!" on h-full/w-full/object-cover overrides globals.css's
        unlayered `img { height: auto }` reset, which otherwise beats Tailwind's
        layered utilities and left empty space under the photos.
      */}
      <AnimatePresence initial={false}>
        <motion.img
          key={index}
          src={currentSrc}
          alt={`${sport.label} highlight photo`}
          initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 1.05 }}
          transition={{
            duration: prefersReducedMotion ? 0.4 : CROSSFADE_DURATION_S,
            ease: PREMIUM_EASE,
          }}
          className="absolute inset-0 h-full! w-full! object-cover!"
        />
      </AnimatePresence>
    </div>
  );
}

/* ================================================================== */
/* HERO SECTION                                                        */
/* ================================================================== */

export default function HeroSplit() {
  const prefersReducedMotion = useReducedMotion();

  // Same live signal the nav badge uses, so the label always agrees with it.
  const { matches } = useSignalR();
  const hasLive = matches.some((m) => classifyStatus(m.status) === "live");
  const ctaLabel = hasLive ? "View live scores" : "View upcoming fixtures";

  const scrollToFixtures = () =>
    document.getElementById("live-scores")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const activeSports = useMemo(
    () => SPORTS_CONFIG.filter((sport) => sport.active && sport.images.length > 0),
    []
  );

  // ------------------------------------------------------------------
  // GRID SHAPE — two CSS custom properties, both derived from the active
  // sport count, drive the whole layout:
  //   --sport-count  → desktop: one column per active sport.
  //   --mobile-rows  → mobile: ceil(count / 2) rows per side (two vertical
  //                    groups). Add a 5th sport and both update automatically.
  // ------------------------------------------------------------------
  const gridVars = {
    "--sport-count": activeSports.length,
    "--mobile-rows": Math.ceil(activeSports.length / 2),
  } as CSSProperties;

  return (
    // layout.tsx applies paddingTop:56 to <main> to clear the fixed Navbar,
    // so this section just fills the remaining viewport height.
    <section className="relative h-[calc(100vh-56px)] w-full overflow-hidden bg-black">
      {/*
        Mobile (<lg): grid-flow-col + fixed --mobile-rows fills top-to-bottom,
        yielding two vertical groups side by side for any sport count.
        Desktop (lg): one row, one column per active sport (--sport-count).
      */}
      <div
        style={gridVars}
        className="absolute inset-0 z-0 grid grid-flow-col auto-cols-fr grid-rows-[repeat(var(--mobile-rows),minmax(0,1fr))] lg:grid-flow-row lg:grid-rows-1 lg:grid-cols-[repeat(var(--sport-count),minmax(0,1fr))]"
      >
        {activeSports.map((sport, i) => (
          <SportColumn
            key={sport.key}
            sport={sport}
            intervalMs={CAROUSEL_INTERVAL_MS}
            // Spread each column's first tick evenly across one interval so no
            // two columns crossfade at the same moment.
            initialDelayMs={(i * CAROUSEL_INTERVAL_MS) / activeSports.length}
          />
        ))}
      </div>

      {/* Flat black tint over the scene — above columns, below the title. */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-black/45" />

      {/* Centerpiece title — dead center, drop-shadow keeps it readable over
          any frame passing underneath. */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-7 px-6 text-center">
        <h1 className="max-w-4xl text-[clamp(28px,5vw,52px)] font-extrabold leading-[1.15] tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.9)]">
          Your Ultimate Hub for{" "}
          <span className="text-[var(--color-accent,#f2c200)]">Football</span>,{" "}
          <span className="text-[var(--color-accent,#f2c200)]">Basketball</span>,{" "}
          <span className="text-[var(--color-accent,#f2c200)]">F1 </span> &amp; More
        </h1>

        {/* Fades in shortly after the hero settles. Label is dynamic: live scores
            when anything is live, otherwise upcoming fixtures. Scrolls to the
            match section. Only the button is interactive; the headline is not. */}
        <motion.button
          type="button"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5, ease: "easeOut" }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96 }}
          onClick={scrollToFixtures}
          aria-label={ctaLabel}
          className="pointer-events-auto inline-flex cursor-pointer items-center gap-2 rounded-full bg-[var(--color-accent,#f2c200)] px-7 py-3.5 text-[15px] font-bold text-[#111] shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-shadow duration-150 hover:shadow-[0_14px_38px_rgba(0,0,0,0.5)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
        >
          {ctaLabel}
          <motion.span
            aria-hidden
            animate={prefersReducedMotion ? undefined : { y: [0, 3, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </motion.span>
        </motion.button>
      </div>
    </section>
  );
}