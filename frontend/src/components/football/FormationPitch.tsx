"use client";
import Link from "next/link";
import type { TeamLineup, LineupPlayer, LineupPlayerEvent } from "@/types/lineup";

/**
 * Row-based football pitch. Home team occupies the top half (GK at top,
 * strikers near halfway line); away team the bottom half, reversed.
 * Formation "4-2-3-1" → outfield rows [4, 2, 3, 1]; with GK prepended
 * the eleven starters are sliced into [1, 4, 2, 3, 1].
 */

// ============================================================================
// ADDRESSED: formation validation
// ----------------------------------------------------------------------------
// parseFormation accepts any digits and does not validate that outfield rows sum
// to ten. Bad ESPN strings can silently produce empty/extra rows and misleading
// player placement on the pitch.
//
// EXAMPLE:
//   const rows = f.split("-").map(Number); return rows.every(Number.isFinite) && rows.reduce((a, b) => a + b, 0) === 10 ? rows : [4, 4, 2];
// ============================================================================
function parseFormation(f: string): number[] {
  const digits = f.replace(/[^0-9]/g, "");
  return digits ? digits.split("").map(Number) : [4, 4, 2];
}

function toRows(players: LineupPlayer[], formation: string): LineupPlayer[][] {
  const sizes = [1, ...parseFormation(formation)];
  const rows: LineupPlayer[][] = [];
  let idx = 0;
  for (const size of sizes) {
    rows.push(players.slice(idx, idx + size));
    idx += size;
  }
  return rows;
}

