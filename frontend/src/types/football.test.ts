import { describe, it, expect } from "vitest";
import {
  classifyStatus,
  isLive,
  statusLabel,
  leagueHasFullTable,
  type Match,
} from "@/types/football";

// Build a minimal Match; classifyStatus/statusLabel only read status + kickoff.
const match = (partial: Partial<Match>): Match => partial as Match;

describe("classifyStatus", () => {
  it("treats empty / null / undefined as scheduled", () => {
    expect(classifyStatus(null)).toBe("scheduled");
    expect(classifyStatus(undefined)).toBe("scheduled");
    expect(classifyStatus("")).toBe("scheduled");
  });

  it("classifies finished states", () => {
    for (const s of ["FT", "Full Time", "AET", "after extra time", "Penalties", "POST", "FINISHED", "Final"]) {
      expect(classifyStatus(s), s).toBe("finished");
    }
  });

  it("classifies scheduled states", () => {
    for (const s of ["TBD", "Scheduled", "NS", "Not Started", "Cancelled", "Postponed"]) {
      expect(classifyStatus(s), s).toBe("scheduled");
    }
  });

  it("classifies live states", () => {
    for (const s of ["45'", "1H", "2H", "HT", "LIVE"]) {
      expect(classifyStatus(s), s).toBe("live");
    }
  });

  // Regression guards for the two tricky comments in the source:
  it('does NOT treat "AET" as live even though it contains "ET"', () => {
    expect(classifyStatus("AET")).toBe("finished");
  });

  it('treats bare "ET" (no minute marker) as scheduled, not live', () => {
    expect(classifyStatus("ET")).toBe("scheduled");
  });
});

describe("isLive", () => {
  it("is true only for live statuses", () => {
    expect(isLive("60'")).toBe(true);
    expect(isLive("FT")).toBe(false);
    expect(isLive(null)).toBe(false);
  });
});

describe("statusLabel", () => {
  it("returns the raw status for a live match", () => {
    expect(statusLabel(match({ status: "45'" }))).toBe("45'");
  });

  it('returns "FT" for a finished match', () => {
    expect(statusLabel(match({ status: "Full Time" }))).toBe("FT");
  });

  it('never returns "NaN:NaN" for a scheduled match with an invalid kickoff', () => {
    const label = statusLabel(match({ status: "Scheduled", kickoff: "not-a-date" }));
    expect(label).not.toContain("NaN");
    expect(label).toBe("Scheduled");
  });

  it("formats a valid kickoff time for a scheduled match", () => {
    const label = statusLabel(match({ status: "Scheduled", kickoff: "2026-07-19T18:30:00Z" }));
    expect(label).not.toContain("NaN");
    expect(label).toMatch(/\d{2}:\d{2}/);
  });
});

describe("leagueHasFullTable", () => {
  it("is false for knockout / friendly competitions", () => {
    expect(leagueHasFullTable("uefa.champions")).toBe(false);
    expect(leagueHasFullTable("fifa.friendly")).toBe(false);
  });

  it("is true for regular round-robin leagues", () => {
    expect(leagueHasFullTable("eng.1")).toBe(true);
  });
});