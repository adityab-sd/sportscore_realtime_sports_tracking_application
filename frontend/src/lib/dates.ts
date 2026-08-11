// Shared date helpers. Previously duplicated verbatim inside six components
// (the three Live sections and the three LeaguePageClient files). Single source
// now, so a fix here (e.g. the timezone-safe local-day math) applies everywhere.

export const CAL_WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Midnight in the viewer's local timezone — avoids UTC off-by-one on day math. */
export function startOfDayLocal(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Stable "YYYY-MM-DD" key built from local parts (not toISOString, which is UTC). */
export function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function pillLabel(d: Date, today: Date): string {
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === -1) return "Yesterday";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { day: "2-digit", weekday: "short" }).replace(",", "");
}

export function friendlyLabel(d: Date): string {
  const today = new Date();
  if (isSameDayDates(d, today)) return "Today";
  if (isSameDayDates(d, addDays(today, 1))) return "Tomorrow";
  if (isSameDayDates(d, addDays(today, -1))) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** True when an ISO timestamp falls on the given local calendar day. */
export function isSameDayIso(iso: string | null, date: Date): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  const k = new Date(t);
  return k.getFullYear() === date.getFullYear() &&
    k.getMonth() === date.getMonth() &&
    k.getDate() === date.getDate();
}

export function isSameDayDates(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}
