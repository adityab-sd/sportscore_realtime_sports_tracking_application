"use client";

import { useState } from "react";
import Link from "next/link";
import F1ResultsTable from "./F1ResultsTable";
import type { ResultRow } from "@/types/f1-race";

export default function RaceResultPreview({ grid, sessionLabel }: { grid: ResultRow[]; sessionLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  const safe = Array.isArray(grid) ? [...grid].sort((a, b) => a.position - b.position) : [];
  const hasMore = safe.length > 5;
  const rows = expanded ? safe : safe.slice(0, 5);

  if (safe.length === 0) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: 32, textAlign: "center", color: "#67676d" }}>
        No classification available yet
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #eee", fontSize: 13, fontWeight: 800, textTransform: "uppercase", color: "#15151e" }}>
        {sessionLabel} result
      </div>

      <F1ResultsTable rows={rows} />

      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            width: "100%",
            border: "none",
            borderTop: "1px solid #eee",
            background: "#fff",
            cursor: "pointer",
            padding: 12,
            fontSize: 13,
            fontWeight: 800,
            color: "#e10600",
          }}
        >
          {expanded ? "Show less" : "Show all"}
        </button>
      )}

      <div style={{ display: "flex", gap: 10, padding: 14, borderTop: "1px solid #eee" }}>
        <Link
          href="/f1/standings"
          style={{ flex: 1, textAlign: "center", padding: 10, borderRadius: 8, background: "#15151e", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
        >
          View full standings
        </Link>
      </div>
    </div>
  );
}