// ─── event badges around a player circle ─────────────────────
function EventBadges({ events }: { events?: LineupPlayerEvent[] }) {
  if (!events?.length) return null;

  const goals = events.filter(e => e.type === "goal").length;
  const hasYellow = events.some(e => e.type === "yellowCard");
  const hasRed = events.some(e => e.type === "redCard");
  const wasSubbed = events.some(e => e.type === "subOff");

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {goals > 0 && (
        <div style={{
            position: "absolute", top: -5, right: -5,
            background: "#fff", borderRadius: "50%",
            width: 15, height: 15, display: "flex",
            alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
            gap: 1, padding: "0 2px",
        }}>
            <svg viewBox="0 0 64 64" width="10" height="10" fill="#0b1220" aria-hidden="true">
            <path d="M61.934 31.992c.021-.713.209-10.904-5.822-17.538c-.268-.593-1.539-2.983-5.641-5.904a41.959 41.959 0 0 0-5.775-3.763l-.008-.004C44.432 4.646 39.43 2 33.359 2c-.461 0-.917.027-1.368.058V2.05c-4.629-.101-9.227 1.09-11.998 2.341c-2.458 1.11-5.187 2.971-5.384 3.115C11.205 9.41 4.75 17.051 4.239 21.1c-2.063 2.637-3.787 14.482.004 21.697c2.658 10.027 12.664 15.045 13.46 15.43c.484.309 5.937 3.68 12.636 3.68c.281 0 1.98.094 2.586.094c7.241 0 17.971-5.104 20.217-9.102c6.171-4.514 9.37-16.147 8.792-20.907M17.758 47.055c-2.869-4.641-4.504-10.705-4.854-12.098c.908-1.361 5.387-7.965 7.939-9.952c1.445.266 7.479 1.374 13.17 2.404c.715 1.853 3.852 10.029 4.75 13.185c-.99 1.174-4.879 5.702-8.708 9.248c-4.065.019-10.979-2.326-12.297-2.787M53.824 14.58c-.012.45-.119 2.05-.885 3.887c-1.521-.777-5.344-2.441-10.584-2.722c-.793-1.171-3.777-5.254-8.49-8.086c.645-1.262 1.543-2.801 2.068-3.27c.17-.048.434-.092.836-.092c2.527 0 6.893 1.655 7.273 1.802c.403.213 8.251 4.439 9.782 8.481M11.773 34.012c-3.423-.584-5.458-1.648-6.066-2.008c-1.273-4.617-.248-9.607-.09-10.322c1.256-2.246 4.832-7.971 7.191-9.058c2.445-.499 5.494.121 6.736.424c-.117 1.615-.342 6.127.326 10.862c-2.706 2.178-6.989 8.447-8.097 10.102M31.685 3.53c.768.057 1.895.225 2.667.454c-.77 1.024-1.559 2.542-1.932 3.292c-1.57.257-7.533 1.397-12.211 4.43c-.943-.25-3.791-.917-6.488-.687c.668-1.293 1.666-2.249 1.773-2.347c.371-.266 7.513-5.263 16.191-5.155v.013m19.096 38.093c-1.17-.048-5.678-.305-10.621-1.466c-.947-3.302-4.074-11.444-4.789-13.296a556.586 556.586 0 0 1 6.928-9.654c5.688.312 9.682 2.387 10.455 2.82c3.295 5.299 4.018 10.711 4.117 11.615c-1.75 5.446-5.211 9.113-6.09 9.981M3.655 28.519c.084 1.266.287 2.599.654 3.917a11.738 11.738 0 0 0-.682 2.651a33.039 33.039 0 0 1 .028-6.568m9.644 23.359c1.508-1.453 3.367-2.867 4.088-3.401c1.63.574 8.324 2.837 12.591 2.837c.727.975 3.104 4.028 6.018 6.362c-1.814 1.775-4.434 2.613-4.897 2.752c-8.127.218-16.042-4.35-17.8-8.55m21.463 8.538c.922-.537 1.883-1.244 2.678-2.139c1.297-.179 6.863-1.137 11.893-4.832c.332.036.879.08 1.49.063c-3.018 2.957-10.382 6.26-16.061 6.908m15.424-8.376c1.807-4.708 1.73-8.258 1.641-9.392c.992-.972 4.396-4.599 6.285-10.113c1.018.17 1.68.429 1.994.574c.109.4.291 1.324.188 2.725c-.77 5.043-3.428 12.6-8.084 15.941c-.468.239-1.292.291-2.024.265" />
            </svg>
            {goals > 1 && (
            <span style={{ fontSize: 8, fontWeight: 800, color: "#0b1220", lineHeight: 1 }}>
                {goals}
            </span>
            )}
        </div>
        )}
      {hasYellow && (
        <div style={{
          position: "absolute", top: -4, left: -6,
          width: 7, height: 10, background: "#F5B500",
          borderRadius: 1, boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
        }} />
      )}
      {hasRed && (
        <div style={{
          position: "absolute", top: -4, left: -6,
          width: 7, height: 10, background: "#DC2626",
          borderRadius: 1, boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
        }} />
      )}
      {wasSubbed && (
        <div style={{
          position: "absolute", bottom: -4, right: -4,
          width: 12, height: 12, borderRadius: "50%",
          background: "#DC2626", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 800, lineHeight: 1,
          boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
        }}>↓</div>
      )}
    </div>
  );
}

// ─── one player token ────────────────────────────────────────
function PlayerToken({
  player, teamId, league, color, nameAbove,
}: {
  player: LineupPlayer;
  teamId: string;
  league: string;
  color: string;
  nameAbove: boolean;
}) {
  const lastName = player.name.split(" ").pop() ?? player.name;

  const nameEl = (
    <div style={{
      fontSize: 10, fontWeight: 600,
      color: "rgba(255,255,255,0.95)",
      textShadow: "0 1px 3px rgba(0,0,0,0.8)",
      textAlign: "center",
      maxWidth: 72, overflow: "hidden",
      textOverflow: "ellipsis", whiteSpace: "nowrap",
      lineHeight: 1.2,
    }}>
      {lastName}
    </div>
  );

  const circleEl = (
    <div style={{ position: "relative" }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: color,
        border: "1.5px solid rgba(255,255,255,0.9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 800, color: "#fff",
        boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
      }}>
        {player.shirtNumber || "-"}
      </div>
      <EventBadges events={player.events} />
    </div>
  );

  return (
    <Link
      href={`/football/player/${player.id}?league=${league}&team=${teamId}`}
      style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 3,
        textDecoration: "none", flexShrink: 0,
      }}
    >
      {nameAbove && nameEl}
      {circleEl}
      {!nameAbove && nameEl}
    </Link>
  );
}

