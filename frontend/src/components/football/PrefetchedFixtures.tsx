"use client";
import { useSignalR } from "@/hooks/useSignalR";
import { ESPNFixture } from "@/lib/api/espn";
import { LEAGUES } from "@/types/football";
import FixtureCard from "./FixtureCard";
import LeagueBanner from "./LeagueBanner";

interface SlugFixture extends ESPNFixture {
  _slug?: string;
}

interface Props {
  results: SlugFixture[];
  upcoming: SlugFixture[];
}

const PREVIEW_PER_LEAGUE = 4;

/** Group fixtures by their _slug, ordered by the LEAGUES registry so cards appear consistently. */
function groupBySlug(fixtures: SlugFixture[]): { slug: string; name: string; fixtures: SlugFixture[] }[] {
  const buckets = new Map<string, SlugFixture[]>();
  for (const f of fixtures) {
    const key = f._slug ?? "other";
    const arr = buckets.get(key) ?? [];
    arr.push(f);
    buckets.set(key, arr);
  }
  // Preserve LEAGUES order (World Cup first, then UCL, then domestic top leagues).
  return LEAGUES
    .filter(l => buckets.has(l.slug))
    .map(l => ({ slug: l.slug, name: l.name, fixtures: buckets.get(l.slug)! }));
}

function LeagueSection({
  title,
  groups,
  emptyText,
}: {
  title: string;
  groups: { slug: string; name: string; fixtures: SlugFixture[] }[];
  emptyText: string;
}) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0, letterSpacing: "-0.3px" }}>
          {title}
        </h2>
      </div>
      {groups.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{emptyText}</p>
      ) : (
        groups.map(g => {
          const visible = g.fixtures.slice(0, PREVIEW_PER_LEAGUE);
          const hidden  = g.fixtures.length - visible.length;
          return (
            <div key={g.slug} style={{ marginBottom: 22 }}>
              <LeagueBanner name={g.name} slug={g.slug} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {visible.map(f => <FixtureCard key={f.id} fixture={f} leagueSlug={g.slug} />)}
              </div>
              {hidden > 0 && (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
                  + {hidden} more
                </div>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}

/**
 * Renders server-prefetched fixtures (results + upcoming), grouped per league,
 * but ONLY while SignalR hasn't streamed any live data yet. Once SignalR delivers
 * matches, this section disappears - the live data takes over above.
 */
export default function PrefetchedFixtures({ results, upcoming }: Props) {
  const { matches, state } = useSignalR();

  // Hide once SignalR has delivered at least one football match. Basketball matches don't count.
  const hasLiveData = matches.some(m => !m.sport || m.sport === "football");
  if (hasLiveData) return null;

  // Also hide if the feed is connected but explicitly empty AND we have nothing to show.
  if (results.length === 0 && upcoming.length === 0) return null;

  const resultGroups   = groupBySlug(results);
  const upcomingGroups = groupBySlug(upcoming);

  return (
    <div>
      <div style={{
        marginBottom: 16, padding: "10px 14px", background: "var(--cloud)",
        borderRadius: 8, fontSize: 12, color: "var(--text-muted)",
      }}>
        {state === "connecting"
          ? "Connecting to live feed… showing cached fixtures meanwhile."
          : "Showing cached fixtures - live updates will replace this once connected."}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }} className="page-split">
        <LeagueSection title="Recent Results"    groups={resultGroups}   emptyText="No recent results available." />
        <LeagueSection title="Upcoming Fixtures" groups={upcomingGroups} emptyText="No upcoming fixtures available." />
      </div>
    </div>
  );
}