import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoster, getTeam, getAthleteOverview, getAthleteStats, getAthleteGamelog, getAthleteSplits, getAthleteNews } from "@/lib/api/basketball";
import { leagueName } from "@/types/basketball";
import { AthleteStatTable, AthleteGamelog, AthleteSplits } from "@/components/basketball/AthleteDetailStats";
import PlayerNewsFeed from "@/components/basketball/PlayerNewsFeed";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string; team?: string }>;
}

const posFull: Record<string, string> = {
  PG: "Point Guard", SG: "Shooting Guard", G: "Guard",
  SF: "Small Forward", PF: "Power Forward", F: "Forward",
  C: "Center",
};

export default async function PlayerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { league = "nba", team: teamId } = await searchParams;
  // ============================================================================
  // ADDRESSED: player route depends on unvalidated query state
  // ----------------------------------------------------------------------------
  // /basketball/player/[id] cannot resolve the player unless ?team= is present,
  // and league/team are trusted directly from the URL. Deep links without team
  // 404 even if the athlete id is valid.
  //
  // EXAMPLE:
  //   const safeLeague = LEAGUES.some((l) => l.slug === league) ? league : "nba";
  //   if (!/^\d+$/.test(id)) return notFound();
  // ============================================================================
  if (!teamId) return notFound();

  // ============================================================================
  // ADDRESSED: optional athlete panels reject the whole profile
  // ----------------------------------------------------------------------------
  // Roster/team are needed to identify the player, but stats, gamelog, splits and
  // news are optional sections. Promise.all means one failed stats feed prevents
  // even the basic player header from rendering.
  //
  // EXAMPLE:
  //   const optional = await Promise.allSettled([getAthleteStats(league, id), getAthleteNews(league, id)]);
  // ============================================================================
  const [roster, team, overview, statsRaw, gamelogRaw, splitsRaw, newsRaw] = await Promise.all([
    getRoster(league, teamId),
    getTeam(league, teamId),
    getAthleteOverview(league, id),
    getAthleteStats(league, id),
    getAthleteGamelog(league, id),
    getAthleteSplits(league, id),
    getAthleteNews(league, id),
  ]);

  // ADDRESSED: roster assumed to be an array: if getRoster returns null/undefined for an ESPN miss, .find throws before notFound can run. EXAMPLE: const player = (roster ?? []).find((p) => p.id === id);
  const player = (roster ?? []).find((p) => p.id === id);
  if (!player) return notFound();

  const headshot = overview?.headshot ?? player.headshot;
  const position = overview?.position ?? (player.position ? (posFull[player.position] ?? player.position) : null);
  const age = overview?.age ?? player.age;
  const nationality = overview?.nationality ?? player.nationality;
  const seasonStats = overview?.seasonStats ?? [];

  return (
    <div className="container" style={{ maxWidth: 720, paddingTop: 28, paddingBottom: 40 }}>
      <Link href={`/basketball/team/${teamId}?league=${league}`} style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", display: "inline-block", marginBottom: 24 }}>
        ← {team?.name ?? "Team"}
      </Link>

      {/* Player header */}
      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "36px 24px", textAlign: "center", marginBottom: 24 }}>
        {headshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={headshot} alt={player.name} width={96} height={96} style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", background: "var(--cloud)", margin: "0 auto 16px", display: "block" }} />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#FEF3C7", color: "#B45309", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <span className="score-num" style={{ fontSize: 34 }}>{player.jersey ?? "–"}</span>
          </div>
        )}
        <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 8px", letterSpacing: "-0.3px" }}>{player.name}</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 20px" }}>{team?.name ?? ""} · {leagueName(league)}</p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {position && <Stat label="Position" value={position} />}
          {player.jersey && <Stat label="Number" value={`#${player.jersey}`} />}
          {age != null && <Stat label="Age" value={String(age)} />}
          {nationality && <Stat label="Nationality" value={nationality} />}
        </div>
      </div>

      {/* Season stats overview */}
      {seasonStats.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionLabel text="Season Overview" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
            {/* ADDRESSED: index key for dynamic stats: ESPN can reorder or add season stat cards, causing React to reuse the wrong DOM. EXAMPLE: {seasonStats.map((s) => <div key={s.name ?? s.label}>...</div>)}. */}
            {seasonStats.map((s, i) => (
              <div key={i} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</div>
                <div className="stat-num" style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)" }}>{s.value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Detailed stats */}
      {statsRaw && (
        <section style={{ marginBottom: 24 }}>
          <SectionLabel text="Detailed Stats" />
          <AthleteStatTable data={statsRaw} />
        </section>
      )}

      {/* Game log */}
      {gamelogRaw && (
        <section style={{ marginBottom: 24 }}>
          <SectionLabel text="Game Log" />
          <AthleteGamelog data={gamelogRaw} />
        </section>
      )}

      {/* Splits */}
      {splitsRaw && (
        <section style={{ marginBottom: 24 }}>
          <SectionLabel text="Splits" />
          <AthleteSplits data={splitsRaw} />
        </section>
      )}

      {/* Player news */}
      {newsRaw && (
        <section>
          <SectionLabel text="Player News" />
          <PlayerNewsFeed data={newsRaw} />
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--cloud)", borderRadius: 10, padding: "12px 16px", minWidth: 90 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--obsidian)" }}>{value}</div>
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>{text}</h2>
  );
}