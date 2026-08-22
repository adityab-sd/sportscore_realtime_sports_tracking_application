// src/lib/api/radio.ts
//
// Radio Mode client. Sends match data the page has ALREADY fetched to the Java
// gateway (:8081), which proxies to the Flask RAG service (:5000) /radio
// endpoint. That endpoint summarises the data into spoken copy and synthesises
// audio — it never calls ESPN, so radio adds zero ESPN load.
//
// Routes through the Java gateway (not Flask directly) to stay consistent with
// rag.ts / espn.ts, same as the rest of the app.

import { resolveGatewayBase } from "@/lib/api/base";

const JAVA_GATEWAY_BASE = resolveGatewayBase();

export type RadioPhase = "pre" | "live" | "post";

export interface RadioPlayInput {
  minute?: string;
  type?: string;
  team?: string; // "home" | "away"
  player?: string | null;
  text?: string;
}

export interface RadioRequest {
  phase: RadioPhase;
  sport: string;
  home: string;
  away: string;
  competition?: string;
  venue?: string | null;
  kickoff?: string | null;
  status?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  /** live only: true on the first update (produces a "state of play" catch-up). */
  catchup?: boolean;
  /** live: new plays since last spoken. post: key plays. pre: omit. */
  plays?: RadioPlayInput[];
}

export interface RadioResponse {
  phase: RadioPhase;
  text: string;
  audioBase64: string | null;
  contentType: string | null;
  voice?: string;
  ttsAvailable?: boolean;
  error?: string; // present when the gateway/RAG returned an error status
}

/**
 * Generate one spoken radio clip. Returns null on network/parse failure, or a
 * RadioResponse (which may carry an `error` field, or `audioBase64: null` when
 * TTS is unconfigured) so callers can show text even when audio is unavailable.
 */
export async function generateRadio(req: RadioRequest): Promise<RadioResponse | null> {
  if (!JAVA_GATEWAY_BASE) return null; // gateway not configured — fail closed
  try {
    const res = await fetch(`${JAVA_GATEWAY_BASE}/api/radio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return (await res.json()) as RadioResponse;
  } catch {
    return null;
  }
}