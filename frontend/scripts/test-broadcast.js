// test-broadcast.js
const crypto = require("crypto");

const endpoint = "https://sportscore-sr1.service.signalr.net"; // same as SIGNALR_ENDPOINT
const key      = "G9oszDv41JX5eq6bSgasK8JBrgqV52vbPqPwLf77eN3TI4RReqS6JQQJ99CGACi5YpzXJ3w3AAAAASRSDb7q";
const hub      = "radioModeHub";
const url      = `${endpoint}/api/v1/hubs/${hub}`;

const b64url = buf =>
  Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
 
function generateToken(audience, key) {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ aud: audience, iat: now, exp: now + 300 }));
  const unsigned = `${header}.${payload}`;
  const sig = crypto
    .createHmac("sha256", Buffer.from(key, "utf8"))
    .update(unsigned)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${unsigned}.${sig}`;
}
 
async function main() {
  const token = generateToken(url, key);
  const silenceWav = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="; // tiny silent clip
 
  const body = {
    target: "radioModeEvent",
    arguments: [[{
      matchId: 999001,
      eventType: "GOAL",
      minute: 34,
      text: "Test commentary — manual broadcast, no Event Hub involved.",
      audioBase64: silenceWav,
      contentType: "audio/wav",
      synthLatencyMs: 0,
    }]],
  };
 
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  console.log(res.status, await res.text());
}
 
main().catch(console.error);