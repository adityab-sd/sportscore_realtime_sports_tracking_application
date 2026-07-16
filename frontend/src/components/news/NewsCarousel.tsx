"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { NewsArticle } from "./NewsCard";

// ─────────────────────────────────────────────────────────────────────────────
// NewsCarousel — auto-advancing hero carousel used on the home page.
// Accepts a `sport` prop so it can link to the correct news route.
// ─────────────────────────────────────────────────────────────────────────────

interface NewsCarouselProps {
  articles: NewsArticle[];
  sport?: "football" | "basketball";
}

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SlideImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, var(--navy) 0%, #0044aa 100%)" }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={() => setFailed(true)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
  );
}

export default function NewsCarousel({ articles, sport = "football" }: NewsCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = articles.length;

  const go = useCallback((index: number) => {
    setPrev(current);
    setCurrent(index);
  }, [current]);

  const next = useCallback(() => go(current === total - 1 ? 0 : current + 1), [current, total, go]);
  const prev_ = useCallback(() => go(current === 0 ? total - 1 : current - 1), [current, total, go]);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(next, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, paused, next]);

  if (!articles.length) return null;

  const newsBase = `/${sport}/news`;

  return (
    <div
      style={{ position: "relative", width: "100%", borderRadius: 16, overflow: "hidden", aspectRatio: "16/7", background: "var(--obsidian)", cursor: "pointer" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {articles.map((a, i) => {
        const isActive = i === current;
        const isPrev = i === prev;
        return (
          <Link
            key={a.id}
            href={`${newsBase}/${a.id}`}
            style={{
              position: "absolute", inset: 0, textDecoration: "none",
              opacity: isActive ? 1 : 0,
              transform: isActive ? "scale(1)" : isPrev ? "scale(1.03)" : "scale(0.97)",
              transition: isActive || isPrev ? "opacity 0.55s ease, transform 0.55s ease" : "none",
              zIndex: isActive ? 2 : isPrev ? 1 : 0,
              pointerEvents: isActive ? "auto" : "none",
              display: "block",
            }}
          >
            <SlideImage src={a.image} alt={a.headline} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.05) 100%)" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "28px 32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "#fff", background: "var(--blue)", padding: "3px 9px", borderRadius: 4 }}>
                  {a.category}
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 500 }} suppressHydrationWarning>
                  {timeAgo(a.published)}
                </span>
              </div>
              <h2 style={{ fontSize: "clamp(18px, 2.8vw, 28px)", fontWeight: 800, color: "#fff", lineHeight: 1.2, letterSpacing: "-0.4px", margin: "0 0 8px", maxWidth: 680, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {a.headline}
              </h2>
              {a.description && (
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.5, margin: 0, maxWidth: 560, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {a.description}
                </p>
              )}
            </div>
          </Link>
        );
      })}

      {/* Prev arrow */}
      <button onClick={e => { e.preventDefault(); e.stopPropagation(); prev_(); }} aria-label="Previous story"
        style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", zIndex: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, transition: "background 150ms" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.22)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
      >‹</button>

      {/* Next arrow */}
      <button onClick={e => { e.preventDefault(); e.stopPropagation(); next(); }} aria-label="Next story"
        style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", zIndex: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, transition: "background 150ms" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.22)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
      >›</button>

      {/* Progress bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.1)", zIndex: 10 }}>
        <div key={current} style={{ height: "100%", background: "var(--blue)", animation: paused ? "none" : "carouselProgress 5s linear forwards", width: paused ? "0%" : undefined }} />
      </div>

      {/* Dots */}
      <div style={{ position: "absolute", bottom: 16, right: 52, display: "flex", gap: 6, zIndex: 10 }}>
        {articles.map((_, i) => (
          <button key={i} onClick={e => { e.preventDefault(); e.stopPropagation(); go(i); }} aria-label={`Go to story ${i + 1}`}
            style={{ width: i === current ? 20 : 6, height: 6, borderRadius: 3, background: i === current ? "#fff" : "rgba(255,255,255,0.35)", border: "none", cursor: "pointer", padding: 0, transition: "width 300ms ease, background 300ms ease" }}
          />
        ))}
      </div>

      <style>{`@keyframes carouselProgress { from { width: 0%; } to { width: 100%; } }`}</style>
    </div>
  );
}