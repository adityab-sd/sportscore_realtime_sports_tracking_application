"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// The first tab (the F1 home) renders the logo image instead of a text label.
const TABS = [
  { label: "F1", href: "/f1", logo: true },
  { label: "Schedule", href: "/f1/schedule" },
  { label: "Results", href: "/f1/results" },
  { label: "Standings", href: "/f1/standings" },
  { label: "Drivers", href: "/f1/drivers" },
  { label: "Teams", href: "/f1/teams" },
  { label: "News", href: "/f1/news" },
];

export default function F1Tabs() {
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLElement | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  // ── Center the active tab whenever the route changes ───────────────────────
  // On landing (or navigating), scroll the row so the current tab sits in the
  // middle — revealing tabs on BOTH sides. If the active tab is near an end
  // (F1 / News), clamping keeps the row from over-scrolling past its edges.
  useEffect(() => {
    const el = scrollerRef.current;
    const active = activeRef.current;
    if (!el || !active) return;

    // Only bother if the row actually overflows (otherwise everything's visible).
    if (el.scrollWidth - el.clientWidth <= 4) return;

    const target =
      active.offsetLeft - el.clientWidth / 2 + active.offsetWidth / 2;
    const max = el.scrollWidth - el.clientWidth;
    const clamped = Math.max(0, Math.min(target, max));

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: clamped, behavior: reduce ? "auto" : "smooth" });
  }, [pathname]);

  // ── One-time "peek" hint on first load (mobile / overflow only) ────────────
  // Only runs on the F1 home, where the active tab is the logo at the far left
  // (so centering wouldn't reveal anything). Nudges right-and-back once per
  // session to show there's more to swipe to.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (pathname !== "/f1") return; // other pages get the centering effect instead
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (sessionStorage.getItem("f1TabsPeeked") === "1") return;

    const overflow = el.scrollWidth - el.clientWidth;
    if (overflow <= 24) return;

    sessionStorage.setItem("f1TabsPeeked", "1");
    const peek = Math.min(overflow, 140);

    let raf = 0;
    const start = performance.now();
    const OUT = 620, HOLD = 260, BACK = 520;
    const total = OUT + HOLD + BACK;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const startDelay = setTimeout(() => {
      const tick = (now: number) => {
        const elapsed = now - start;
        let x: number;
        if (elapsed < OUT) x = peek * ease(elapsed / OUT);
        else if (elapsed < OUT + HOLD) x = peek;
        else if (elapsed < total) x = peek * (1 - ease((elapsed - OUT - HOLD) / BACK));
        else x = 0;
        el.scrollLeft = x;
        if (elapsed < total) raf = requestAnimationFrame(tick);
        else el.scrollLeft = 0;
      };
      raf = requestAnimationFrame(tick);
    }, 550);

    return () => { clearTimeout(startDelay); cancelAnimationFrame(raf); };
  }, [pathname]);

  return (
    <>
      <div className="f1-red-stripe" />
      <nav className="f1-tabs" ref={scrollerRef}>
        <div className="f1-container" style={{ display: "flex", gap: 0 }}>
          {TABS.map((tab) => {
            const active = tab.href === "/f1"
              ? pathname === "/f1"
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                ref={active ? activeRef : undefined}
                className={`f1-tab${active ? " active" : ""}${tab.logo ? " f1-tab-logo" : ""}`}
                aria-label={tab.logo ? "Formula 1 home" : undefined}
              >
                {tab.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/f1-logo.png" alt="Formula 1" className="f1-tab-logo-img" />
                ) : (
                  tab.label
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}