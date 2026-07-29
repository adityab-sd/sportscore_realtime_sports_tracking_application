"use client";

import { useEffect } from "react";
import { X, ExternalLink } from "lucide-react";

export interface ModalArticle {
  headline: string;
  description: string;
  published: string;
  image: string | null;
  link: string | null;
}

export default function PlayerNewsModal({ article, onClose }: { article: ModalArticle; onClose: () => void }) {
  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const published = article.published
    ? new Date(article.published).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={article.headline}
        style={{ position: "relative", width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto", background: "var(--white)", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(0,0,0,0.4)", color: "#fff", backdropFilter: "blur(4px)" }}
        >
          <X size={18} />
        </button>

        {article.image && (
          <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", maxHeight: 280, overflow: "hidden", background: "var(--obsidian)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={article.image} alt={article.headline} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 40%, rgba(255,255,255,0.92) 100%)" }} />
          </div>
        )}

        <div style={{ padding: "20px 22px 24px" }}>
          <h2 style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800, color: "var(--obsidian)", lineHeight: 1.2, letterSpacing: "-0.5px", margin: "0 0 14px" }}>
            {article.headline}
          </h2>

          {article.description && (
            <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.7, margin: "0 0 22px", borderLeft: "3px solid var(--blue)", paddingLeft: 14 }}>
              {article.description}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {published && <>{published} · </>}Source: ESPN
            </span>
            {article.link && (
              <a href={article.link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 700, color: "#fff", background: "var(--navy)", padding: "10px 16px", borderRadius: 10, textDecoration: "none" }}>
                Read full story on ESPN <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
