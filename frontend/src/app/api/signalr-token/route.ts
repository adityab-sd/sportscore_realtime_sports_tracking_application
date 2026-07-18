import { NextResponse } from "next/server";
import * as crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const endpoint = process.env.SIGNALR_ENDPOINT;
  const hub      = process.env.SIGNALR_HUB;
  const key      = process.env.SIGNALR_ACCESS_KEY;

  // [already correct — keep this] SIGNALR_ACCESS_KEY is read from server-only env, not a NEXT_PUBLIC_ variable.

  if (!endpoint || !hub || !key) {
    const missing = [
      !endpoint && "SIGNALR_ENDPOINT",
      !hub      && "SIGNALR_HUB",
      !key      && "SIGNALR_ACCESS_KEY",
    ].filter(Boolean).join(", ");
    console.error("[signalr-token] Missing env vars:", missing);
    return NextResponse.json(
      { error: `Missing required env vars: ${missing}` },
      { status: 503 }
    );
  }

  const aud       = `${endpoint}/client/?hub=${hub}`;
  const clientUrl = aud.replace(/^https:\/\//, "wss://");
  // ============================================================================
  // PLEASE review — Token lifetime is fixed and lacks issued/not-before claims
  // ----------------------------------------------------------------------------
  // A hard-coded one-hour token is broad for a browser client, and the JWT omits
  // iat/nbf so consumers cannot reject tokens minted too far in the past/future.
  // Prefer a short, configurable TTL with explicit clock-skew handling.
  //
  // EXAMPLE:
  //   const now = Math.floor(Date.now() / 1000);
  //   const exp = now + 300;
  //   const payload = b64url(JSON.stringify({ aud, iat: now, nbf: now - 5, exp }));
  // ============================================================================
  const exp       = Math.floor(Date.now() / 1000) + 3600;

  // ============================================================================
  // PLEASE review — SignalR audience and hub leak through logs
  // ----------------------------------------------------------------------------
  // Logging aud and hub exposes the service hostname and hub naming convention in
  // production telemetry. Keep only non-sensitive success/failure diagnostics.
  //
  // EXAMPLE:
  //   if (process.env.NODE_ENV !== "production") console.debug("[signalr-token] issued SignalR token");
  // ============================================================================
  console.log("[signalr-token] aud:", aud);
  console.log("[signalr-token] hub:", hub);

  const b64url = (s: string) =>
    Buffer.from(s)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const header   = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload  = b64url(JSON.stringify({ aud, exp }));
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