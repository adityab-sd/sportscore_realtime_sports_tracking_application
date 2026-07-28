// types/f1-race.ts
// ---------------------------------------------------------------------------
// Helpers layered on the real data layer (src/lib/api/f1.ts) plus circuit
// resolution against your CIRCUITS registry (src/lib/circuits.ts).
//
// NOTE: backend `DriverResult` has no time/points/laps yet. `ResultRow` extends
// it with optional fields so the Time/Gap and Pts columns light up automatically
// once F1Dto.java + F1Controller map them from the ESPN summary. Until then the
// results table simply hides those columns (no rows of "—").
// ---------------------------------------------------------------------------

import type { SessionDto, DriverResult, RaceWeekend } from "@/lib/api/f1";
import type { CircuitDetails } from "@/lib/circuits";
import { getAllCircuits } from "@/lib/circuits";

export type ResultRow = DriverResult & {
  time?: string | null;
  timeOrStatus?: string | null;
  points?: number | null;
  laps?: number | null;
  isRetired?: boolean | null;
};

const SESSION_ORDER = [
  "practice 1", "practice 2", "practice 3",
  "sprint qualifying", "sprint",
  "qualifying", "race",
];

export function sortSessions(sessions: SessionDto[]): SessionDto[] {
  if (!Array.isArray(sessions)) return [];
  return [...sessions].sort((a, b) => {
    const ai = SESSION_ORDER.indexOf((a.label ?? "").toLowerCase());
    const bi = SESSION_ORDER.indexOf((b.label ?? "").toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

/** Session whose results headline the page: Race if classified, else latest completed. */
export function headlineSession(sessions: SessionDto[]): SessionDto | null {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;
  const race = sessions.find((s) => (s.label ?? "").toLowerCase() === "race");
  if (race && Array.isArray(race.grid) && race.grid.length > 0) return race;
  const completed = sortSessions(sessions).filter(
    (s) => s.statusState === "post" && Array.isArray(s.grid) && s.grid.length > 0,
  );
  return completed.length ? completed[completed.length - 1] : race ?? null;
}

/** Strip sponsor/boilerplate from the ESPN weekend name to a short GP name. */
export function cleanGpName(name: string, fallback = ""): string {
  return (
    (name ?? "")
      .replace(/Formula 1|Grand Prix|FORMULA 1/gi, "")
      .replace(/\d{4}/g, "")
      .replace(
        /Aramco|Pirelli|AWS|Heineken|Louis Vuitton|MSC Cruises|Lenovo|Crypto\.com|TAG Heuer|Qatar Airways|Moët & Chandon|Singapore Airlines/gi,
        "",
      )
      .trim()
      .replace(/^[\s-]+|[\s-]+$/g, "") ||
    fallback ||
    "Grand Prix"
  );
}

// ── circuit resolution ───────────────────────────────────────────────────────
// The CIRCUITS registry is keyed by slug; the ESPN weekend isn't. Match on
// circuit name (strongest), then city, then country. Circuit-name/city matching
// disambiguates countries that host two races (Italy: Imola/Monza; USA: several).

function norm(s?: string | null): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveCircuit(
  weekend: Pick<RaceWeekend, "name" | "circuit" | "city" | "country">,
): CircuitDetails | null {
  const wc = norm(weekend.circuit);
  const wcity = norm(weekend.city);
  const wco = norm(weekend.country);

  let best: CircuitDetails | null = null;
  let bestScore = 0;

  for (const c of getAllCircuits()) {
    const cn = norm(c.name);
    const cc = norm(c.city);
    const cco = norm(c.country);
    let score = 0;
    if (wc && cn && (wc === cn || wc.includes(cn) || cn.includes(wc))) score += 3;
    if (wcity && cc && wcity === cc) score += 2;
    if (wco && cco && wco === cco) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore > 0 ? best : null;
}