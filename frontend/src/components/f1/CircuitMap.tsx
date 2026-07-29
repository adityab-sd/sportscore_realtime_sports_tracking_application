"use client";

import { useState } from "react";

// Renders the circuit layout image, falling back to a placeholder if the asset
// is missing (404) instead of showing a broken-image icon.
export default function CircuitMap({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <span style={{ color: "#9a9aa0", fontSize: 13, textAlign: "center" }}>Track map coming soon</span>;
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      style={{ width: "100%", maxWidth: 360, objectFit: "contain" }}
    />
  );
}