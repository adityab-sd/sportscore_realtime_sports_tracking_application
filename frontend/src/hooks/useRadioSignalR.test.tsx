import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRadioSignalR } from "@/hooks/useRadioSignalR";

const h = vi.hoisted(() => ({
  handlers: {} as Record<string, (arg: unknown) => void>,
  lifecycle: {} as Record<string, (arg?: unknown) => void>,
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("@microsoft/signalr", () => {
  const connection = {
    on: (name: string, cb: (a: unknown) => void) => {
      h.handlers[name] = cb;
    },
    onreconnecting: (cb: (a?: unknown) => void) => {
      h.lifecycle.onreconnecting = cb;
    },
    onreconnected: (cb: (a?: unknown) => void) => {
      h.lifecycle.onreconnected = cb;
    },
    onclose: (cb: (a?: unknown) => void) => {
      h.lifecycle.onclose = cb;
    },
    start: h.start,
    stop: h.stop,
  };
  class HubConnectionBuilder {
    withUrl() {
      return this;
    }
    withAutomaticReconnect() {
      return this;
    }
    configureLogging() {
      return this;
    }
    build() {
      return connection;
    }
  }
  return {
    HubConnectionBuilder,
    HttpTransportType: { WebSockets: 1 },
    LogLevel: { Information: 2, None: 6 },
  };
});

function mockTokenOk(body: unknown = { url: "wss://radio", token: "jwt" }) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
}
function mockTokenNotOk(status = 401) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }));
}

beforeEach(() => {
  h.handlers = {};
  h.lifecycle = {};
  h.start.mockReset().mockResolvedValue(undefined);
  h.stop.mockReset().mockResolvedValue(undefined);
  mockTokenOk();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Minimal RadioAudioEvent — the hook only cares about ordering here.
const clip = (minute: number) => ({
  matchId: 1,
  sport: "football",
  eventType: "goal",
  minute,
  text: `min ${minute}`,
  audioBase64: "",
  contentType: "audio/mpeg",
  synthLatencyMs: 0,
});

describe("useRadioSignalR — lifecycle", () => {
  it('connects (state becomes "connected")', async () => {
    const { result } = renderHook(() => useRadioSignalR());
    await waitFor(() => expect(result.current.state).toBe("connected"));
  });

  // ADDED: token fetch fails.
  it('goes to "error" when the token fetch is not ok', async () => {
    mockTokenNotOk();
    const { result } = renderHook(() => useRadioSignalR());
    await waitFor(() => expect(result.current.state).toBe("error"));
  });

  // ADDED: token body missing fields.
  it('goes to "error" when the token response is missing url/token', async () => {
    mockTokenOk({ url: "", token: "" });
    const { result } = renderHook(() => useRadioSignalR());
    await waitFor(() => expect(result.current.state).toBe("error"));
  });

  // ADDED: start() rejects.
  it('goes to "error" when connection.start() throws', async () => {
    h.start.mockRejectedValue(new Error("handshake failed"));
    const { result } = renderHook(() => useRadioSignalR());
    await waitFor(() => expect(result.current.state).toBe("error"));
  });

  // ADDED: onclose -> disconnected.
  it('goes to "disconnected" when the connection closes', async () => {
    const { result } = renderHook(() => useRadioSignalR());
    await waitFor(() => expect(result.current.state).toBe("connected"));

    act(() => h.lifecycle.onclose?.());
    await waitFor(() => expect(result.current.state).toBe("disconnected"));
  });

  // ADDED: reconnecting / reconnected transitions.
  it("flips to connecting on reconnecting, then connected on reconnected", async () => {
    const { result } = renderHook(() => useRadioSignalR());
    await waitFor(() => expect(result.current.state).toBe("connected"));

    act(() => h.lifecycle.onreconnecting?.());
    await waitFor(() => expect(result.current.state).toBe("connecting"));

    act(() => h.lifecycle.onreconnected?.());
    await waitFor(() => expect(result.current.state).toBe("connected"));
  });

  // ADDED: cleanup on unmount.
  it("calls connection.stop() on unmount", async () => {
    const { result, unmount } = renderHook(() => useRadioSignalR());
    await waitFor(() => expect(result.current.state).toBe("connected"));

    unmount();
    expect(h.stop).toHaveBeenCalled();
  });
});

describe("useRadioSignalR — event queue", () => {
  it("caps the queue at 30 clips, keeping the most recent", async () => {
    const { result } = renderHook(() => useRadioSignalR());
    await waitFor(() => expect(result.current.state).toBe("connected"));

    // Push 35 clips (minutes 0..34) in one batch.
    act(() =>
      h.handlers.radioModeEvent?.(Array.from({ length: 35 }, (_, i) => clip(i))),
    );

    await waitFor(() => expect(result.current.events).toHaveLength(30));
    // Oldest 5 (minutes 0..4) fall off; newest survives.
    expect(result.current.events[0].minute).toBe(5);
    expect(result.current.events[29].minute).toBe(34);
  });

  // ADDED: below-cap batch is kept whole (the non-slice branch).
  it("keeps everything when under the cap", async () => {
    const { result } = renderHook(() => useRadioSignalR());
    await waitFor(() => expect(result.current.state).toBe("connected"));

    act(() => h.handlers.radioModeEvent?.([clip(1), clip(2), clip(3)]));
    await waitFor(() => expect(result.current.events).toHaveLength(3));
  });

  it("ignores a non-array payload", async () => {
    const { result } = renderHook(() => useRadioSignalR());
    await waitFor(() => expect(result.current.state).toBe("connected"));

    act(() => h.handlers.radioModeEvent?.("nope" as unknown as never));
    expect(result.current.events).toHaveLength(0);
  });
});