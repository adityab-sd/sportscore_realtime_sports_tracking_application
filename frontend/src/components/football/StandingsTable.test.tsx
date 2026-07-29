import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import StandingsTable from "@/components/football/StandingsTable";

// next/link needs a real anchor in jsdom; render children inside a plain <a>.
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: unknown }) =>
    createElement("a", { href }, children as never),
}));

// Minimal ESPNStandingRow-shaped data (only the fields the component reads).
const row = (n: number) => ({
  teamId: `t${n}`,
  rank: n,
  team: `Team ${n}`,
  shortName: `T${n}`,
  logo: null,
  played: 10,
  won: 5,
  drawn: 2,
  lost: 3,
  goalDifference: 4,
  points: 17,
  note: null,
});

const rows = [1, 2, 3, 4, 5].map(row);

describe("<StandingsTable />", () => {
  it("renders every row when no limit is given", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<StandingsTable rows={rows as any} league="eng.1" />);
    for (const n of [1, 2, 3, 4, 5]) {
      expect(screen.getByText(`Team ${n}`)).toBeInTheDocument();
    }
  });

  it("shows only the first `limit` rows", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<StandingsTable rows={rows as any} league="eng.1" limit={3} />);
    expect(screen.getByText("Team 1")).toBeInTheDocument();
    expect(screen.getByText("Team 3")).toBeInTheDocument();
    expect(screen.queryByText("Team 4")).not.toBeInTheDocument();
    expect(screen.queryByText("Team 5")).not.toBeInTheDocument();
  });

  it("links each club to its team page for the given league", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<StandingsTable rows={rows as any} league="eng.1" limit={1} />);
    const link = screen.getByText("Team 1").closest("a");
    expect(link).toHaveAttribute("href", "/football/team/t1?league=eng.1");
  });
});