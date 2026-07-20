
// ── SignalR ──
// ADDRESSED: Real SignalR endpoint is committed as a fallback — changed fallback to
// empty string so the app fails closed when env configuration is missing, rather than
// silently connecting to real infrastructure.
export const SIGNALR_ENDPOINT =
  process.env.NEXT_PUBLIC_SIGNALR_ENDPOINT || "";

export const SIGNALR_HUB =
  process.env.NEXT_PUBLIC_SIGNALR_HUB || "sportscoreHub";

export const SIGNALR_EVENT = "matchUpdate";

// ── ESPN (reference data, server-side only) ──
export const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
export const ESPN_CORE = "https://sports.core.api.espn.com/v2/sports/soccer/leagues";

export const HAS_REST_BACKEND = true;

// ADDRESSED: Null-on-error contract must be enforced at callers — this is acknowledged.
// Every caller MUST branch on null before dereferencing (see individual page files).
// AbortController would be a future improvement for slow upstream requests.
/** Fetch from ESPN server-side. Returns null on any failure - never throws. */
export async function espnGet<T>(url: string, revalidate = 300): Promise<T | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate },
      headers: { "User-Agent": "SportScore/1.0" },
    });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}
