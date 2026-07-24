"use client";

import Link from "next/link";
import type { RawJSON } from "@/lib/api/espn";
import type { ESPNInjury } from "@/lib/api/espn";
import TeamLogo from "@/components/football/TeamLogo";

// ─────────────────────────────────────────────
// Team Schedule List
// ─────────────────────────────────────────────

interface ParsedScheduleGame {
  id: string;
  date: string;
  opponent: { id: string; name: string; shortName: string; logo: string | null };
  homeAway: "home" | "away";
  score: string | null;
  result: string | null;
  statusState: string;
  competition: string;
}

function parseSchedule(data: RawJSON): ParsedScheduleGame[] {
  const events = data?.events ?? data?.schedule ?? [];
  if (!Array.isArray(events)) return [];

  return events.map((e: RawJSON) => {
    const comp = e.competitions?.[0] ?? {};
    const competitors = comp.competitors ?? [];
    const team0 = competitors[0];
    const team1 = competitors[1];
    const isHome = team0?.homeAway === "home";
    const opponent = isHome ? team1 : team0;
    const self = isHome ? team0 : team1;

    return {
      id: e.id ?? "",
      date: e.date ?? comp.date ?? "",
      opponent: {
        id: opponent?.team?.id ?? "",
        name: opponent?.team?.displayName ?? opponent?.team?.name ?? "",
        shortName: opponent?.team?.abbreviation ?? "",
        logo: opponent?.team?.logos?.[0]?.href ?? opponent?.team?.logo ?? null,
      },
      homeAway: isHome ? "home" as const : "away" as const,
      score: self?.score?.displayValue ?? self?.score?.value ?? null,
      result: self?.winner === true ? "W" : self?.winner === false ? "L" : comp.status?.type?.state === "post" ? "D" : null,
      statusState: comp.status?.type?.state ?? e.statusType ?? "pre",
      competition: e.season?.slug ?? comp.type?.abbreviation ?? "",
    };
  });
}

export function TeamScheduleList({ data, league }: { data: RawJSON; league: string }) {
  const games = parseSchedule(data);
  if (games.length === 0) return <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Schedule data unavailable.</p>;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      {games.map((g, i) => {
        const t = Date.parse(g.date);
        const dateStr = Number.isFinite(t)
          ? new Date(t).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })
          : "";

        return (
          <Link key={g.id || i} href={`/football/${g.id}?league=${league}`} style={{ textDecoration: "none" }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < games.length - 1 ? "1px solid var(--border)" : "none", transition: "background 100ms" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cloud)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 80, flexShrink: 0 }} suppressHydrationWarning>{dateStr}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", minWidth: 14 }}>
                {g.homeAway === "away" ? "@" : "vs"}
              </span>
              <TeamLogo logo={g.opponent.logo} shortName={g.opponent.shortName} size={22} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {g.opponent.name}
              </span>
              {g.result && (
                <span style={{ fontSize: 11, fontWeight: 700, color: g.result === "W" ? "var(--success)" : g.result === "L" ? "#dc2626" : "var(--text-muted)", minWidth: 14 }}>
                  {g.result}
                </span>
              )}
              {g.score && (
                <span className="stat-num" style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", minWidth: 36, textAlign: "right" }}>
                  {g.score}
                </span>
              )}
              {g.statusState === "pre" && !g.score && (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }} suppressHydrationWarning>
                  {Number.isFinite(Date.parse(g.date)) ? new Date(g.date).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" }) : "–"}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Team Record Breakdown
// ─────────────────────────────────────────────

export function TeamRecordCard({ data }: { data: RawJSON }) {
  const items = data?.items ?? data?.record?.items ?? [];
  if (!Array.isArray(items) || items.length === 0) return <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Record data unavailable.</p>;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 0 }}>
        {items.map((item: RawJSON, i: number) => (
          <div key={item.type ?? i} style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>
              {item.description ?? item.displayName ?? item.name ?? item.type ?? "Record"}
            </div>
            <div className="stat-num" style={{ fontSize: 18, fontWeight: 800, color: "var(--obsidian)" }}>
              {item.displayValue ?? item.summary ?? item.value ?? "–"}
            </div>
            {item.stats && Array.isArray(item.stats) && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {(item.stats as RawJSON[])
                  .filter((s: RawJSON) => s.displayName && s.displayValue)
                  .slice(0, 3)
                  .map((s: RawJSON) => `${s.displayName}: ${s.displayValue}`)
                  .join(" · ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Injury List
// ─────────────────────────────────────────────

export function InjuryList({ injuries }: { injuries: ESPNInjury[] }) {
  if (injuries.length === 0) return null;

  const statusColor = (s: string) => {
    const sl = s.toLowerCase();
    if (sl.includes("out")) return "#dc2626";
    if (sl.includes("doubt") || sl.includes("question")) return "#ea580c";
    if (sl.includes("day-to-day") || sl.includes("probable")) return "#ca8a04";
    return "var(--text-muted)";
  };

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      {injuries.map((inj, i) => (
        <div key={inj.id ?? i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: i < injuries.length - 1 ? "1px solid var(--border)" : "none" }}>
          {inj.teamLogo && <TeamLogo logo={inj.teamLogo} shortName={inj.team} size={20} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)" }}>{inj.player}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {[inj.position, inj.injury, inj.details].filter(Boolean).join(" · ")}
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(inj.status), flexShrink: 0 }}>
            {inj.status}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Depth Chart (less relevant for soccer but
// backend supports it for some leagues)
// ─────────────────────────────────────────────

export function DepthChart({ data }: { data: RawJSON }) {
  const items = data?.depthCharts?.items ?? data?.items ?? data?.positions ?? [];
  if (!Array.isArray(items) || items.length === 0) return <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Formation data unavailable.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((pos: RawJSON, pi: number) => {
        const posName = pos.position?.displayName ?? pos.position?.name ?? pos.name ?? `Position ${pi + 1}`;
        const athletes = pos.athletes ?? [];

        return (
          <div key={pos.position?.id ?? posName} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
              {posName}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Array.isArray(athletes) && athletes.map((a: RawJSON, ai: number) => (
                <div key={ai} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: ai === 0 ? "#EA580C" : "var(--text-muted)", minWidth: 14 }}>
                    {ai + 1}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: ai === 0 ? 600 : 400, color: "var(--obsidian)" }}>
                    {a.athlete?.displayName ?? a.displayName ?? a.fullName ?? "–"}
                  </span>
                  {a.athlete?.jersey && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>#{a.athlete.jersey}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}