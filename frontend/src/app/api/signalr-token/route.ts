import { NextResponse } from "next/server";
import * as crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const endpoint = process.env.SIGNALR_ENDPOINT;
  const hub      = process.env.SIGNALR_HUB;
  const key      = process.env.SIGNALR_ACCESS_KEY;

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
  const exp       = Math.floor(Date.now() / 1000) + 3600;

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