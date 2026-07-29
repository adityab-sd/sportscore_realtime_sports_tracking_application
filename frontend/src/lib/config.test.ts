import { describe, it, expect, afterEach, vi } from "vitest";
import { espnGet } from "@/lib/config";

describe("espnGet — never-throws / null-on-failure contract", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns parsed JSON on a 200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hello: "world" }) }),
    );
    await expect(espnGet("https://x")).resolves.toEqual({ hello: "world" });
  });

  it("returns null on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(espnGet("https://x")).resolves.toBeNull();
  });

  it("returns null (does not throw) when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(espnGet("https://x")).resolves.toBeNull();
  });

  it("returns null when the body is not valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("bad json");
        },
      }),
    );
    await expect(espnGet("https://x")).resolves.toBeNull();
  });
});

// Low value on its own, but proves the SignalR endpoint fails CLOSED
// (empty string) instead of silently defaulting to real infrastructure.
describe("SIGNALR_ENDPOINT fail-closed default", () => {
  const KEY = "NEXT_PUBLIC_SIGNALR_ENDPOINT";
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is an empty string when the env var is unset/empty", async () => {
    vi.stubEnv(KEY, "");
    vi.resetModules();
    const mod = await import("@/lib/config");
    expect(mod.SIGNALR_ENDPOINT).toBe("");
  });

  it("uses the env var when it is provided", async () => {
    vi.stubEnv(KEY, "wss://real.endpoint");
    vi.resetModules();
    const mod = await import("@/lib/config");
    expect(mod.SIGNALR_ENDPOINT).toBe("wss://real.endpoint");
  });
});
