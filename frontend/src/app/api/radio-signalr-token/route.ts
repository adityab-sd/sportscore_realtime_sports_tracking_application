import { NextResponse } from "next/server";
import * as crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const endpoint = process.env.SIGNALR_ENDPOINT;
  // Same Azure SignalR Service resource as the main feed - only the hub differs.
  // EventHubToRadioModeFunction.java posts to ".../api/v1/hubs/radioModeHub", so
  // this must match that literal hub name. Overridable via env if you'd rather
  // not hardcode it, but it should not be SIGNALR_HUB (that's the other hub).
  const hub      = process.env.SIGNALR_RADIO_HUB || "radioModeHub";
  const key      = process.env.SIGNALR_ACCESS_KEY;

  // SIGNALR_ACCESS_KEY is read from server-only env, not a NEXT_PUBLIC_ variable.

  if (!endpoint || !hub || !key) {
    // Names withheld from the client response; logged server-side only.
    console.error("[radio-signalr-token] Missing required env vars (names withheld from client response)");
    return NextResponse.json(
      { error: "Server misconfigured. Contact an administrator." },
      { status: 503 }
    );
  }

  const aud       = `${endpoint}/client/?hub=${hub}`;
  const clientUrl = aud.replace(/^https:\/\//, "wss://");

  // Same short TTL + iat/nbf pattern as signalr-token/route.ts, for the same reason:
  // limits the blast radius if a token is intercepted.
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 300;

  if (process.env.NODE_ENV !== "production") {
    console.debug("[radio-signalr-token] Issued SignalR token");
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