/**
 * Central configuration for all data sources.
 *
 * LIVE MATCHES     → Azure SignalR push (real-time, from the team's backend)
 * REFERENCE DATA   → ESPN public API, called server-side from Next.js routes
 *                    (no key required, no CORS issues, confirmed by Aditya)
 *
 * The SignalR access key is server-only (never NEXT_PUBLIC).
 * ESPN is called only from server components / route handlers - never from the browser.
 */

// ── SignalR ──
export const SIGNALR_ENDPOINT =
  process.env.NEXT_PUBLIC_SIGNALR_ENDPOINT || "https://sportsscore-sr.service.signalr.net";

export const SIGNALR_HUB =
  process.env.NEXT_PUBLIC_SIGNALR_HUB || "sportscoreHub";

export const SIGNALR_EVENT = "matchUpdate";

// ── ESPN (reference data, server-side only) ──
export const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
export const ESPN_CORE = "https://sports.core.api.espn.com/v2/sports/soccer/leagues";

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
