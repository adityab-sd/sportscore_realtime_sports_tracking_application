"use client";
import Link from "next/link";
import { useState } from "react";
import { ESPNPlayer } from "@/lib/api/espn";

// ============================================================================
// ADDRESSED: hard-coded country registry
// ----------------------------------------------------------------------------
// Maintaining ISO codes by hand in the component is brittle and incomplete for
// ESPN nationality variants. Missing countries render two-letter fallbacks even
// when standardized metadata could supply the correct flag.
//
// EXAMPLE:
//   const code = countryCodeFromNationality(nationality) ?? null;
// ============================================================================
// ── Country name → ISO 3166-1 alpha-2 code ──────────────────────────────────
// flagcdn.com serves flags at https://flagcdn.com/w40/{code}.png
const COUNTRY_TO_ISO: Record<string, string> = {
  "Afghanistan":"af","Albania":"al","Algeria":"dz","Andorra":"ad","Angola":"ao",
  "Argentina":"ar","Armenia":"am","Australia":"au","Austria":"at","Azerbaijan":"az",
  "Bahrain":"bh","Belgium":"be","Bolivia":"bo","Bosnia and Herzegovina":"ba",
  "Bosnia & Herzegovina":"ba","Brazil":"br","Bulgaria":"bg","Burkina Faso":"bf",
  "Cameroon":"cm","Canada":"ca","Chile":"cl","China":"cn","Colombia":"co",
  "Congo":"cg","Costa Rica":"cr","Croatia":"hr","Czech Republic":"cz","Czechia":"cz",
  "Denmark":"dk","Dominican Republic":"do","Ecuador":"ec","Egypt":"eg",
  "El Salvador":"sv","England":"gb-eng","Estonia":"ee","Ethiopia":"et",
  "Finland":"fi","France":"fr","Gabon":"ga","Georgia":"ge","Germany":"de",
  "Ghana":"gh","Greece":"gr","Guatemala":"gt","Guinea":"gn","Honduras":"hn",
  "Hungary":"hu","Iceland":"is","India":"in","Indonesia":"id","Iran":"ir","Iraq":"iq",
  "Ireland":"ie","Republic of Ireland":"ie","Israel":"il","Italy":"it",
  "Ivory Coast":"ci","Jamaica":"jm","Japan":"jp","Jordan":"jo","Kazakhstan":"kz",
  "Kenya":"ke","Kosovo":"xk","Latvia":"lv","Lebanon":"lb","Libya":"ly",
  "Lithuania":"lt","Luxembourg":"lu","Mali":"ml","Malta":"mt","Mexico":"mx",
  "Moldova":"md","Montenegro":"me","Morocco":"ma","Mozambique":"mz",
  "Netherlands":"nl","New Zealand":"nz","Nicaragua":"ni","Nigeria":"ng",
  "North Macedonia":"mk","Northern Ireland":"gb-nir","Norway":"no","Oman":"om",
  "Panama":"pa","Paraguay":"py","Peru":"pe","Poland":"pl","Portugal":"pt",
  "Qatar":"qa","Romania":"ro","Russia":"ru","Saudi Arabia":"sa","Scotland":"gb-sct",
  "Senegal":"sn","Serbia":"rs","Sierra Leone":"sl","Slovakia":"sk","Slovenia":"si",
  "South Africa":"za","South Korea":"kr","Korea Republic":"kr","Spain":"es",
  "Sudan":"sd","Sweden":"se","Switzerland":"ch","Syria":"sy","Tanzania":"tz",
  "Togo":"tg","Trinidad and Tobago":"tt","Tunisia":"tn","Turkey":"tr",
  "Uganda":"ug","Ukraine":"ua","United States":"us","United States of America":"us",
  "Uruguay":"uy","Venezuela":"ve","Wales":"gb-wls","Zambia":"zm","Zimbabwe":"zw",
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
      width={28}
      height={20}
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

// ── Position grouping ────────────────────────────────────────────────────────
const POSITION_GROUPS = [
  { key: ["G","GK"],                             label: "Goalkeepers" },
  { key: ["D","DF","CB","LB","RB","LWB","RWB"],  label: "Defenders"   },
  { key: ["M","MF","CM","CDM","CAM","LM","RM"],  label: "Midfielders" },
  { key: ["F","FW","ST","CF","LW","RW","SS"],    label: "Attackers"   },
];

// ============================================================================
// ADDRESSED: jersey sort NaN handling
// ----------------------------------------------------------------------------
// parseInt can return NaN for values like "--" or "A", and Array.sort with NaN
// produces unstable ordering. Normalize non-numeric jerseys to the end.
//
// EXAMPLE:
//   const jersey = Number.parseInt(p.jersey ?? "", 10); return Number.isFinite(jersey) ? jersey : 999;
// ============================================================================
function sortByJersey(players: ESPNPlayer[]) {
  return [...players].sort((a,b) => (Number.isFinite(parseInt(a.jersey ?? "", 10)) ? parseInt(a.jersey!, 10) : 999) - (Number.isFinite(parseInt(b.jersey ?? "", 10)) ? parseInt(b.jersey!, 10) : 999));
}

function groupRoster(roster: ESPNPlayer[]) {
  const groups: { label: string; players: ESPNPlayer[] }[] = [];
  for (const g of POSITION_GROUPS) {
    const players = sortByJersey(roster.filter(p => p.position && g.key.includes(p.position)));
    if (players.length > 0) groups.push({ label: g.label, players });
  }
  const assigned = new Set(groups.flatMap(g => g.players.map(p => p.id)));
  const rest = sortByJersey(roster.filter(p => !assigned.has(p.id)));
  if (rest.length > 0) groups.push({ label: "Other", players: rest });
  return groups;
}

interface Props { roster: ESPNPlayer[]; league: string; teamId: string; }

export default function SquadList({ roster, league, teamId }: Props) {
  const grouped = groupRoster(roster);
  if (roster.length === 0) return <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Squad data unavailable.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {grouped.map(({ label, players }) => (
        <section key={label}>
          {/* Section header - plain, not boxed */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0, letterSpacing: "-0.3px" }}>
              {label}
            </h3>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
              {players.length}
            </span>
          </div>

          {/* Rows */}
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            {players.map((p, i) => {
              return (
                <Link key={p.id} href={`/football/player/${p.id}?league=${league}&team=${teamId}`} style={{ textDecoration: "none" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: i < players.length - 1 ? "1px solid var(--border)" : "none", transition: "background 100ms" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Jersey number */}
                    <span style={{ fontSize: 14, fontWeight: 800, color: p.jersey ? "var(--obsidian)" : "var(--border)", width: 28, textAlign: "center", flexShrink: 0, letterSpacing: "-0.5px" }}>
                      {p.jersey ?? "-"}
                    </span>

                    {/* Name + age + country */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name}
                      </div>
                      {(p.nationality || p.age) && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                          {[p.age ? `${p.age} yrs` : null, p.nationality].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>

                    {/* National flag - right side */}
                    <FlagImg nationality={p.nationality} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}