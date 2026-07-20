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
