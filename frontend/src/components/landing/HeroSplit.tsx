"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

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

    // Self-scheduling with setTimeout (rather than setInterval) so the FIRST
    // tick can use a different delay (`initialDelayMs`) than every tick
    // after it (`intervalMs`). Every column gets its own offset — see how
    // `initialDelayMs` is computed in <HeroSplit> — so no two columns ever
    // crossfade on the same millisecond and the wall always feels alive.
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = (delay: number) => {
      timeoutId = setTimeout(() => {
        setIndex((prev: number) => (prev + 1) % images.length);
        scheduleNext(intervalMs); // every tick after the first uses the shared interval
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
        NOTE on <img> vs next/image:
        We use a plain <img> wrapped by Framer Motion's `motion.img` here
        rather than next/image, so Framer can animate a real DOM node
        directly (animating next/image needs `motion.create(Image)` plus
        extra ref-forwarding care). These files are local, in `public/`,
        already optimized/portrait-cropped assets — so we lose little of
        next/image's benefit here. If you later move these to a remote CDN,
        add the host to next.config.ts and switch to `motion.create(Image)`.

        NOTE on the trailing "!" (important) on h-full/w-full/object-cover:
        globals.css has a blanket `img, svg, video { height: auto }` reset
        that sits OUTSIDE any @layer block. Unlayered author CSS always
        beats Tailwind's own (layered) utility classes, regardless of
        specificity — so without `!important` here, every image was
        rendering at its natural aspect ratio (auto height) instead of
        stretching to fill its column, which is exactly what was causing
        the empty space under the photos. The `!` suffix marks these
        utilities `!important`, which outranks that unlayered reset.
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
  const activeSports = useMemo(
    () => SPORTS_CONFIG.filter((sport) => sport.active && sport.images.length > 0),
    []
  );

  // ------------------------------------------------------------------
  // GRID SHAPE — this is the scalability hook. Two CSS custom properties
  // drive the entire layout, both derived purely from how many sports are
  // active right now:
  //
  //   --sport-count  → desktop: exactly one column per active sport.
  //   --mobile-rows  → mobile: ceil(count / 2) rows per side, so the
  //                    sports split into two vertical groups (left/right)
  //                    that each stack their own share top-to-bottom.
  //
  // Add a 5th sport to SPORTS_CONFIG and both numbers update automatically
  // — desktop grows to 5 even columns, mobile becomes a 3-and-2 split
  // across the two sides. No other code changes.
  // ------------------------------------------------------------------
  const gridVars = {
    "--sport-count": activeSports.length,
    "--mobile-rows": Math.ceil(activeSports.length / 2),
  } as CSSProperties;

  return (
    // app/layout.tsx now applies paddingTop:56 to <main> globally (to clear
    // the fixed Navbar on every page), so this section no longer needs its
    // own top offset — it just fills the remaining viewport height.
    <section className="relative h-[calc(100vh-56px)] w-full overflow-hidden bg-black">
      {/*
        Mobile (<1024px, Tailwind's `lg` cutoff): `grid-flow-col` fills each
        implicit column top-to-bottom before starting the next one. With
        `grid-template-rows` fixed at `--mobile-rows`, that naturally yields
        exactly TWO columns (two vertical groups side by side) for any
        sport count — the first group takes the ceil half, the second
        group takes the rest.

        Desktop (`lg:`): switches to a single row with one explicit column
        per active sport (`--sport-count`), same as a plain side-by-side
        split — this is the layout unchanged from before.
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
            // Spread every column's first tick evenly across one full interval
            // (e.g. 4 sports @ 5000ms → offsets 0, 1250, 2500, 3750ms) so no
            // two columns ever crossfade at the same moment.
            initialDelayMs={(i * CAROUSEL_INTERVAL_MS) / activeSports.length}
          />
        ))}
      </div>

      {/* Flat black tint over the whole scene — no glassmorphism.
          Sits above the columns, below the title. */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-black/45" />

      {/* Centerpiece title — dead center, just z-indexed above the tint,
          no card/border/blur behind it. Drop-shadow alone keeps it
          readable over any frame passing underneath. */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 text-center">
        <h1 className="max-w-4xl text-[clamp(28px,5vw,52px)] font-extrabold leading-[1.15] tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.9)]">
          Your Ultimate Hub for{" "}
          <span className="text-[var(--color-accent,#f2c200)]">Football</span>,{" "}
          <span className="text-[var(--color-accent,#f2c200)]">Basketball</span>,{" "}
          <span className="text-[var(--color-accent,#f2c200)]">F1 </span> &amp; More
        </h1>
      </div>
    </section>
  );
}