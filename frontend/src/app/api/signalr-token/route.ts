import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";

export const dynamic = "force-dynamic";

// ============================================================================
// Simple in-memory rate limiter for this single route.
// WHY IN-MEMORY HERE (unlike the backend's Redis-based limiter): this is one
// lightweight Next.js API route, not a multi-instance backend service, so a
// shared external store isn't needed for this scope. Limits requests per
// client IP to prevent unlimited token minting / SignalR quota exhaustion.
// ============================================================================
const MAX_REQUESTS = 20;
const WINDOW_MS = 60_000; // 1 minute

const requestCounts = new Map<string, { count: number; windowStart: number }>();

// Drop windows that have fully expired so the map can't grow without bound in a
// long-lived serverless instance. Cheap: runs on each request, O(entries).
function evictExpired(now: number): void {
  for (const [id, entry] of requestCounts) {
    if (now - entry.windowStart > WINDOW_MS) requestCounts.delete(id);
  }
}

function isRateLimited(clientId: string): boolean {
  const now = Date.now();
  evictExpired(now);

  const entry = requestCounts.get(clientId);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    requestCounts.set(clientId, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

// Real per-client IP. Returns null when it can't be determined — we do NOT bucket
// all such requests under one "unknown" key, since that would let a single client
// exhaust the shared limit and lock out everyone else. On Vercel x-forwarded-for
// is always set, so null only happens in unusual local setups.
function resolveClientId(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

export async function GET(request: NextRequest) {
  const clientId = resolveClientId(request);

  if (clientId && isRateLimited(clientId)) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", message: "Too many token requests. Please slow down." },
      { status: 429 }
    );
  }

  const endpoint = process.env.SIGNALR_ENDPOINT;
  const hub      = process.env.SIGNALR_HUB;
  const key      = process.env.SIGNALR_ACCESS_KEY;

  // SIGNALR_ACCESS_KEY is read from server-only env, not a NEXT_PUBLIC_ variable.

  if (!endpoint || !hub || !key) {
    const missing = [
      !endpoint && "SIGNALR_ENDPOINT",
      !hub      && "SIGNALR_HUB",
      !key      && "SIGNALR_ACCESS_KEY",
    ].filter(Boolean).join(", ");
    console.error("[signalr-token] Missing required env vars (names withheld from client response)");
    return NextResponse.json(
      { error: "Server misconfigured. Contact an administrator." },
      { status: 503 }
    );
  }

  const aud       = `${endpoint}/client/?hub=${hub}`;
  const clientUrl = aud.replace(/^https:\/\//, "wss://");

  // ADDRESSED: Token lifetime is fixed and lacks iat/nbf claims — reduced TTL from
  // 3600s to 300s (5 min) and added iat/nbf claims with 5s clock-skew tolerance.
  // Short-lived tokens limit the blast radius if one is intercepted.
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 300;

  // ADDRESSED: SignalR audience and hub leak through logs — removed console.log
  // lines that printed aud and hub to production telemetry. Only non-sensitive
  // success diagnostics are kept, and only outside production.
  if (process.env.NODE_ENV !== "production") {
    console.debug("[signalr-token] Issued SignalR token");
  }

  const b64url = (s: string) =>
    Buffer.from(s)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const header   = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload  = b64url(JSON.stringify({ aud, iat: now, nbf: now - 5, exp }));
  const unsigned = `${header}.${payload}`;
  const keyBuf = Buffer.from(key, "utf8");

  const signature = crypto
    .createHmac("sha256", keyBuf)
    .update(Buffer.from(unsigned, "utf8"))
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const token = `${unsigned}.${signature}`;

  return NextResponse.json({ url: clientUrl, token });
}