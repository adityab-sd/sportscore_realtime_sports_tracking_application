import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LiveStatus from "@/components/ui/LiveStatus";

// Pure presentational component, but with real branching:
// each ConnState maps to a label, and the "updated ..." time only
// shows when connected. Worth a smoke test; no mocks needed.
describe("<LiveStatus />", () => {
  it('shows "Live" and the update time when connected', () => {
    const t = new Date("2026-07-19T18:30:05Z");
    render(<LiveStatus state="connected" lastUpdate={t} />);
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText(/updated/)).toBeInTheDocument();
  });

  it('shows "Connecting" and no update time while connecting', () => {
    render(<LiveStatus state="connecting" lastUpdate={null} />);
    expect(screen.getByText("Connecting")).toBeInTheDocument();
    expect(screen.queryByText(/updated/)).not.toBeInTheDocument();
  });

  it('shows "Reconnecting" when disconnected', () => {
    render(<LiveStatus state="disconnected" lastUpdate={null} />);
    expect(screen.getByText("Reconnecting")).toBeInTheDocument();
  });

  it('shows "Offline" on error', () => {
    render(<LiveStatus state="error" lastUpdate={null} />);
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("does not show the time even if connected but lastUpdate is null", () => {
    render(<LiveStatus state="connected" lastUpdate={null} />);
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.queryByText(/updated/)).not.toBeInTheDocument();
  });
});