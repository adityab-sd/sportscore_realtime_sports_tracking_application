"use client";
import { useState } from "react";

interface Props {
  logo: string | null;
  shortName: string;
  size?: number;
  highlight?: boolean;
}

/** Team logo from the backend URL, with an initials-badge fallback. */
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
