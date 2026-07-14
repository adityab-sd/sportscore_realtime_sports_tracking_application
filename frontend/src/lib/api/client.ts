/**
 * Retained for any future backend REST endpoints the team may add.
 * Currently unused - reference data comes from ESPN (lib/api/espn.ts).
 */
// [already correct — keep this] NEXT_PUBLIC_API_URL is treated as a public endpoint only; do not place API secrets here.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
export const HAS_REST_BACKEND = false; // set true when backend exposes REST endpoints
