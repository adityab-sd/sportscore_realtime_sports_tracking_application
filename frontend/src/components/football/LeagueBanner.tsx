"use client";
import Link from "next/link";
import { leagueByName, LeagueInfo } from "@/types/football";

interface Props {
  /** Competition name as returned from backend (e.g. "Premier League"). */
  name: string;
  /** Optional resolved slug - pass if known; else we resolve from name. */
  slug?: string | null;
  /** When set, the right side shows "View league →" linking to this slug. */
  showViewLink?: boolean;
}

// ============================================================================
// ADDRESSED: defensive theme color parsing
// ----------------------------------------------------------------------------
// darken assumes every league accent is a six-digit hex string. A short hex, CSS
// variable, or malformed registry value produces rgb(NaN, NaN, NaN) and breaks
// the banner background.
//
// EXAMPLE:
//   if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#1e293b";
// ============================================================================
/** Mix a hex color toward black by `amount` (0..1). Used to build a subtle gradient. */
function darken(hex: string, amount = 0.55): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#1e293b";
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const mix = (c: number) => Math.round(c * (1 - amount));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export default function LeagueBanner({ name, slug: passedSlug, showViewLink = true }: Props) {
  const info: LeagueInfo | undefined = leagueByName(name);
  const slug = passedSlug ?? info?.slug ?? null;
  const accent = info?.accent ?? "#1e293b";
  const bgImage = info?.banner
    ? `linear-gradient(90deg, ${accent}cc 0%, ${darken(accent, 0.25)}99 60%, transparent 100%), url(${info.banner})`
    : `linear-gradient(90deg, ${accent} 0%, ${darken(accent, 0.55)} 100%)`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 10,
        marginBottom: 12,
        background: bgImage,
        backgroundSize: "cover",
        backgroundPosition: "center",
        boxShadow: `inset 0 0 0 1px ${darken(accent, 0.7)}33`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {info?.logo && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: "rgba(255,255,255,0.95)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              padding: 4,
            }}
          >
            <img
              src={info.logo}
              alt={info.name}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
          </div>
        )}
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#fff",
            margin: 0,
            letterSpacing: "-0.2px",
            textShadow: "0 1px 2px rgba(0,0,0,0.25)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </h3>
      </div>
      {showViewLink && slug && (
        <Link
          href={`/football/league/${slug}`}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#fff",
            background: "rgba(255,255,255,0.18)",
            padding: "5px 10px",
            borderRadius: 6,
            textDecoration: "none",
            flexShrink: 0,
            backdropFilter: "blur(4px)",
          }}
        >
          View league →
        </Link>
      )}
    </div>
  );
}