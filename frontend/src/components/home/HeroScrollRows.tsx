"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Card } from "./heroTypes";
import "./heroScroll.css";

/* ------------------------------------------------------------------ */
/* Date/time formatting — mirrors FixtureCard's UTC-based approach     */
/* to stay hydration-safe (server and client can differ in timezone).  */
/* ------------------------------------------------------------------ */

function fmtKickoff(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const isToday = d.toDateString() === today.toDateString();
  const isTmrw = d.toDateString() === tomorrow.toDateString();
  const dayLabel = isToday
    ? "Today"
    : isTmrw
    ? "Tomorrow"
    : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
  return `${dayLabel}, ${time}`;
}

/* ------------------------------------------------------------------ */
/* Team crest with initials fallback                                   */
/* ------------------------------------------------------------------ */

function TeamCrest({ logo, name }: { logo: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (logo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name}
        width={18}
        height={18}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }}
      />
    );
  }

  return (
    <div
      style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        background: "rgba(255,255,255,0.15)", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, fontWeight: 700,
      }}
    >
      {name.charAt(0)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Single card                                                         */
/* ------------------------------------------------------------------ */

function CardItem({ card }: { card: Card }) {
  const bg = card.type === "match" ? card.match.bgImage : card.image;
  const href = card.type === "match" ? card.match.href : card.href;

  return (
    <Link href={href} style={{ display: "block", flexShrink: 0 }}>
      <div
        style={{
          width: 220,
          height: 140,
          borderRadius: 16,
          overflow: "hidden",
          position: "relative",
          background: `#12122a url(${bg}) center / cover no-repeat`,
          transition: "transform 200ms ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.78) 100%)",
          }}
        />

        {card.type === "match" ? (
          <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "12px 14px" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.3px" }} suppressHydrationWarning>
              {fmtKickoff(card.match.kickoff)}
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <TeamCrest logo={card.match.homeLogo} name={card.match.home} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {card.match.home}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <TeamCrest logo={card.match.awayLogo} name={card.match.away} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {card.match.away}
                </span>
              </div>
            </div>

            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.3px" }}>
              {card.match.leagueLabel}
            </span>
          </div>
        ) : (
          <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", padding: 14 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.4px" }}>
              {card.label}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Infinite scroll row                                                 */
/* ------------------------------------------------------------------ */

function ScrollRow({
  cards,
  direction = "left",
  speed = 160,
}: {
  cards: Card[];
  direction?: "left" | "right";
  speed?: number;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // ============================================================================
  // PLEASE review — clean up cloned marquee nodes
  // ----------------------------------------------------------------------------
  // This effect appends DOM clones but never removes them when cards change or
  // the row unmounts. ready also prevents rebuilding if a later render receives
  // different cards, leaving stale duplicated links in the marquee.
  //
  // EXAMPLE:
  //   useEffect(() => {
  //     const scroller = scrollerRef.current;
  //     if (!scroller) return;
  //     const clones = Array.from(scroller.children).map((item) => {
  //       const clone = item.cloneNode(true) as HTMLElement;
  //       clone.dataset.clone = "true";
  //       scroller.appendChild(clone);
  //       return clone;
  //     });
  //     return () => clones.forEach((clone) => clone.remove());
  //   }, [cards]);
  // ============================================================================
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || ready) return;

    const items = Array.from(scroller.children);
    items.forEach((item) => {
      const clone = item.cloneNode(true) as HTMLElement;
      clone.setAttribute("aria-hidden", "true");
      scroller.appendChild(clone);
    });

    setReady(true);
  }, [ready]);

  if (cards.length === 0) return null;

  return (
    <div
      style={{
        overflow: "hidden",
        maskImage: "linear-gradient(to right, transparent, white 5%, white 95%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, white 5%, white 95%, transparent)",
      }}
    >
      <div
        ref={scrollerRef}
        style={{
          display: "flex",
          gap: 12,
          width: "max-content",
          ...(ready
            ? {
                animation: `heroScroll ${speed}s linear infinite`,
                animationDirection: direction === "right" ? "reverse" : "normal",
              }
            : {}),
        }}
        onMouseEnter={(e) => { e.currentTarget.style.animationPlayState = "paused"; }}
        onMouseLeave={(e) => { e.currentTarget.style.animationPlayState = "running"; }}
      >
        {/* PLEASE review — stable keys: index keys remount cards when order changes and can reset image fallback state. EXAMPLE: <CardItem key={card.type === "match" ? card.match.id : card.href} card={card} />. */}
        {cards.map((card, i) => (
          <CardItem key={i} card={card} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exported rows — slow, deliberate scroll speed                       */
/* ------------------------------------------------------------------ */

export default function HeroScrollRows({
  row1, row2, row3,
}: {
  row1: Card[];
  row2: Card[];
  row3: Card[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ScrollRow cards={row1} direction="left" speed={160} />
      <ScrollRow cards={row2} direction="right" speed={150} />
      <ScrollRow cards={row3} direction="left" speed={170} />
    </div>
  );
}
