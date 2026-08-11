"use client";
import Link from "next/link";
import { useState, useEffect, useRef, Fragment, type ReactNode } from "react";
import DatePicker from "@/components/ui/DatePicker";
import { startOfDayLocal, toKey, isSameDayIso } from "@/lib/dates";

type Filter = "all" | "live" | "scheduled" | "finished";
type State = "live" | "scheduled" | "finished";
const PREVIEW_PER_LEAGUE = 4;

/**
 * Everything sport-specific is passed in through this config, so the section
 * itself never imports a sport's types. Football, basketball and baseball each
 * provide their own; the layout, date navigation, filtering and grouping are
 * identical and live here once.
 */
export interface LiveSportConfig<G> {
  leagues: { slug: string }[];
  /** Fetch one day's games for a league, already tagged with its slug. */
  fetchDay: (slug: string, ymd: string) => Promise<G[]>;
  getId: (g: G) => string | number;
  getState: (g: G) => State;
  getDateIso: (g: G) => string | null;
  groupKeyOf: (g: G) => string;
  groupNameOf: (g: G) => string;
  /** Href for the league's "+N more" link, or null if it has no league page. */
  groupHrefOf: (g: G) => string | null;
  /** Sport-specific league banner shown above each grouped section. */
  renderGroupBanner: (g: G) => ReactNode;
  renderCard: (g: G) => ReactNode;
  emptyIcon: string;
  emptyNoun: string; // "games" | "fixtures"
}

interface Props<G> {
  config: LiveSportConfig<G>;
  /** Server-rendered games used for every non-today day's fallback + today. */
  seed: G[];
  /** Overrides `seed` for the today view (football merges in SignalR pushes). */
  today?: G[];
  /** Rendered on the right of the filter bar while viewing today (e.g. LiveStatus). */
  liveEdgeSlot?: ReactNode;
  /** When viewing today with no data yet, show a spinner instead of empty state. */
  todayWaiting?: boolean;
  todayWaitingLabel?: string;
}

function LeagueGroup<G>({ config, games }: { config: LiveSportConfig<G>; games: G[] }) {
  const visible = games.slice(0, PREVIEW_PER_LEAGUE);
  const hidden = games.length - visible.length;
  const href = games[0] ? config.groupHrefOf(games[0]) : null;
  const name = games[0] ? config.groupNameOf(games[0]) : "";
  return (
    <div style={{ marginBottom: 22 }}>
      {games[0] && config.renderGroupBanner(games[0])}
      <div className="matches-grid">{visible.map(g => <Fragment key={config.getId(g)}>{config.renderCard(g)}</Fragment>)}</div>
      {hidden > 0 && href && (
        <div style={{ marginTop: 8 }}>
          <Link href={href} style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textDecoration: "none" }}>+ {hidden} more in {name} →</Link>
        </div>
      )}
    </div>
  );
}

function groupByLeague<G>(config: LiveSportConfig<G>, games: G[]): { key: string; games: G[] }[] {
  const buckets = new Map<string, G[]>();
  for (const g of games) {
    const key = config.groupKeyOf(g);
    const arr = buckets.get(key) ?? [];
    arr.push(g);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries()).map(([key, games]) => ({ key, games }));
}

export default function LiveSportSection<G>({
  config, seed, today, liveEdgeSlot, todayWaiting = false, todayWaitingLabel = "Loading…",
}: Props<G>) {
  const [filter, setFilter] = useState<Filter>("all");
  const todayDate = startOfDayLocal(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(todayDate);
  const selectedKey = toKey(selectedDate);
  const isViewingToday = selectedKey === toKey(todayDate);

  const [dayGames, setDayGames] = useState<G[] | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const cacheRef = useRef<Map<string, G[]>>(new Map());

  const todaySource = today ?? seed;

  useEffect(() => {
    if (isViewingToday) { setDayGames(null); return; }
    const cached = cacheRef.current.get(selectedKey);
    if (cached) { setDayGames(cached); return; }

    const ymd = selectedKey.replace(/-/g, "");
    let cancelled = false;
    setLoadingDay(true);
    setDayGames(null);

    Promise.allSettled(config.leagues.map(l => config.fetchDay(l.slug, ymd))).then(results => {
      if (cancelled) return;
      const byId = new Map<string | number, G>();
      for (const r of results) if (r.status === "fulfilled") for (const g of r.value) byId.set(config.getId(g), g);
      const arr = Array.from(byId.values());
      cacheRef.current.set(selectedKey, arr);
      setDayGames(arr);
    }).finally(() => { if (!cancelled) setLoadingDay(false); });

    return () => { cancelled = true; };
    // config is a stable per-sport object; selectedKey drives refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, isViewingToday]);

  const dated = isViewingToday
    ? todaySource.filter(g => isSameDayIso(config.getDateIso(g), selectedDate))
    : (dayGames ?? []);

  const liveM = dated.filter(g => config.getState(g) === "live");
  const sched = dated.filter(g => config.getState(g) === "scheduled");
  const fin = dated.filter(g => config.getState(g) === "finished");
  const counts = { all: dated.length, live: liveM.length, scheduled: sched.length, finished: fin.length };

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" }, { key: "live", label: "Live" },
    { key: "scheduled", label: "Scheduled" }, { key: "finished", label: "Finished" },
  ];
  const showLive = filter === "all" || filter === "live";
  const showSched = filter === "all" || filter === "scheduled";
  const showFin = filter === "all" || filter === "finished";

  const waiting = isViewingToday ? (dated.length === 0 && todayWaiting) : loadingDay;

  return (
    <div>
      <DatePicker selected={selectedDate} onSelect={setSelectedDate} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {filters.map(f => (
            <button key={f.key} className={`pill${filter === f.key ? " active" : ""}`} onClick={() => setFilter(f.key)}>
              {f.key === "live" && counts.live > 0 && <span style={{ width: 6, height: 6, borderRadius: "50%", background: filter === f.key ? "#fff" : "#ff4d4d" }} />}
              {f.label}<span style={{ fontSize: 11, fontWeight: 700, opacity: 0.6 }}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
        {isViewingToday && liveEdgeSlot}
      </div>

      <div key={selectedKey} style={{ animation: "fadein 0.2s ease" }}>
        {waiting && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div style={{ width: 32, height: 32, margin: "0 auto 14px", border: "3px solid var(--border)", borderTopColor: "var(--navy)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ fontSize: 14, margin: 0 }}>{loadingDay ? "Loading…" : todayWaitingLabel}</p>
          </div>
        )}

        {!waiting && dated.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{config.emptyIcon}</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 6px" }}>No {config.emptyNoun} on this day</p>
            <p style={{ fontSize: 13, margin: 0 }}>There are no scheduled or completed {config.emptyNoun} for this date.</p>
          </div>
        )}

        {!waiting && showLive && liveM.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div className="section-label"><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d" }} />Live Now</div>
            <div className="matches-grid">{liveM.map(g => <Fragment key={config.getId(g)}>{config.renderCard(g)}</Fragment>)}</div>
          </section>
        )}

        {!waiting && showSched && sched.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div className="section-label">Scheduled</div>
            {groupByLeague(config, sched).map(grp => <LeagueGroup key={`s-${grp.key}`} config={config} games={grp.games} />)}
          </section>
        )}

        {!waiting && showFin && fin.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div className="section-label">Finished</div>
            {groupByLeague(config, fin).map(grp => <LeagueGroup key={`f-${grp.key}`} config={config} games={grp.games} />)}
          </section>
        )}
      </div>

      <style>{`
        @keyframes fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
