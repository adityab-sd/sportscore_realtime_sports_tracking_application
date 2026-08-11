// Central backend base-URL resolver.
//
// The data layers used to each read their own env var
// (NEXT_PUBLIC_API_BASE, NEXT_PUBLIC_BASKETBALL_API_BASE, ...), with fallbacks
// that disagreed — some to "" (fail closed / blank UI), some to a hardcoded
// http://localhost:8081 that breaks on Vercel. That meant setting one var could
// leave other sports blank or pointed at localhost in production.
//
// Now there's one contract:
//   - Preferred:  NEXT_PUBLIC_API_BASE_URL = backend root (e.g. https://host/api).
//                 Each sport appends its own segment.
//   - Legacy:     the old per-sport vars still win if present, so existing
//                 deployments keep working unchanged.
//   - Otherwise:  "" — fail closed everywhere (no silent localhost in prod).
//
// NEXT_PUBLIC_* must be referenced as static property accesses for Next.js to
// inline them at build time, which is why they're read directly below.

export type Sport = "football" | "basketball" | "baseball" | "f1";

// Football's legacy var is NEXT_PUBLIC_API_BASE (historical), not *_FOOTBALL_*.
const LEGACY_SPORT_BASE: Record<Sport, string | undefined> = {
  football: process.env.NEXT_PUBLIC_API_BASE,
  basketball: process.env.NEXT_PUBLIC_BASKETBALL_API_BASE,
  baseball: process.env.NEXT_PUBLIC_BASEBALL_API_BASE,
  f1: process.env.NEXT_PUBLIC_F1_API_BASE,
};

const strip = (s: string) => s.replace(/\/$/, "");

/** Base URL for a sport's data endpoints. Returns "" when unconfigured. */
export function resolveApiBase(sport: Sport): string {
  const legacy = LEGACY_SPORT_BASE[sport];
  if (legacy) return strip(legacy);

  const root = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (root) return `${strip(root)}/${sport}`;

  return "";
}

/**
 * Base URL for the Java gateway root (RAG /api/ask, /api/security/...), which
 * has no sport segment. Localhost is allowed only in local dev so production
 * fails closed instead of hitting a machine that isn't there.
 */
export function resolveGatewayBase(): string {
  const explicit =
    process.env.NEXT_PUBLIC_JAVA_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL;
  if (explicit) return strip(explicit);

  if (process.env.NODE_ENV !== "production") return "http://localhost:8081";
  return "";
}
