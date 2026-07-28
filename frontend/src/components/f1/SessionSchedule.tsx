"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SessionDto } from "@/lib/api/f1";
import { sortSessions } from "@/types/f1-race";

// Times show in the viewer's local timezone. To avoid a server/client hydration
// mismatch we render a deterministic UTC value on the server + first client
// paint, then swap to local time after mount (diff is intentional, hence
// suppressHydrationWarning). If you'd rather show venue-local ("track") time,
// add a `timezone` (IANA) field to each circuit in circuits.ts and format with it.

function parse(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export default function SessionSchedule({ sessions, raceId, year }: { sessions: SessionDto[]; raceId: string; year?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const ordered = sortSessions(sessions);
  const yq = year ? `?year=${year}` : "";

  function dateBadge(iso: string | null | undefined) {
    const d = parse(iso);
    if (!d) return { day: "—", month: "" };
    const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
    if (!mounted) opts.timeZone = "UTC";
    const parts = new Intl.DateTimeFormat("en-GB", opts).formatToParts(d);
    return {
      day: parts.find((p) => p.type === "day")?.value ?? "—",
      month: (parts.find((p) => p.type === "month")?.value ?? "").toUpperCase(),
    };
  }

  function time(iso: string | null | undefined) {
    const d = parse(iso);
    if (!d) return "Time TBC";
    const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };
    if (!mounted) opts.timeZone = "UTC";
    return new Intl.DateTimeFormat("en-GB", opts).format(d);
  }

  return (
    <section id="schedule" style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 16px", fontStyle: "italic", color: "#15151e" }}>Schedule</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ordered.map((s) => {
          const badge = dateBadge(s.date);
          const upcoming = s.statusState !== "post";
          const hasResults = Array.isArray(s.grid) && s.grid.length > 0;
          return (
            <div
              key={s.id}
              style={{
                display: "grid",
                gridTemplateColumns: "72px 1fr auto",
                gap: 16,
                alignItems: "center",
                background: "#fff",
                border: "1px solid #e8e8e8",
                borderRadius: 12,
                padding: "14px 18px",
              }}
            >
              <div
                style={{
                  textAlign: "center",
                  borderRadius: 8,
                  padding: "8px 4px",
                  background: upcoming ? "#e10600" : "#f2f2f4",
                  color: upcoming ? "#fff" : "#15151e",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }} suppressHydrationWarning>
                  {badge.day}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }} suppressHydrationWarning>
                  {badge.month}
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#15151e" }}>{s.label}</div>
                <div style={{ fontSize: 13, color: "#67676d", marginTop: 2 }}>
                  <span suppressHydrationWarning>{time(s.date)}</span>
                  {s.statusState === "in" && <span style={{ color: "#e10600", fontWeight: 800, marginLeft: 8 }}>● LIVE</span>}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                {hasResults ? (
                  <Link href={`/f1/race/${raceId}/${s.id}${yq}`} style={{ fontSize: 12, fontWeight: 700, color: "#e10600", textDecoration: "none" }}>
                    Results →
                  </Link>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#c7c7cc" }}>Results</span>
                )}
              </div>
            </div>
          );
        })}
        {ordered.length === 0 && (
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: 28, textAlign: "center", color: "#67676d" }}>
            Session schedule not available yet.
          </div>
        )}
      </div>
    </section>
  );
}