// ─── SVG pitch markings ──────────────────────────────────────
function PitchMarkings() {
  return (
    <svg
      viewBox="0 0 100 140"
      preserveAspectRatio="none"
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        pointerEvents: "none",
      }}
    >
      <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.3" fill="none">
        {/* outline */}
        <rect x="2" y="2" width="96" height="136" />
        {/* halfway */}
        <line x1="2" y1="70" x2="98" y2="70" />
        <circle cx="50" cy="70" r="9" />
        <circle cx="50" cy="70" r="0.6" fill="rgba(255,255,255,0.35)" />
        {/* top penalty */}
        <rect x="26" y="2" width="48" height="16" />
        <rect x="38" y="2" width="24" height="5.5" />
        <path d="M 43 18 A 7 7 0 0 0 57 18" />
        {/* bottom penalty */}
        <rect x="26" y="122" width="48" height="16" />
        <rect x="38" y="132.5" width="24" height="5.5" />
        <path d="M 43 122 A 7 7 0 0 1 57 122" />
      </g>
    </svg>
  );
}

// ─── main component ──────────────────────────────────────────
interface Props {
  home: TeamLineup;
  away: TeamLineup;
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
  league: string;
  homeColor?: string;
  awayColor?: string;
}

export default function FormationPitch({
  home, away, homeTeamId, awayTeamId,
  homeName, awayName, league,
  homeColor = "#DC2626", awayColor = "#0369A1",
}: Props) {
  // ============================================================================
  // ADDRESSED: FormationPitch coordinate assumptions
  // ----------------------------------------------------------------------------
  // Row slicing assumes players are already ordered GK-to-striker for both teams.
  // If the API sends lineup order by shirt number or position code, the visual
  // formation is wrong even though the component still renders.
  //
  // EXAMPLE:
  //   const homeRows = toRows(orderByLineupSlot(home.players), home.formation);
  // ============================================================================
  const homeRows = toRows(home.players, home.formation);
  const awayRows = toRows(away.players, away.formation).slice().reverse();

  return (
    <div style={{
      background: "var(--white)", border: "1px solid var(--border)",
      borderRadius: 12, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: "var(--text-muted)",
          textTransform: "uppercase", letterSpacing: "0.8px",
        }}>Lineups</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 600 }}>
          <span style={{ color: homeColor }}>{homeName} {home.formation}</span>
          <span style={{ color: "var(--border)" }}>·</span>
          <span style={{ color: awayColor }}>{awayName} {away.formation}</span>
        </div>
      </div>

      {/* Pitch */}
      <div style={{
        position: "relative",
        aspectRatio: "10 / 14",
        background: "linear-gradient(180deg, #22703b 0%, #1c5c30 50%, #22703b 100%)",
        padding: "18px 12px",
        display: "flex", flexDirection: "column",
      }}>
        <PitchMarkings />

        {/* Home half — GK at top */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          justifyContent: "space-around", position: "relative", zIndex: 1,
        }}>
          {homeRows.map((row, i) => (
            <div key={`h-${i}`} style={{
              display: "flex", justifyContent: "space-around",
              alignItems: "center", padding: "0 6px",
            }}>
              {row.map(p => (
                <PlayerToken key={p.id} player={p} teamId={homeTeamId} league={league}
                  color={homeColor} nameAbove={false} />
              ))}
            </div>
          ))}
        </div>

        {/* Away half — strikers at top, GK at bottom */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          justifyContent: "space-around", position: "relative", zIndex: 1,
        }}>
          {awayRows.map((row, i) => (
            <div key={`a-${i}`} style={{
              display: "flex", justifyContent: "space-around",
              alignItems: "center", padding: "0 6px",
            }}>
              {row.map(p => (
                <PlayerToken key={p.id} player={p} teamId={awayTeamId} league={league}
                  color={awayColor} nameAbove={true} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}