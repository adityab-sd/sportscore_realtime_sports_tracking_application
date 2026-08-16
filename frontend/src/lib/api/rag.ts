// src/lib/api/rag.ts
//
// Sends chat questions through the Java Spring Boot gateway (:8081),
// which proxies to the Python Flask RAG service (:5000) — NOT called
// directly, to stay consistent with how espn.ts/basketball.ts already
// route through the Java backend rather than hitting Python services
// straight from the browser.

import { resolveGatewayBase } from "@/lib/api/base";

const JAVA_GATEWAY_BASE = resolveGatewayBase();

export interface RagSource {
  title: string;
  category: string;
}

export interface RagHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface RagResponse {
  question: string;
  answer: string;
  grounded: boolean;
  round_used: number | string; // can be 1, 2, or "fallback" — not always a number
  source_type: string; // "knowledge_base" | "live_data" | "fallback" | "knowledge_base+live_data"
  sources: RagSource[];
  error?: string; // present only if the gateway itself failed (e.g. Flask unreachable)
}

/**
 * Sends a question to the RAG chat feature via the Java gateway.
 * Returns null on any network/parsing failure — callers should check
 * for null before rendering, same convention as espnGet() in config.ts.
 */
export async function askAssistant(
  question: string,
  history: RagHistoryTurn[] = [],
): Promise<RagResponse | null> {
  if (!JAVA_GATEWAY_BASE) return null; // gateway not configured — fail closed
  try {
    const res = await fetch(`${JAVA_GATEWAY_BASE}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Follow-ups ("when was it held?") carry no content words of their own, so
      // the RAG service uses the previous user turn to widen its *retrieval*
      // query. Omit the key entirely on a first turn so the request stays
      // byte-identical to the old behaviour.
      body: JSON.stringify(history.length ? { question, history } : { question }),
    });

    const data = (await res.json()) as RagResponse;

    if (!res.ok) {
      // Gateway or Flask returned an error status — data.error (if present)
      // has the message, but we still return it so the caller can decide
      // how to display it rather than silently swallowing the failure.
      return data;
    }

    return data;
  } catch {
    return null;
  }
}