"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import TeamLogo from "@/components/football/TeamLogo";
import "./heroScroll.css";

/* ------------------------------------------------------------------ */
/* Types — shared with the server-side HeroStrip                       */
/* ------------------------------------------------------------------ */

export interface MatchCard {
  type: "match";
  id: string;
  dateLabel: string;
  home: { name: string; short: string; logo: string | null };
  away: { name: string; short: string; logo: string | null };
  leagueLabel: string;
  bgImage: string;
  href: string;
}

export interface AestheticCard {
  type: "aesthetic";
  image: string;
  label: string;
  href: string;
}

export type Card = MatchCard | AestheticCard;

/* ------------------------------------------------------------------ */
/* Single card                                                         */
/* ------------------------------------------------------------------ */

function CardItem({ card }: { card: Card }) {
  const bg = card.type === "match" ? card.bgImage : card.image;

  return (
    <Link href={card.href} style={{ display: "block", flexShrink: 0 }}>
      <div
        style={{
          width: 240,
          height: 150,
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
            background: "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.82) 100%)",
          }}
        />

        {card.type === "match" ? (
          <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "12px 14px" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.2px" }}>
              {card.dateLabel}
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TeamLogo logo={card.home.logo} shortName={card.home.short} size={20} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {card.home.name}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TeamLogo logo={card.away.logo} shortName={card.away.short} size={20} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {card.away.name}
                </span>
              </div>
            </div>

            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {card.leagueLabel}
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
  speed = 130,
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
  // The effect imperatively appends clones and only clears the timeout-free
  // ready flag, so updates to cards can leave duplicate/stale DOM children in
  // the scroller. Remove appended clones during cleanup and rebuild from cards.
  //
  // EXAMPLE:
  //   useEffect(() => {
  //     const scroller = scrollerRef.current;
  //     if (!scroller) return;
  //     const clones = Array.from(scroller.children).map((item) => {
  //       const clone = item.cloneNode(true) as HTMLElement;
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
        {/* PLEASE review — stable keys: adding the array index to the key makes cards remount after reordering. EXAMPLE: <CardItem key={card.type === "match" ? card.id : card.href} card={card} />. */}
        {cards.map((card, i) => (
          <CardItem key={`${card.type === "match" ? card.id : card.label}-${i}`} card={card} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exported client scroller                                            */
/* ------------------------------------------------------------------ */

export default function HeroScrollClient({ rows }: { rows: [Card[], Card[], Card[]] }) {
  const [row1, row2, row3] = rows;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ScrollRow cards={row1} direction="left" speed={135} />
      <ScrollRow cards={row2} direction="right" speed={150} />
      <ScrollRow cards={row3} direction="left" speed={165} />
    </div>
  );
}
