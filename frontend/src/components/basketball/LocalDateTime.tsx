"use client";
export default function LocalDateTime({ iso, mode = "full" }: { iso: string; mode?: "full" | "date" | "time" }) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions =
    mode === "date" ? { weekday: "short", month: "short", day: "numeric", year: "numeric" }
    : mode === "time" ? { hour: "numeric", minute: "2-digit" }
    : { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" };
  return <span suppressHydrationWarning>{d.toLocaleString(undefined, opts)}</span>;
}