"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import MatchLineupSection from "./MatchLineupSection";
import type { ESPNTeamLineup, ESPNTeamRef, ESPNMatchDetail } from "@/lib/api/espn";
import type { PlayPoint } from "@/types/plays";

/**
 * LineupTab — formation pitch + SUBSTITUTIONS + BENCH (ESPN style).
 *
 * Subs are derived from plays[] (which carries substitution data), NOT events[]
 * (which only holds goals/cards in this backend). Works for live and finished.
 * Bench players link to their player pages. New subs fade in smoothly.
 */

interface SubEvent {
  minute: string;
  onName: string;
  onNum?: string;
  onId?: string;
  offName: string;
  offNum?: string;
  offId?: string;
  team: "home" | "away";
}

export default function LineupTab({
  lineups,
  events,
  plays,
  homeTeam,
  awayTeam,
  league,
}: {
  lineups: ESPNTeamLineup[];
  events: ESPNMatchDetail["events"];
  plays: PlayPoint[];
  homeTeam: ESPNTeamRef;
  awayTeam: ESPNTeamRef;
  league: string;
}) {
  const home = lineups?.find((l) => l.teamId === homeTeam.id);
  const away = lineups?.find((l) => l.teamId === awayTeam.id);

  const nameToPlayer = buildNameIndex(home, away);
  const subs = buildSubsFromPlays(plays, nameToPlayer);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <MatchLineupSection
        lineups={lineups}
        events={events}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        league={league}
      />

      {subs.length > 0 && (
        <Section title="Substitutions">
          {subs.map((s, i) => (
            <SubRow key={`${s.offId ?? s.offName}-${s.minute}-${i}`} sub={s} league={league} />
          ))}
        </Section>
      )}

      {(home?.bench?.length || away?.bench?.length) ? (
        <Section title="Bench">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            <BenchColumn short={homeTeam.shortName || homeTeam.name} players={home?.bench ?? []} league={league} />
            <BenchColumn short={awayTeam.shortName || awayTeam.name} players={away?.bench ?? []} league={league} borderLeft />
          </div>
        </Section>
      ) : null}
    </div>
  );
}

/* ── Data helpers ──────────────────────────────────────────────────────────*/

interface PlayerRef { id: string; jersey: string | null; }

function buildNameIndex(home?: ESPNTeamLineup, away?: ESPNTeamLineup): Map<string, PlayerRef> {
  const idx = new Map<string, PlayerRef>();
  for (const l of [home, away]) {
    for (const p of [...(l?.starters ?? []), ...(l?.bench ?? [])]) {
      if (p.name) idx.set(p.name.toLowerCase(), { id: p.id, jersey: p.jersey });
    }
  }
  return idx;
}

/**
 * Substitutions live in plays[] as substitution plays. ESPN's text reads like:
 *   "Substitution, Deportivo Riestra. T. González replaces N. Benegas."
 * We parse the "X replaces Y" pattern; fall back to the play's player as "on".
 */
function buildSubsFromPlays(plays: PlayPoint[], idx: Map<string, PlayerRef>): SubEvent[] {
  if (!Array.isArray(plays)) return [];
  const out: SubEvent[] = [];

  for (const p of plays) {
    const isSub = p.substitution || /substitution/i.test(p.type) || /\breplaces\b/i.test(p.text);
    if (!isSub) continue;

    let onName = p.player ?? "";
    let offName = "";

    // Parse "A replaces B" from the commentary.
    const m = p.text.match(/([A-ZÀ-ÿ][\wÀ-ÿ.'-]*(?:\s+[A-ZÀ-ÿ][\wÀ-ÿ.'-]*)*)\s+replaces\s+([A-ZÀ-ÿ][\wÀ-ÿ.'-]*(?:\s+[A-ZÀ-ÿ][\wÀ-ÿ.'-]*)*)/i);
    if (m) { onName = m[1].trim(); offName = m[2].trim(); }

    const onRef = idx.get(onName.toLowerCase());
    const offRef = idx.get(offName.toLowerCase());

    out.push({
      minute: p.minute || "",
      onName,
      onNum: onRef?.jersey ?? p.jersey ?? undefined,
      onId: onRef?.id ?? p.playerId ?? undefined,
      offName,
      offNum: offRef?.jersey ?? undefined,
      offId: offRef?.id ?? undefined,
      team: p.team === "home" ? "home" : "away",
    });
  }

  // newest first by numeric minute
  return out.sort((a, b) => parseInt(b.minute, 10) - parseInt(a.minute, 10));
}

/* ── Presentational ────────────────────────────────────────────────────────*/

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--obsidian)", textTransform: "uppercase", letterSpacing: "0.6px" }}>{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function SubRow({ sub, league }: { sub: SubEvent; league: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const nameEl = (name: string, id?: string) =>
    id ? (
      <Link href={`/football/player/${id}?league=${league}`} style={{ color: "inherit", textDecoration: "none" }}>{name}</Link>
    ) : name;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
        borderTop: "1px solid var(--border)",
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(-6px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {sub.onName && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
            <Arrow dir="up" />
            {sub.onNum && <span style={{ color: "var(--text-muted)" }}>#{sub.onNum}</span>}
            <span style={{ fontWeight: 700, color: "var(--obsidian)" }}>{nameEl(sub.onName, sub.onId)}</span>
          </div>
        )}
        {sub.offName && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginTop: 3 }}>
            <Arrow dir="down" />
            {sub.offNum && <span style={{ color: "var(--text-muted)" }}>#{sub.offNum}</span>}
            <span style={{ color: "var(--text-secondary)" }}>{nameEl(sub.offName, sub.offId)}</span>
          </div>
        )}
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", flexShrink: 0 }}>{sub.minute}</span>
    </div>
  );
}

function Arrow({ dir }: { dir: "up" | "down" }) {
  const up = dir === "up";
  return (
    <span style={{ width: 16, height: 16, borderRadius: "50%", background: up ? "#16a34a" : "#dc2626", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="9" height="9" viewBox="0 0 10 10">
        <path d={up ? "M5 1 L5 9 M2 4 L5 1 L8 4" : "M5 9 L5 1 M2 6 L5 9 L8 6"} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function BenchColumn({
  short, players, league, borderLeft,
}: {
  short: string;
  players: { id: string; name: string; jersey: string | null }[];
  league: string;
  borderLeft?: boolean;
}) {
  return (
    <div style={{ borderLeft: borderLeft ? "1px solid var(--border)" : "none" }}>
      <div style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "var(--obsidian)", textAlign: "center", background: "var(--cloud, #f8fafc)" }}>{short}</div>
      {players.map((p) => (
        <Link
          key={p.id}
          href={`/football/player/${p.id}?league=${league}`}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderTop: "1px solid var(--border)", fontSize: 13, textDecoration: "none" }}
        >
          {p.jersey && <span style={{ color: "var(--text-muted)", minWidth: 22 }}>#{p.jersey}</span>}
          <span style={{ color: "var(--obsidian)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
        </Link>
      ))}
    </div>
  );
}