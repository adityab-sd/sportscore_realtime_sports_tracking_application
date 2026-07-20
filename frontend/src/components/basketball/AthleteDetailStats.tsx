"use client";

import type { RawJSON } from "@/lib/api/basketball";

// ─────────────────────────────────────────────
// Athlete Season Stats Table
// ─────────────────────────────────────────────

export function AthleteStatTable({ data }: { data: RawJSON }) {
  const splits = data?.splits ?? data?.statistics?.splits ?? {};
  const categories = splits?.categories ?? data?.categories ?? [];

  if (!Array.isArray(categories) || categories.length === 0) return null;

  // PLEASE review — stable list keys: category/stat rows use array indexes, so React can attach stale cells if ESPN reorders categories. EXAMPLE: <div key={cat.id ?? cat.name ?? `category-${ci}`}>.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {categories.map((cat: RawJSON, ci: number) => {
        const stats = cat.stats ?? cat.statistics ?? [];
        if (!Array.isArray(stats) || stats.length === 0) return null;
        const catName = cat.displayName ?? cat.name ?? "Stats";

        return (
          <div key={ci} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
              {catName}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 0 }}>
              {stats.map((s: RawJSON, si: number) => (
                <div key={si} style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.displayName ?? s.name ?? s.abbreviation ?? "–"}
                  </div>
                  <div className="stat-num" style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)" }}>
                    {s.displayValue ?? s.value ?? "–"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Athlete Gamelog
// ─────────────────────────────────────────────

export function AthleteGamelog({ data }: { data: RawJSON }) {
  const categories = data?.categories ?? [];
  const events = data?.events ?? {};
  const seasonTypes = data?.seasonTypes ?? [];

  if (!Array.isArray(seasonTypes) || seasonTypes.length === 0) {
    if (!Array.isArray(categories) || categories.length === 0) return null;
  }

  const gameLogs = Array.isArray(seasonTypes)
    ? seasonTypes.flatMap(
        (st: RawJSON) => st?.categories ?? [],
      )
    : categories;

  if (gameLogs.length === 0) return null;

  // PLEASE review — missing multiple gamelog categories: only gameLogs[0] renders, so postseason/preseason splits can silently disappear. EXAMPLE: const rows = gameLogs.flatMap((g) => Array.isArray(g.events) ? g.events : []);
  const cat = gameLogs[0];
  const labels: string[] = cat?.labels ?? cat?.names ?? [];
  const rows: RawJSON[] = cat?.events ?? [];
  const eventMap: Record<string, RawJSON> = events ?? {};

  if (labels.length === 0 || rows.length === 0) return null;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
        Game Log
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", position: "sticky", left: 0, background: "var(--white)", minWidth: 120 }}>
                Game
              </th>
              {labels.map((l: string) => (
                <th key={l} style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", minWidth: 40 }}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: RawJSON, ri: number) => {
              const eventId = row?.eventId ?? "";
              const eventInfo = eventMap[eventId];
              const stats: string[] = row?.stats ?? [];
              const opponent = eventInfo?.opponent?.abbreviation ?? eventInfo?.atVs ?? "";
              const result = eventInfo?.gameResult ?? "";
              // PLEASE review — Date parsing/timezone assumption: toLocaleDateString on an unvalidated ESPN string can render Invalid Date or shift dates by client timezone. EXAMPLE: const t = Date.parse(String(eventInfo?.gameDate ?? "")); const dateStr = Number.isFinite(t) ? new Date(t).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }) : "";
              const dateStr = eventInfo?.gameDate
                ? new Date(eventInfo.gameDate as string).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                : "";

              return (
                <tr key={ri} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "7px 12px", position: "sticky", left: 0, background: "var(--white)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--obsidian)" }}>
                      {opponent ? `vs ${opponent}` : `Game ${ri + 1}`}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {[dateStr, result].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  {stats.map((v: string, si: number) => (
                    <td key={si} className="stat-num" style={{ padding: "7px 6px", textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>
                      {v}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Athlete Splits
// ─────────────────────────────────────────────

export function AthleteSplits({ data }: { data: RawJSON }) {
  const categories = data?.splitCategories ?? data?.categories ?? [];
  if (!Array.isArray(categories) || categories.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {categories.map((cat: RawJSON, ci: number) => {
        const catName = cat.displayName ?? cat.name ?? "Splits";
        const splits = cat.splits ?? [];
        if (!Array.isArray(splits) || splits.length === 0) return null;

        const labels: string[] = cat.labels ?? [];

        return (
          <div key={ci} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
              {catName}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480, fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", position: "sticky", left: 0, background: "var(--white)", minWidth: 100 }}>
                      Split
                    </th>
                    {labels.map((l: string) => (
                      <th key={l} style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", minWidth: 40 }}>
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {splits.map((split: RawJSON, si: number) => {
                    const stats: string[] = split.stats ?? [];
                    return (
                      <tr key={si} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "7px 12px", fontWeight: 600, color: "var(--obsidian)", position: "sticky", left: 0, background: "var(--white)", fontSize: 12 }}>
                          {split.displayName ?? split.name ?? `Split ${si + 1}`}
                        </td>
                        {stats.map((v: string, vi: number) => (
                          <td key={vi} className="stat-num" style={{ padding: "7px 6px", textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>
                            {v}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
