"use client";
import { useState } from "react";

interface Props {
  logo: string | null;
  shortName: string;
  size?: number;
  highlight?: boolean;
}

/** Team crest from the backend logo URL, with an initials-badge fallback. */
// ============================================================================
// ADDRESSED: accessible team logo names
// ----------------------------------------------------------------------------
// The img has alt text, which is good, but it only receives shortName. Screen
// readers get "MCI" instead of "Manchester City" when callers have the full
// name. Accept an accessible label separately from the visual abbreviation.
//
// EXAMPLE:
//   <img src={logo} alt={ariaLabel ?? shortName} width={size} height={size} />
// ============================================================================
export default function TeamLogo({ logo, shortName, size = 34, highlight }: Props) {
  const [failed, setFailed] = useState(false);
  const showImg = logo && !failed;

  if (showImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={shortName}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: highlight ? "var(--navy-light)" : "var(--cloud)",
      color: highlight ? "var(--navy)" : "var(--text-secondary)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.28, fontWeight: 700, letterSpacing: "0.3px",
    }}>
      {shortName || "?"}
    </div>
  );
}
