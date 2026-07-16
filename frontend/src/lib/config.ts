
// ── SignalR ──
export const SIGNALR_ENDPOINT =
  process.env.NEXT_PUBLIC_SIGNALR_ENDPOINT || "https://sportsscore-sr.service.signalr.net";

export const SIGNALR_HUB =
  process.env.NEXT_PUBLIC_SIGNALR_HUB || "sportscoreHub";

export const SIGNALR_EVENT = "matchUpdate";

// ── ESPN (reference data, server-side only) ──
export const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
export const ESPN_CORE = "https://sports.core.api.espn.com/v2/sports/soccer/leagues";

export const HAS_REST_BACKEND = true;

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
