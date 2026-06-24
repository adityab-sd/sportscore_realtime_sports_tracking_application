"use client";
import { useState } from "react";
import { ESPNNews } from "@/lib/api/espn";

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const fallbackGradient = "linear-gradient(135deg, var(--navy) 0%, #0066ff 100%)";

function HeroImage({ src, category }: { src: string | null; category: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div style={{ position: "absolute", inset: 0, background: fallbackGradient }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={category} onError={() => setFailed(true)}
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        objectFit: "cover", objectPosition: "center center",
      }} />
  );
}

function SideImage({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div style={{ width: 84, height: 64, borderRadius: 7, flexShrink: 0, background: fallbackGradient }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" onError={() => setFailed(true)}
      style={{ width: 84, height: 64, borderRadius: 7, flexShrink: 0, objectFit: "cover" }} />
  );
}

function Wrap({ link, children }: { link: string | null; children: React.ReactNode }) {
  if (link) return <a href={link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{children}</a>;
  return <div>{children}</div>;
}

export default function FeaturedStory({ article, side }: { article: ESPNNews; side?: ESPNNews[] }) {
  return (
    <div className="hero-split">
      {/* Main hero */}
      <Wrap link={article.link}>
        <article className="news-card card-hover" style={{
          position: "relative", borderRadius: 14, overflow: "hidden",
          aspectRatio: "16/8", width: "100%", display: "flex",
          alignItems: "flex-end", border: "1px solid var(--border)",
        }}>
          <HeroImage src={article.image} category={article.category} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)" }} />
          <div style={{ position: "relative", padding: "28px 26px", color: "#fff" }}>
            <span style={{
              display: "inline-block", background: "var(--blue)", color: "#fff",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.5px",
              textTransform: "uppercase", padding: "4px 10px", borderRadius: 5, marginBottom: 14,
            }}>{article.category}</span>
            <h2 style={{ fontSize: "clamp(22px, 3.5vw, 30px)", fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.5px", margin: "0 0 10px" }}>{article.headline}</h2>
            {article.description && (
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.82)", lineHeight: 1.55, margin: "0 0 10px", maxWidth: 560, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{article.description}</p>
            )}
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }} suppressHydrationWarning>{timeAgo(article.published)}</span>
          </div>
        </article>
      </Wrap>

      {/* Side stories */}
      {side && side.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {side.slice(0, 3).map(a => (
            <Wrap key={a.id} link={a.link}>
              <article className="card-hover" style={{
                display: "flex", gap: 12, background: "var(--white)",
                border: "1px solid var(--border)", borderRadius: 10, padding: 10,
                flex: 1, alignItems: "center",
              }}>
                <SideImage src={a.image} />
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{a.category}</span>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: "var(--obsidian)", lineHeight: 1.35, margin: "3px 0 0", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.headline}</h3>
                </div>
              </article>
            </Wrap>
          ))}
        </div>
      )}
    </div>
  );
}