import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SignalRProvider, useSignalR } from "@/hooks/useSignalR";

// Shared handle into the mocked SignalR connection. `vi.hoisted` runs BEFORE
// the vi.mock factory, so both can see the same object.
const h = vi.hoisted(() => ({
  handlers: {} as Record<string, (arg: unknown) => void>,
  lifecycle: {} as Record<string, (arg?: unknown) => void>,
  start: vi.fn(),
  stop: vi.fn(),
}));

// Replace the entire @microsoft/signalr module with a fake we can drive.
// NOTE: this tests OUR state machine against OUR assumptions about SignalR —
// not the real transport. Right scope for a unit test; don't oversell it.
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

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SignalRProvider, null, children);

// fetch mock helpers
function mockTokenOk(body: unknown = { url: "wss://hub", token: "jwt" }) {
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
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SignalRProvider — connection lifecycle", () => {
  it('starts "connecting", then "connected" after start() resolves', async () => {
    mockTokenOk();
    const { result } = renderHook(() => useSignalR(), { wrapper });
    expect(result.current.state).toBe("connecting");
    await waitFor(() => expect(result.current.state).toBe("connected"));
  });

  it('goes to "error" when the token fetch is not ok', async () => {
    mockTokenNotOk();
    const { result } = renderHook(() => useSignalR(), { wrapper });
    await waitFor(() => expect(result.current.state).toBe("error"));
  });

  // ADDED: second error branch — 200 response but body is missing fields.
  it('goes to "error" when the token response is missing url/token', async () => {
    mockTokenOk({ url: "", token: "" });
    const { result } = renderHook(() => useSignalR(), { wrapper });
    await waitFor(() => expect(result.current.state).toBe("error"));
  });

  // ADDED: the catch branch — start() rejects.
  it('goes to "error" when connection.start() throws', async () => {
    mockTokenOk();
    h.start.mockRejectedValue(new Error("handshake failed"));
    const { result } = renderHook(() => useSignalR(), { wrapper });
    await waitFor(() => expect(result.current.state).toBe("error"));
  });

  it('goes to "disconnected" when the connection closes', async () => {
    mockTokenOk();
    const { result } = renderHook(() => useSignalR(), { wrapper });
    await waitFor(() => expect(result.current.state).toBe("connected"));

    act(() => h.lifecycle.onclose?.());
    await waitFor(() => expect(result.current.state).toBe("disconnected"));
  });

  // ADDED: reconnection callbacks flip state back and forth.
  it("flips to connecting on reconnecting, then connected on reconnected", async () => {
    mockTokenOk();
    const { result } = renderHook(() => useSignalR(), { wrapper });
    await waitFor(() => expect(result.current.state).toBe("connected"));

    act(() => h.lifecycle.onreconnecting?.());
    await waitFor(() => expect(result.current.state).toBe("connecting"));

    act(() => h.lifecycle.onreconnected?.("conn-id"));
    await waitFor(() => expect(result.current.state).toBe("connected"));
  });

  it("calls connection.stop() on unmount (no leak)", async () => {
    mockTokenOk();
    const { result, unmount } = renderHook(() => useSignalR(), { wrapper });
    await waitFor(() => expect(result.current.state).toBe("connected"));

    unmount();
    expect(h.stop).toHaveBeenCalled();
  });
});

describe("SignalRProvider — match merging", () => {
  it("dedupes matches by id, newest push wins", async () => {
    mockTokenOk();
    const { result } = renderHook(() => useSignalR(), { wrapper });
    await waitFor(() => expect(result.current.state).toBe("connected"));

    act(() =>
      h.handlers.matchUpdate?.([
        { id: 1, status: "10'" },
        { id: 2, status: "5'" },
      ]),
    );
    await waitFor(() => expect(result.current.matches).toHaveLength(2));

    act(() =>
      h.handlers.matchUpdate?.([
        { id: 2, status: "90'" }, // overlaps id 2
        { id: 3, status: "1'" },
      ]),
    );
    await waitFor(() => expect(result.current.matches).toHaveLength(3));

    const two = result.current.matches.find((m) => m.id === 2);
    expect(two?.status).toBe("90'"); // newer value replaced the old one
  });

  it("ignores a non-array payload", async () => {
    mockTokenOk();
    const { result } = renderHook(() => useSignalR(), { wrapper });
    await waitFor(() => expect(result.current.state).toBe("connected"));

    act(() => h.handlers.matchUpdate?.("garbage" as unknown as never));
    act(() => h.handlers.matchUpdate?.({ id: 9 } as unknown as never));
    expect(result.current.matches).toHaveLength(0);
  });
});