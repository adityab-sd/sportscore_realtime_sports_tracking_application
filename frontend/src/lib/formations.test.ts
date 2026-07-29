import { describe, it, expect } from "vitest";
import { FORMATIONS, normaliseFormation, getFormationCoords } from "@/lib/formations";

describe("FORMATIONS data integrity", () => {
  const entries = Object.entries(FORMATIONS);

  it("has at least one formation defined", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('every formation has exactly 11 positions numbered 1..11', () => {
    for (const [name, coords] of entries) {
      const nums = Object.keys(coords)
        .map(Number)
        .sort((a, b) => a - b);
      expect(nums, `formation ${name}`).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    }
  });

  it("every coordinate is within the 0–100 pitch scale", () => {
    for (const [name, coords] of entries) {
      for (const [pos, c] of Object.entries(coords)) {
        expect(c.x, `${name} pos ${pos} x`).toBeGreaterThanOrEqual(0);
        expect(c.x, `${name} pos ${pos} x`).toBeLessThanOrEqual(100);
        expect(c.y, `${name} pos ${pos} y`).toBeGreaterThanOrEqual(0);
        expect(c.y, `${name} pos ${pos} y`).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("normaliseFormation", () => {
  it("inserts dashes into a plain digit string", () => {
    expect(normaliseFormation("433")).toBe("4-3-3");
    expect(normaliseFormation("4231")).toBe("4-2-3-1");
  });

  it("normalises an already-dashed string", () => {
    expect(normaliseFormation("4-4-2")).toBe("4-4-2");
  });

  it("falls back to 4-4-2 for input shorter than 3 digits", () => {
    expect(normaliseFormation("")).toBe("4-4-2");
    expect(normaliseFormation("44")).toBe("4-4-2");
    expect(normaliseFormation("x")).toBe("4-4-2");
  });
});

describe("getFormationCoords", () => {
  it("returns the requested formation when it exists", () => {
    expect(getFormationCoords("4-3-3")).toBe(FORMATIONS["4-3-3"]);
  });

  it("falls back to 4-4-2 for an unknown but well-formed shape", () => {
    expect(getFormationCoords("9-9-9")).toBe(FORMATIONS["4-4-2"]);
  });

  it("always returns an 11-position object, even for nonsense", () => {
    expect(Object.keys(getFormationCoords("nonsense"))).toHaveLength(11);
  });
});
