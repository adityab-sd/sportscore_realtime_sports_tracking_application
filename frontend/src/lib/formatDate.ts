/**
 * Shared date formatting — single source of truth for the entire project.
 *
 * All functions use the browser's local timezone via toLocaleTimeString/
 * toLocaleDateString (with `undefined` locale so the user's OS locale
 * controls the output). Components that call these MUST wrap their output
 * in `suppressHydrationWarning` because the server cannot predict the
 * client's timezone.
 *
 * Scalability: adding a new sport only requires passing its ISO date
 * strings through the same formatters — no sport-specific logic here.
 */

// ── Relative day label ──────────────────────────────────────────────

function dayDiff(iso: Date): number {
  const now = new Date();
  const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const matchDay = new Date(iso.getFullYear(), iso.getMonth(), iso.getDate());
  return Math.round((matchDay.getTime() - today.getTime()) / 86_400_000);
}

function relativeDay(d: Date): string {
  const diff = dayDiff(d);
  if (diff === 0)  return "Today";
  if (diff === 1)  return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function localTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Full match date + time: "Today · 7:00 PM", "Tomorrow · 3:30 PM",
 * "Yesterday · 8:00 PM", "Sat, Jul 19 · 5:00 PM"
 */
export function formatMatchDateTime(iso: string | null | undefined): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return `${relativeDay(d)} · ${localTime(d)}`;
}

/**
 * Day label only: "Today", "Tomorrow", "Yesterday", "Sat, Jul 19"
 */
export function formatMatchDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return relativeDay(d);
}

/**
 * Time only in user locale: "7:00 PM", "15:30"
 */
export function formatMatchTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return localTime(d);
}

/**
 * Short date for transaction feeds / news: "Jul 19, 2026"
 */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Compact date (no year): "Jul 19"
 */
export function formatCompactDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Full date with year: "Sat, Jul 19, 2026"
 */
export function formatFullDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
