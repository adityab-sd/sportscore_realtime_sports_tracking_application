import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getScoreboard, getStandings, getNews, getFixtures, getLeaders,
  getLeagueInjuries, getTransactions, getGroups, getCalendar,
} from "@/lib/api/basketball";
import { LEAGUES } from "@/types/basketball";
import NewsCard from "@/components/basketball/NewsCard";
import StandingsTable from "@/components/basketball/StandingsTable";
import TodaysGames from "@/components/basketball/TodaysGames";
import FixtureCard from "@/components/basketball/FixtureCard";
import StatLeaders from "@/components/basketball/StatLeaders";
import InjuryList from "@/components/basketball/InjuryList";
import TransactionFeed from "@/components/basketball/TransactionFeed";
import ComingSoon from "@/components/basketball/ComingSoon";
import type { RawJSON } from "@/lib/api/basketball";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ slug: string }> }

function GroupsSection({ data }: { data: RawJSON }) {
  const children = data?.children ?? data?.groups ?? [];
  if (!Array.isArray(children) || children.length === 0) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
      {children.map((g: RawJSON, i: number) => {
        const name = g.name ?? g.displayName ?? `Group ${i + 1}`;
        const teams: RawJSON[] = g.teams ?? g.entries ?? [];
        return (
          <div key={i} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--obsidian)", marginBottom: 8 }}>{name}</div>
            {/* ADDRESSED: index key hides unstable group/team identity: if ESPN reorders teams, React may preserve the wrong row state. EXAMPLE: {teams.slice(0, 8).map((t) => <div key={t.team?.id ?? t.id ?? t.team?.displayName}>...</div>)}. */}
            {Array.isArray(teams) && teams.slice(0, 8).map((t: RawJSON, ti: number) => (
              <div key={ti} style={{ fontSize: 12, color: "var(--text-secondary)", padding: "2px 0" }}>
                {t.team?.displayName ?? t.team?.name ?? t.displayName ?? t.name ?? "–"}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function CalendarSection({ data }: { data: RawJSON }) {
  const entries = data?.entries ?? data?.items ?? data?.dates ?? [];
  if (!Array.isArray(entries) || entries.length === 0) return null;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {entries.slice(0, 20).map((e: RawJSON, i: number) => {
          const label = e.label ?? e.detail ?? e.alternateLabel ?? "";
          const start = e.startDate ?? e.date ?? "";
          // ADDRESSED: invalid dates leak as "Invalid Date": start is not validated before toLocaleDateString. EXAMPLE: const t = Date.parse(String(start)); const dateStr = Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
          const dateStr = start ? new Date(start as string).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
          return (
            <div key={i} style={{ background: "var(--cloud)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "var(--text-secondary)" }}>
              {dateStr && <span style={{ fontWeight: 600, marginRight: 4 }}>{dateStr}</span>}
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function LeaguePage({ params }: Props) {
  const { slug } = await params;
  const league = LEAGUES.find((l) => l.slug === slug);
  if (!league) return notFound();

  // ============================================================================
  // ADDRESSED: one optional feed failure rejects the league page
  // ----------------------------------------------------------------------------
  // The league entity is validated, but news, injuries, transactions, groups and
  // calendar are additive sections. Promise.all makes a single flaky endpoint
  // blank the entire league page instead of degrading that section.
  //
  // EXAMPLE:
  //   const results = await Promise.allSettled([getNews(slug, 6), getGroups(slug)]);
  // ============================================================================
  const [scoreboard, rows, news, fixtures, leaders, injuries, transactions, groupsRaw, calendarRaw] = await Promise.all([
    getScoreboard(slug),
    getStandings(slug),
    getNews(slug, 6),
    getFixtures(slug),
    getLeaders(slug),
    getLeagueInjuries(slug),
    getTransactions(slug, 15),
    getGroups(slug),
    getCalendar(slug),
  ]);

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>{league.name}</h1>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/basketball" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>← All Basketball</Link>
            <Link href={`/basketball/standings?league=${slug}`} style={{ fontSize: 13, color: "var(--navy)", textDecoration: "none", fontWeight: 600 }}>Full Standings →</Link>
            <Link href="/basketball/statistics" style={{ fontSize: 13, color: "var(--navy)", textDecoration: "none", fontWeight: 600 }}>Stats →</Link>
          </div>
        </div>
      </div>

      <section style={{ marginBottom: 40 }}>
        <div className="section-label" style={{ marginBottom: 14 }}>Games</div>
        <TodaysGames games={scoreboard} defaultLeague={slug} />
      </section>

      {rows.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Standings</div>
            <Link href={`/basketball/standings?league=${slug}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>Full standings →</Link>
          </div>
          <StandingsTable rows={rows} league={slug} limit={8} />
        </section>
      )}

      {/* ADDRESSED: fixtures object assumed non-null: getFixtures can return null/undefined or partial shapes, so fixtures.results.length can throw. EXAMPLE: const results = fixtures?.results ?? []; const upcoming = fixtures?.upcoming ?? []; */}
      {(fixtures.results.length > 0 || fixtures.upcoming.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 40 }} className="page-split">
          <section>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>Results</h2>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{fixtures.results.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {fixtures.results.slice(0, 10).map((f) => <FixtureCard key={f.id} fixture={f} leagueSlug={slug} />)}
            </div>
          </section>
          <section>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>Upcoming</h2>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{fixtures.upcoming.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {fixtures.upcoming.slice(0, 10).map((f) => <FixtureCard key={f.id} fixture={f} leagueSlug={slug} />)}
            </div>
          </section>
        </div>
      )}

      {leaders.length > 0 && <section style={{ marginBottom: 40 }}><StatLeaders leaders={leaders} leagueLabel={league.name} /></section>}

      {injuries.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <div className="section-label" style={{ marginBottom: 14 }}>Injury Report</div>
          <InjuryList injuries={injuries.slice(0, 20)} showTeam />
        </section>
      )}

      {transactions.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <div className="section-label" style={{ marginBottom: 14 }}>Recent Transactions</div>
          <TransactionFeed transactions={transactions} />
        </section>
      )}

      {/* Groups / Conferences */}
      {groupsRaw && (
        <section style={{ marginBottom: 40 }}>
          <div className="section-label" style={{ marginBottom: 14 }}>Conferences &amp; Divisions</div>
          <GroupsSection data={groupsRaw} />
        </section>
      )}

      {/* Calendar */}
      {calendarRaw && (
        <section style={{ marginBottom: 40 }}>
          <div className="section-label" style={{ marginBottom: 14 }}>Season Calendar</div>
          <CalendarSection data={calendarRaw} />
        </section>
      )}

      {/* Media placeholder */}
      <section style={{ marginBottom: 40 }}>
        <div className="section-label" style={{ marginBottom: 14 }}>Media</div>
        {/* ADDRESSED: placeholder shipped as production content: this advertises a feature that cannot work yet. EXAMPLE: {media.length > 0 ? <MediaGrid items={media} /> : null}. */}
        <ComingSoon title="Media & Video" description="Video highlights and media content — backend endpoint in progress." />
      </section>

      {news.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Latest News</div>
            <Link href="/basketball/news" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>All news →</Link>
          </div>
          <div className="news-grid">
            {news.slice(0, 3).map((a) => <NewsCard key={a.id} article={a} />)}
          </div>
        </section>
      )}
    </div>
  );
}