"use client";

import type { RawJSON } from "@/lib/api/basketball";
import TeamLogo from "@/components/football/TeamLogo";

interface Props {
  data: RawJSON;
}

interface ParsedTeam {
  id: string;
  name: string;
  abbreviation: string;
  logo: string;
  labels: string[];
  athletes: {
    id: string;
    name: string;
    shortName: string;
    jersey: string;
    position: string;
    headshot: string | null;
    starter: boolean;
    didNotPlay: boolean;
    reason: string | null;
    stats: string[];
  }[];
  totals: string[];
}

// ============================================================================
// PLEASE review — parser/component boundaries
// ----------------------------------------------------------------------------
// BoxScore parses ESPN payloads, groups roster sections, renders a wide table,
// and handles hover behavior in one file. That makes stat-shape bugs hard to
// isolate and test as basketball endpoints drift.
//
// EXAMPLE:
//   const teams = parseBoxscore(data);
//   return <BoxScoreTable teams={teams} renderPlayerRow={PlayerRow} />;
//
// WHY: Extracting parser + table sections lets unit tests cover payload variants.
// ============================================================================
function parseBoxscore(data: RawJSON): ParsedTeam[] {
  const gpj = data?.gamepackageJSON ?? data;
  const players = gpj?.boxscore?.players ?? gpj?.players ?? [];
  const teams: ParsedTeam[] = [];

  for (const teamBlock of players) {
    const t = teamBlock?.team;
    if (!t) continue;

    // PLEASE review — first statistics block assumption: statistics[0] may be a totals/advanced block, not player box score. EXAMPLE: const statBlock = teamBlock?.statistics?.find((s: RawJSON) => Array.isArray(s.athletes));
    const statBlock = teamBlock?.statistics?.[0];
    if (!statBlock) continue;

    teams.push({
      // PLEASE review — empty ids create duplicate React keys later: missing team ids all become key="". EXAMPLE: id: String(t.id ?? t.uid ?? teamBlock.uid ?? `team-${teams.length}`),
      id: t.id ?? "",
      name: t.displayName ?? t.shortDisplayName ?? "",
      abbreviation: t.abbreviation ?? "",
      logo: t.logo ?? "",
      labels: statBlock.labels ?? statBlock.names ?? [],
      athletes: (statBlock.athletes ?? []).map(
        (a: RawJSON) => ({
          id: a.athlete?.id ?? "",
          name: a.athlete?.displayName ?? "",
          shortName: a.athlete?.shortName ?? a.athlete?.displayName ?? "",
          jersey: a.athlete?.jersey ?? "",
          position: a.athlete?.position?.abbreviation ?? "",
          headshot: a.athlete?.headshot?.href ?? null,
          starter: a.starter ?? false,
          didNotPlay: a.didNotPlay ?? false,
          reason: a.reason ?? null,
          stats: a.stats ?? [],
        }),
      ),
      totals: statBlock.totals ?? [],
    });
  }

  return teams;
}

export default function BoxScore({ data }: Props) {
  const teams = parseBoxscore(data);
  if (teams.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {teams.map((team) => {
        const starters = team.athletes.filter((a) => a.starter && !a.didNotPlay);
        const bench = team.athletes.filter((a) => !a.starter && !a.didNotPlay);
        const dnp = team.athletes.filter((a) => a.didNotPlay);

        return (
          <div
            key={team.id}
            style={{
              background: "var(--white)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Team header */}
            <div style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <TeamLogo logo={team.logo} shortName={team.abbreviation} size={24} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)" }}>
                {team.name}
              </span>
            </div>

            {/* Stats table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px", position: "sticky", left: 0, background: "var(--white)", minWidth: 140 }}>
                      Player
                    </th>
                    {team.labels.map((l) => (
                      <th key={l} style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.3px", minWidth: 40 }}>
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Starters */}
                  {starters.length > 0 && (
                    <tr>
                      <td colSpan={team.labels.length + 1} style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", background: "var(--cloud)" }}>
                        Starters
                      </td>
                    </tr>
                  )}
                  {starters.map((a) => (
                    <PlayerRow key={a.id} athlete={a} colCount={team.labels.length} />
                  ))}

                  {/* Bench */}
                  {bench.length > 0 && (
                    <tr>
                      <td colSpan={team.labels.length + 1} style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", background: "var(--cloud)" }}>
                        Bench
                      </td>
                    </tr>
                  )}
                  {bench.map((a) => (
                    <PlayerRow key={a.id} athlete={a} colCount={team.labels.length} />
                  ))}

                  {/* DNP */}
                  {dnp.length > 0 && (
                    <tr>
                      <td colSpan={team.labels.length + 1} style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", background: "var(--cloud)" }}>
                        Did Not Play
                      </td>
                    </tr>
                  )}
                  {dnp.map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "7px 12px", position: "sticky", left: 0, background: "var(--white)" }}>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.name}</span>
                      </td>
                      <td colSpan={team.labels.length} style={{ padding: "7px 12px", fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                        {a.reason ?? "DNP"}
                      </td>
                    </tr>
                  ))}

                  {/* Totals */}
                  {team.totals.length > 0 && (
                    <tr style={{ borderTop: "2px solid var(--border)", background: "var(--cloud)" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 800, fontSize: 12, color: "var(--obsidian)", position: "sticky", left: 0, background: "var(--cloud)" }}>
                        TOTALS
                      </td>
                      {team.totals.map((v, i) => (
                        <td key={i} className="stat-num" style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, fontSize: 12, color: "var(--obsidian)" }}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlayerRow({
  athlete,
}: {
  athlete: {
    id: string;
    name: string;
    shortName: string;
    jersey: string;
    position: string;
    stats: string[];
  };
  colCount: number;
}) {
  // PLEASE review — points-column assumption: last stat is treated as points, but labels can be reordered by league/feed. EXAMPLE: const ptsIndex = labels.findIndex((l) => l === "PTS");
  const ptsIndex = athlete.stats.length - 1;

  return (
    <tr style={{ borderBottom: "1px solid var(--border)", transition: "background 100ms" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.015)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <td style={{ padding: "7px 12px", position: "sticky", left: 0, background: "var(--white)", minWidth: 140 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", minWidth: 16 }}>
            {athlete.jersey}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {athlete.shortName}
          </span>
          {athlete.position && (
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{athlete.position}</span>
          )}
        </div>
      </td>
      {athlete.stats.map((v, i) => (
        <td
          key={i}
          className="stat-num"
          style={{
            padding: "7px 6px",
            textAlign: "center",
            fontSize: 12,
            color: i === ptsIndex ? "var(--obsidian)" : "var(--text-secondary)",
            fontWeight: i === ptsIndex ? 700 : 400,
          }}
        >
          {v}
        </td>
      ))}
    </tr>
  );
}
