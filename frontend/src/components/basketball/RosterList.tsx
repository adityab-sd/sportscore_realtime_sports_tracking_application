"use client";
import Link from "next/link";
import { useState } from "react";
import { BBPlayer } from "@/lib/api/basketball";

// Country → ISO for flagcdn (subset — same as football; extend as needed)
const COUNTRY_TO_ISO: Record<string, string> = {
  "Argentina":"ar","Australia":"au","Austria":"at","Bahamas":"bs","Belgium":"be",
  "Bosnia and Herzegovina":"ba","Brazil":"br","Cameroon":"cm","Canada":"ca","China":"cn",
  "Congo":"cg","Croatia":"hr","Czech Republic":"cz","Czechia":"cz","Denmark":"dk",
  "Dominican Republic":"do","Finland":"fi","France":"fr","Germany":"de","Ghana":"gh",
  "Greece":"gr","Israel":"il","Italy":"it","Ivory Coast":"ci","Jamaica":"jm","Japan":"jp",
  "Latvia":"lv","Lithuania":"lt","Mali":"ml","Mexico":"mx","Montenegro":"me",
  "Netherlands":"nl","New Zealand":"nz","Nigeria":"ng","North Macedonia":"mk","Norway":"no",
  "Poland":"pl","Portugal":"pt","Puerto Rico":"pr","Russia":"ru","Senegal":"sn","Serbia":"rs",
  "Slovakia":"sk","Slovenia":"si","South Sudan":"ss","Spain":"es","Sudan":"sd",
  "Sweden":"se","Switzerland":"ch","Turkey":"tr","Ukraine":"ua","United Kingdom":"gb",
  "United States":"us","United States of America":"us","Venezuela":"ve",
};

function FlagImg({ nationality }: { nationality: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!nationality) return <Fallback />;
  const code = COUNTRY_TO_ISO[nationality];
  if (!code || failed) return <Fallback label={nationality.slice(0, 2).toUpperCase()} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      alt={nationality}
      title={nationality}
      width={28} height={20}
      onError={() => setFailed(true)}
      style={{ width: 28, height: 20, borderRadius: 3, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }}
    />
  );
}

function Fallback({ label }: { label?: string }) {
  return (
    <div style={{ width: 28, height: 20, borderRadius: 3, background: "var(--cloud)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", flexShrink: 0 }}>
      {label ?? "-"}
    </div>
  );
}

const POSITION_GROUPS = [
  { key: ["PG","SG","G"],       label: "Guards"   },
  { key: ["SF","PF","F"],       label: "Forwards" },
  { key: ["C"],                 label: "Centers"  },
];

function sortByJersey(players: BBPlayer[]) {
  return [...players].sort((a,b) => (a.jersey ? parseInt(a.jersey) : 999) - (b.jersey ? parseInt(b.jersey) : 999));
}

function groupRoster(roster: BBPlayer[]) {
  const groups: { label: string; players: BBPlayer[] }[] = [];
  for (const g of POSITION_GROUPS) {
    const players = sortByJersey(roster.filter(p => p.position && g.key.includes(p.position)));
    if (players.length > 0) groups.push({ label: g.label, players });
  }
  const assigned = new Set(groups.flatMap(g => g.players.map(p => p.id)));
  const rest = sortByJersey(roster.filter(p => !assigned.has(p.id)));
  if (rest.length > 0) groups.push({ label: "Other", players: rest });
  return groups;
}

interface Props { roster: BBPlayer[]; league: string; teamId: string; }

export default function RosterList({ roster, league, teamId }: Props) {
  const grouped = groupRoster(roster);
  if (roster.length === 0) return <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Roster data unavailable.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {grouped.map(({ label, players }) => (
        <section key={label}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0, letterSpacing: "-0.3px" }}>{label}</h3>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{players.length}</span>
          </div>

          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            {players.map((p, i) => (
              <Link key={p.id} href={`/basketball/player/${p.id}?league=${league}&team=${teamId}`} style={{ textDecoration: "none" }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: i < players.length - 1 ? "1px solid var(--border)" : "none", transition: "background 100ms" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 14, fontWeight: 800, color: p.jersey ? "var(--obsidian)" : "var(--border)", width: 28, textAlign: "center", flexShrink: 0, letterSpacing: "-0.5px" }}>
                    {p.jersey ?? "-"}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </div>
                    {(p.nationality || p.age || p.position) && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                        {[p.position, p.age ? `${p.age} yrs` : null, p.nationality].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>

                  <FlagImg nationality={p.nationality} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}