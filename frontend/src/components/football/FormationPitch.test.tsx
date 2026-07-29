import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import FormationPitch from "@/components/football/FormationPitch";
import type { TeamLineup } from "@/types/lineup";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: unknown }) =>
    createElement("a", { href }, children as never),
}));

// 11 players with unique last names so we can count what renders.
// The component shows each player's LAST name (name.split(" ").pop()).
function lineup(prefix: string, formation: string): TeamLineup {
  const players = Array.from({ length: 11 }, (_, i) => ({
    id: `${prefix}${i}`,
    name: `First ${prefix}last${i}`,
    shirtNumber: i + 1,
  }));
  return { formation, players };
}

describe("<FormationPitch />", () => {
  it("renders all 11 players for a valid formation", () => {
    const home = lineup("H", "4-4-2");
    const away = lineup("A", "4-3-3");

    render(
      <FormationPitch
        home={home}
        away={away}
        homeTeamId="1"
        awayTeamId="2"
        homeName="Home"
        awayName="Away"
        league="eng.1"
      />,
    );

    // Every home player's last name should appear on the pitch.
    for (let i = 0; i < 11; i++) {
      expect(screen.getByText(`Hlast${i}`)).toBeInTheDocument();
    }
  });

  it("shows both formations in the header", () => {
    const home = lineup("H", "4-4-2");
    const away = lineup("A", "3-5-2");

    render(
      <FormationPitch
        home={home}
        away={away}
        homeTeamId="1"
        awayTeamId="2"
        homeName="Home"
        awayName="Away"
        league="eng.1"
      />,
    );

    expect(screen.getByText(/4-4-2/)).toBeInTheDocument();
    expect(screen.getByText(/3-5-2/)).toBeInTheDocument();
  });
});