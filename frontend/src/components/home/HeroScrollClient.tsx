"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatMatchDateTime } from "@/lib/formatDate";
import "./heroScroll.css";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface MatchCard {
  type: "match";
  id: string;
  kickoff: string | null;
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

export interface RaceCard {
  type: "race";
  id: string;
  kickoff: string | null;  // race start (named kickoff so rows sort uniformly)
  name: string;            // Grand Prix name
  circuit: string;
  bgImage: string;
  href: string;
}

export type Card = MatchCard | AestheticCard | RaceCard;

/* ------------------------------------------------------------------ */
/* Team crest with initials fallback                                   */
/* ------------------------------------------------------------------ */

function Crest({ logo, name }: { logo: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (logo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name}
        width={20}
        height={20}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: 20, height: 20, objectFit: "contain", flexShrink: 0 }}
      />
    );
  }

  return (
    <div
      style={{
        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
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
/* Single card — handles both match and aesthetic types                 */
/* ------------------------------------------------------------------ */

function CardItem({ card }: { card: Card }) {
  const bg = card.type === "aesthetic" ? card.image : card.bgImage;
  const href = card.href;

  return (
    <Link href={href} style={{ display: "block", flexShrink: 0 }}>
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
            <span
              style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.2px" }}
              suppressHydrationWarning
            >
              {formatMatchDateTime(card.kickoff)}
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Crest logo={card.home.logo} name={card.home.short} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {card.home.name}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Crest logo={card.away.logo} name={card.away.short} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {card.away.name}
                </span>
              </div>
            </div>

            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {card.leagueLabel}
            </span>
          </div>
        ) : card.type === "race" ? (
          <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "12px 14px" }}>
            <span
              style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.2px" }}
              suppressHydrationWarning
            >
              {formatMatchDateTime(card.kickoff)}
            </span>

            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {card.name}
              </div>
              {card.circuit && (
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {card.circuit}
                </div>
              )}
            </div>

            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.3px" }}>
              Formula 1
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
/* Infinite scroll row with clone cleanup                              */
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

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || ready) return;

    const items = Array.from(scroller.children);
    const clones: HTMLElement[] = [];
    items.forEach((item) => {
      const clone = item.cloneNode(true) as HTMLElement;
      clone.setAttribute("aria-hidden", "true");
      scroller.appendChild(clone);
      clones.push(clone);
    });

    setReady(true);
    return () => { clones.forEach((c) => c.remove()); };
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
        {cards.map((card, i) => (
          <CardItem
            key={
              card.type === "match" ? `m-${card.id}-${i}`
                : card.type === "race" ? `r-${card.id}-${i}`
                : `a-${card.label}-${i}`
            }
            card={card}
          />
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