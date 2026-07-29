import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatMatchDateTime,
  formatMatchDay,
  formatMatchTime,
  formatShortDate,
  formatCompactDate,
  formatFullDate,
} from "@/lib/formatDate";

// ─────────────────────────────────────────────────────────────
// 1. Null / invalid guards  (these pass on the current code)
// ─────────────────────────────────────────────────────────────
describe("formatDate — null / invalid guards", () => {
  it('formatMatchDateTime returns "TBD" for empty/invalid input', () => {
    expect(formatMatchDateTime(null)).toBe("TBD");
    expect(formatMatchDateTime(undefined)).toBe("TBD");
    expect(formatMatchDateTime("")).toBe("TBD");
    expect(formatMatchDateTime("not-a-date")).toBe("TBD");
  });

  it('the other formatters return "" for empty/invalid input', () => {
    const fns = [
      formatMatchDay,
      formatMatchTime,
      formatShortDate,
      formatCompactDate,
      formatFullDate,
    ];
    for (const fn of fns) {
      expect(fn(null)).toBe("");
      expect(fn(undefined)).toBe("");
      expect(fn("")).toBe("");
      expect(fn("garbage")).toBe("");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Relative day labels — clock frozen so tests are deterministic
//    (these pass on the current code)
//
//    Inputs are built from the SAME frozen instant, so they don't
//    depend on the machine's timezone.
// ─────────────────────────────────────────────────────────────
describe("formatDate — relative day labels (clock frozen)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Freeze "now" to local noon on 19 Jul 2026.
    vi.setSystemTime(new Date(2026, 6, 19, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('labels the same day as "Today"', () => {
    const today = new Date(2026, 6, 19, 20, 0, 0).toISOString();
    expect(formatMatchDay(today)).toBe("Today");
  });

  it('labels the next day as "Tomorrow"', () => {
    const tomorrow = new Date(2026, 6, 20, 9, 0, 0).toISOString();
    expect(formatMatchDay(tomorrow)).toBe("Tomorrow");
  });

  it('labels the previous day as "Yesterday"', () => {
    const yesterday = new Date(2026, 6, 18, 9, 0, 0).toISOString();
    expect(formatMatchDay(yesterday)).toBe("Yesterday");
  });

  it("labels other days with a weekday string, not a relative word", () => {
    const other = new Date(2026, 6, 25, 9, 0, 0).toISOString();
    const out = formatMatchDay(other);
    expect(out).not.toMatch(/Today|Tomorrow|Yesterday/);
    expect(out).toMatch(/Jul/);
  });

  it('formatMatchDateTime joins the day and time with " · "', () => {
    const today = new Date(2026, 6, 19, 20, 0, 0).toISOString();
    // Don't assert the exact time string — it's locale dependent.
    expect(formatMatchDateTime(today)).toMatch(/^Today · .+/);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. THE BUG DEMO — date-only strings + timezone
//
//    `new Date("2026-07-19")` is parsed as UTC midnight, but
//    formatDate reads it back with LOCAL getters. In any timezone
//    west of UTC the calendar day rolls back by one.
//
//    The npm scripts pin TZ=America/Los_Angeles so this is
//    DETERMINISTIC. Run in Ireland (UTC+1) with no TZ pin and the
//    bug hides — which is the whole point of pinning it.
//
//    EXPECTATION: these three FAIL on the current formatDate.ts.
//    That red is the proof the bug exists. After you fix the parse,
//    they go green.
// ─────────────────────────────────────────────────────────────
describe("formatDate — date-only strings (timezone off-by-one)", () => {
  it("formatShortDate keeps the same calendar day", () => {
    expect(formatShortDate("2026-07-19")).toContain("Jul 19");
  });

  it("formatCompactDate keeps the same calendar day", () => {
    expect(formatCompactDate("2026-07-19")).toContain("Jul 19");
  });

  it("formatFullDate keeps the same calendar day", () => {
    expect(formatFullDate("2026-07-19")).toContain("Jul 19");
  });
});
