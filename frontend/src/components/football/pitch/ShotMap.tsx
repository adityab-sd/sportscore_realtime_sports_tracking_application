"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import PitchBackground, { px, py } from "./PitchBackground";
import { isShot, type PlayPoint, type PlayResult } from "@/types/plays";

/**
 * ShotMap — ESPN-style post-match shot map.
 *
 * Key behaviours (matching ESPN):
 *  - Teams attack OPPOSITE ends. ESPN reports every shot from the shooting
 *    team's own attacking perspective (all near fx≈1). We mirror the HOME team
 *    to the LEFT goal and keep AWAY on the RIGHT, so it reads like a real pitch.
 *  - Distinct SHAPE icons per result: goal = soccer ball, save = slashed circle,
 *    off-target = hollow ring, block = bullseye. Outlines are team-coloured.
 *  - Trajectory line from the shot toward the goal for the active shot.
 *  - Penalties render on the penalty spot.
 *
 * Data: plays[] from matchDetail, filtered to shots. Static once match ends.
 */

const COLORS = {
  goal: "#16a34a",
  saved: "#2563eb",
  off: "#f59e0b",
  block: "#64748b",
};

function isPenalty(s: PlayPoint): boolean {
  return /penalty|pen\b/i.test(s.type) || /penalty/i.test(s.text);
}

/** Marker position — RAW coordinates, no mirroring. ESPN's fx/fy already place
 *  each team's shots on the correct side of the pitch, so we plot them directly
 *  (this matches the original working shot map). */
function shotXY(s: PlayPoint) {
  return { x: px(s.fx), y: py(s.fy) };
}

/** Approximate shot distance in yards. ESPN field coords are 0..1 of a pitch
 *  that's ~115 yds long × ~74 yds wide. Distance is from the shot to the centre
 *  of the goal it's attacking. */
function shotDistanceYards(s: PlayPoint): number | null {
  if (!(s.fx > 0 || s.fy > 0)) return null;
  const PITCH_LEN = 115;
  const PITCH_WID = 74;
  // Goal centre in the shooting team's own perspective is at fx≈1, fy≈0.5.
  const dxYds = (1 - s.fx) * PITCH_LEN;
  const dyYds = (s.fy - 0.5) * PITCH_WID;
  return Math.round(Math.sqrt(dxYds * dxYds + dyYds * dyYds));
}

/** Situation: Penalty / Free Kick / Corner / Regular Play — inferred from the
 *  play type and commentary text (ESPN doesn't send a dedicated field here). */
function situationFor(s: PlayPoint): string {
  const t = `${s.type} ${s.text}`.toLowerCase();
  if (/penalty/.test(t)) return "Penalty";
  if (/free[ -]?kick/.test(t)) return "Free Kick";
  if (/corner/.test(t)) return "From Corner";
  if (/counter/.test(t)) return "Counter";
  return "Regular Play";
}

/** Shot type: Right Foot / Left Foot / Header — parsed from commentary text. */
function shotTypeFor(s: PlayPoint): string {
  const t = s.text.toLowerCase();
  if (/header|head/.test(t)) return "Header";
  if (/left[ -]?foot/.test(t)) return "Left Foot";
  if (/right[ -]?foot/.test(t)) return "Right Foot";
  return "—";
}

function labelFor(result: PlayResult): string {
  if (result === "goal") return "Goal";
  if (result === "shot-on-target") return "Save";
  if (result === "shot-off-target") return "Off Target";
  if (result === "shot-blocked") return "Block";
  return "Shot";
}

function iconColorFor(result: PlayResult): string {
  if (result === "goal") return COLORS.goal;
  if (result === "shot-on-target") return COLORS.saved;
  if (result === "shot-off-target") return COLORS.off;
  if (result === "shot-blocked") return COLORS.block;
  return COLORS.saved;
}

/* ── Result shape icons ─────────────────────────────────────────────────────
 * goal  → white disc + ball emoji     save  → white disc + diagonal slash
 * off   → hollow ring                 block → bullseye (disc + inner dot)     */
function ResultIcon({
  result, cx, cy, r, color, selected,
}: {
  result: PlayResult; cx: number; cy: number; r: number; color: string; selected: boolean;
}) {
  const sw = selected ? 2.4 : 2;
  // Soft white halo behind every marker so it pops off the grass (ESPN look).
  const halo = <circle cx={cx} cy={cy} r={r + 1.5} fill="#fff" opacity="0.9" />;

  if (result === "goal") {
    // Soccer ball (SVG path) in a white disc with a team-coloured ring.
    const s = (r * 2) / 385; // scale the 385x385 ball path to fit radius r
    return (
      <g>
        {halo}
        <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={color} strokeWidth={sw} />
        <g transform={`translate(${cx - r}, ${cy - r}) scale(${s})`} style={{ pointerEvents: "none" }}>
          <path fill="#111" d="M192.5,0C86.355,0,0,86.355,0,192.5C0,298.645,86.355,385,192.5,385C298.645,385,385,298.645,385,192.5 C385,86.355,298.645,0,192.5,0z M306.912,115.531l-65.753,37.963l-39.207-22.638V54.932l38.601-22.286 c24.608,7.418,47.513,20.692,66.359,38.457V115.531L306.912,115.531z M201.952,330.066v-75.924l39.207-22.637l65.753,37.963v44.428 c-18.848,17.766-41.751,31.038-66.359,38.457L201.952,330.066z M359.408,192.5c0,12.918-1.494,25.801-4.443,38.311L316.361,253.1 l-65.752-37.963v-45.271l65.752-37.962l38.604,22.287C357.914,166.699,359.408,179.582,359.408,192.5z M78.088,269.469 l65.753-37.963l39.206,22.637v75.924l-38.601,22.287c-24.608-7.419-47.512-20.691-66.358-38.457V269.469z M183.047,54.933v75.924 l-39.206,22.638l-65.753-37.963V71.105c18.847-17.764,41.75-31.038,66.358-38.457L183.047,54.933z M134.393,169.864v45.271 l-65.754,37.962l-38.604-22.287c-2.948-12.508-4.442-25.391-4.442-38.312s1.494-25.804,4.442-38.311l38.604-22.287L134.393,169.864 z" />
        </g>
      </g>
    );
  }
  if (result === "shot-off-target") {
    // Hollow ring — empty centre (grass shows through), team-coloured outline.
    return (
      <g>
        {halo}
        <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={color} strokeWidth={sw} />
      </g>
    );
  }
  if (result === "shot-blocked") {
    // Block = slashed circle (⊘).
    return (
      <g>
        {halo}
        <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={color} strokeWidth={sw} />
        <line x1={cx - r * 0.62} y1={cy - r * 0.62} x2={cx + r * 0.62} y2={cy + r * 0.62} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      </g>
    );
  }
  // save (on-target, not a goal) = bullseye: white disc + solid centre dot.
  return (
    <g>
      {halo}
      <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={color} strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r * 0.42} fill={color} />
    </g>
  );
}

export default function ShotMap({
  plays,
  homeColor = "#003f88",
  awayColor = "#dc2626",
  homeShort = "HOME",
  awayShort = "AWAY",
  league,
  homeTeamId,
  awayTeamId,
}: {
  plays: PlayPoint[];
  homeColor?: string;
  awayColor?: string;
  homeShort?: string;
  awayShort?: string;
  league?: string;
  homeTeamId?: number;
  awayTeamId?: number;
}) {
  const shots = useMemo(() => plays.filter(isShot), [plays]);

  const [team, setTeam] = useState<"all" | "home" | "away">("all");
  const [period, setPeriod] = useState<"all" | 1 | 2>("all");
  const [result, setResult] = useState<PlayResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      shots.filter((s) => {
        if (team !== "all" && s.team !== team) return false;
        if (period !== "all" && s.period !== period) return false;
        if (result && s.result !== result) return false;
        return true;
      }),
    [shots, team, period, result]
  );

  const selected = selectedId ? shots.find((s) => s.id === selectedId) ?? null : null;
  const active = selected ?? (hoverId ? shots.find((s) => s.id === hoverId) ?? null : null);
  const selTeamColor = selected?.team === "home" ? homeColor : awayColor;

  const teamColor = (t: PlayPoint["team"]) =>
    t === "home" ? homeColor : t === "away" ? awayColor : "#94a3b8";

  const chip = (on: boolean): React.CSSProperties => ({
    padding: "6px 12px", borderRadius: 20,
    border: `1px solid ${on ? "var(--navy)" : "var(--border)"}`,
    background: on ? "var(--navy)" : "var(--white)",
    color: on ? "#fff" : "var(--text-secondary)",
    fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
  });

  const resultChips: { key: PlayResult; label: string; color: string }[] = [
    { key: "goal", label: "Goal", color: COLORS.goal },
    { key: "shot-on-target", label: "Save", color: COLORS.saved },
    { key: "shot-off-target", label: "Off Target", color: COLORS.off },
    { key: "shot-blocked", label: "Block", color: COLORS.block },
  ];

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: "clamp(12px,3vw,18px)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>
        Shot Map
      </div>

      {/* Period + team filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <button style={chip(period === "all")} onClick={() => setPeriod("all")}>All Periods</button>
        <button style={chip(period === 1)} onClick={() => setPeriod(1)}>1st Half</button>
        <button style={chip(period === 2)} onClick={() => setPeriod(2)}>2nd Half</button>
        <span style={{ width: 1, background: "var(--border)", margin: "0 2px" }} />
        <button style={chip(team === "all")} onClick={() => setTeam("all")}>Both</button>
        <button style={chip(team === "home")} onClick={() => setTeam("home")}>{homeShort}</button>
        <button style={chip(team === "away")} onClick={() => setTeam("away")}>{awayShort}</button>
      </div>

      {/* Result chips with shape icons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {resultChips.map((rc) => {
          const on = result === rc.key;
          const count = filtered.filter((s) => s.result === rc.key).length;
          return (
            <button
              key={rc.key}
              onClick={() => setResult(on ? null : rc.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                border: `1px solid ${on ? rc.color : "var(--border)"}`,
                background: on ? rc.color : "var(--white)",
                color: on ? "#fff" : "var(--text-secondary)",
                fontSize: 12, fontWeight: 600,
              }}
            >
              <svg width="14" height="14" viewBox="-7 -7 14 14" style={{ display: "block" }}>
                <ResultIcon result={rc.key} cx={0} cy={0} r={5.3} color={on ? "#fff" : rc.color} selected={false} />
              </svg>
              {rc.label} <span style={{ opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Pitch */}
      <div style={{ background: "#0d1117", borderRadius: 10, padding: 8 }}>
        <PitchBackground homeShort={homeShort} awayShort={awayShort} onBackgroundClick={() => setSelectedId(null)}>
          {/* Trajectory for the active shot → to its raw end point (f2x/f2y),
              matching the original working shot map. */}
          {active && (active.f2x > 0 || active.f2y > 0) && (
            <line
              x1={px(active.fx)} y1={py(active.fy)}
              x2={px(active.f2x)} y2={py(active.f2y)}
              stroke={iconColorFor(active.result)} strokeWidth="1.6"
              strokeDasharray={active.result === "goal" ? "none" : "4 3"}
              opacity="0.55" strokeLinecap="round"
            />
          )}

          {filtered.map((s) => {
            const { x, y } = shotXY(s);
            const isSel = s.id === selectedId;
            const isHov = s.id === hoverId;
            const base = s.result === "goal" ? 8.5 : 7;
            const r = isSel ? base + 2.5 : isHov ? base + 1.5 : base;
            const color = teamColor(s.team);

            return (
              <g key={s.id}
                style={{ cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); setSelectedId(isSel ? null : s.id); }}
                onMouseEnter={() => setHoverId(s.id)}
                onMouseLeave={() => setHoverId(null)}>
                {(isSel || isHov) && (
                  <circle cx={x} cy={y} r={r + 4} fill="none" stroke={color} strokeWidth="1.2" opacity="0.4" />
                )}
                <ResultIcon result={s.result} cx={x} cy={y} r={r} color={color} selected={isSel} />
                {(isSel || isHov) && (
                  <g style={{ pointerEvents: "none" }}>
                    <rect x={x - 16} y={y - r - 18} width="32" height="14" rx="3" fill="#1e293b" />
                    <text x={x} y={y - r - 9} textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#fff" fontWeight="700">{s.minute}</text>
                  </g>
                )}
              </g>
            );
          })}
        </PitchBackground>
      </div>

      {/* Detail panel */}
      {selected && (
        <ShotDetail
          shot={selected}
          teamColor={selTeamColor}
          teamShort={selected.team === "home" ? homeShort : awayShort}
          teamId={selected.team === "home" ? homeTeamId : awayTeamId}
          league={league}
          index={filtered.findIndex((s) => s.id === selected.id) + 1}
          total={filtered.length}
          onClose={() => setSelectedId(null)}
        />
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "16px 0 4px" }}>
          No shots match these filters.
        </div>
      )}
    </div>
  );
}

function ShotDetail({
  shot, teamColor, teamShort, teamId, league, index, total, onClose,
}: {
  shot: PlayPoint; teamColor: string; teamShort: string;
  teamId?: number; league?: string;
  index: number; total: number; onClose: () => void;
}) {
  const label = labelFor(shot.result);
  const color = iconColorFor(shot.result);
  const pen = isPenalty(shot);

  const distance = shotDistanceYards(shot);
  const situation = situationFor(shot);
  const shotType = shotTypeFor(shot);

  // Build the player page href only if we have an id (needs backend forwarding).
  const playerHref =
    shot.playerId && league
      ? `/football/player/${shot.playerId}?league=${league}${teamId != null ? `&team=${teamId}` : ""}`
      : null;

  const stats: { value: string; label: string }[] = [
    { value: distance != null ? `${distance} yds` : "—", label: "Distance" },
    { value: situation, label: "Situation" },
    { value: shotType, label: "Shot Type" },
  ];

  // Jersey shirt (simple SVG shirt in the team colour with the number).
  const Shirt = (
    <svg width="46" height="46" viewBox="0 0 46 46" style={{ flexShrink: 0 }}>
      <path
        d="M14 9 L18 6 L28 6 L32 9 L40 14 L36 20 L33 18 L33 40 L13 40 L13 18 L10 20 L6 14 Z"
        fill={teamColor} stroke="#00000022" strokeWidth="1"
      />
      <text x="23" y="27" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="800" fill="#fff">
        {shot.jersey ?? ""}
      </text>
    </svg>
  );

  return (
    <div style={{ marginTop: 12, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, position: "relative", overflow: "hidden" }}>
      <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer", lineHeight: 1, zIndex: 2 }}>×</button>

      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {/* LEFT column — result badge + counter + goal frame */}
        <div style={{ flex: "1 1 260px", minWidth: 240, background: "#f8fafc", padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ padding: "4px 12px", borderRadius: 6, fontSize: 13, fontWeight: 700, color: "#fff", background: color }}>{label}</span>
            {pen && <span style={{ fontSize: 10, fontWeight: 700, color: "#a16207", background: "#fef9c3", padding: "3px 8px", borderRadius: 5 }}>PENALTY</span>}
            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", background: "#e2e8f0", padding: "3px 10px", borderRadius: 6 }}>
              {index} of {total}
            </span>
          </div>
          <GoalFrame shot={shot} color={color} embedded />
        </div>

        {/* RIGHT column — player + stats */}
        <div style={{ flex: "1 1 300px", minWidth: 260, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            {playerHref ? (
              <Link href={playerHref} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", flex: 1 }}>
                {Shirt}
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)" }}>{shot.player ?? "—"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {teamShort}{shot.position ? ` · ${shot.position}` : ""}
                  </div>
                </div>
              </Link>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                {Shirt}
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)" }}>{shot.player ?? "—"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {teamShort}{shot.position ? ` · ${shot.position}` : ""}
                  </div>
                </div>
              </div>
            )}
            <span style={{ fontSize: 20, fontWeight: 800, color: "var(--obsidian)" }}>{shot.minute}</span>
          </div>

          {/* Stats grid (2 rows × 3), xG/xGOT omitted */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px 8px" }}>
            {stats.map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: 17, fontWeight: 800, color: "var(--obsidian)" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {shot.text && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 14 }}>
              {shot.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── ESPN-style goal frame: white panel, black posts, net. Marker placed
 *    relative to the frame; if it's beyond the viewable area → "Shot out of
 *    view" (like ESPN). gx/gy are 0..1 where the shot crossed the goal plane;
 *    gx = horizontal (0 left post … 1 right post), gy = vertical (0 crossbar
 *    … 1 ground). Values outside a sensible band count as "out of view". ── */
function GoalFrame({ shot, color, embedded }: { shot: PlayPoint; color: string; embedded?: boolean }) {
  // Panel geometry (viewBox units).
  const W = 260, H = 150;
  const goalW = 150, goalH = 55;
  const goalX = (W - goalW) / 2;
  const goalY = 78;

  const onTarget = shot.result === "goal" || shot.result === "shot-on-target";
  const isOff = shot.result === "shot-off-target";
  const t = shot.text.toLowerCase();

  // ESPN shows "Shot out of view" for shots too far out to place meaningfully
  // on the goal frame (e.g. a 60-yd effort). Use distance as that trigger.
  const dist = shotDistanceYards(shot);
  const tooFar = dist != null && dist >= 40;

  // Decide where the marker goes.
  let marker: { x: number; y: number } | null = null;
  let outOfView = false;

  if (tooFar && !onTarget) {
    // Far-out off-target shot → out of view, like ESPN.
    outOfView = true;
  } else if (onTarget) {
    // On-target (goal / saved): ESPN's commentary names the corner, e.g.
    // "bottom right corner", "top left corner", "centre of the goal". Trust the
    // TEXT for placement (gx/gy orientation is inconsistent) and fall back to
    // gx/gy only when the text has no direction.
    const top = /top|upper/.test(t);
    const bottom = /bottom|low|lower/.test(t);
    const left = /left/.test(t);
    const right = /right/.test(t);
    const centre = /cent(re|er)/.test(t);

    // horizontal: left → near left post, right → near right post, else centre
    let gxPos = 0.5;
    if (left) gxPos = 0.2;
    else if (right) gxPos = 0.8;
    else if (centre) gxPos = 0.5;

    // vertical: top → high, bottom → low, else mid
    let gyPos = 0.5;
    if (top) gyPos = 0.25;
    else if (bottom) gyPos = 0.78;

    const hasTextDir = top || bottom || left || right || centre;
    if (hasTextDir) {
      marker = { x: goalX + gxPos * goalW, y: goalY + gyPos * goalH };
    } else if (shot.gx > 0 || shot.gy > 0) {
      marker = { x: goalX + shot.gx * goalW, y: goalY + shot.gy * goalH };
    } else {
      // On target but no info → centre of the goal.
      marker = { x: goalX + goalW / 2, y: goalY + goalH / 2 };
    }
  } else if (isOff) {
    // Off-target: gx/gy are unreliable (ball never crossed the line). Derive
    // direction from ESPN's commentary text, and place the marker OUTSIDE the
    // frame (over the bar / wide of a post) — like ESPN does.
    const high = /high|over the bar|too high/.test(t);
    const wideLeft = /wide (to the )?left|misses to the left|left post|too far left/.test(t);
    const wideRight = /wide (to the )?right|misses to the right|right post|too far right/.test(t);
    const closeLeft = /close.*left|just.*left/.test(t);
    const closeRight = /close.*right|just.*right/.test(t);

    const aboveY = goalY - 26;          // above the crossbar
    const wideOffset = 34;              // how far outside a post
    const postLeftX = goalX - wideOffset;
    const postRightX = goalX + goalW + wideOffset;
    const midX = goalX + goalW / 2;

    if (high && (wideLeft || closeLeft)) marker = { x: postLeftX, y: aboveY };
    else if (high && (wideRight || closeRight)) marker = { x: postRightX, y: aboveY };
    else if (high) marker = { x: midX, y: aboveY };
    else if (wideLeft) marker = { x: postLeftX, y: goalY + goalH * 0.4 };
    else if (wideRight) marker = { x: postRightX, y: goalY + goalH * 0.4 };
    else if (closeLeft) marker = { x: goalX - 14, y: goalY + goalH * 0.4 };
    else if (closeRight) marker = { x: goalX + goalW + 14, y: goalY + goalH * 0.4 };
    else outOfView = true; // couldn't parse direction → out of view
  } else {
    // Blocked, or no data → out of view.
    outOfView = true;
  }

  return (
    <div style={{ marginTop: embedded ? 0 : 12 }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Goal placement
      </div>
      <div style={{ background: embedded ? "transparent" : "#f8fafc", border: embedded ? "none" : "1px solid var(--border)", borderRadius: 10, padding: embedded ? 0 : "8px 8px 0" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 300, height: "auto", display: "block", margin: "0 auto" }}>
          {/* Net crosshatch (inside the frame) */}
          <defs>
            <pattern id="gf-net" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="9" stroke="#cbd5e1" strokeWidth="0.8" />
            </pattern>
            <pattern id="gf-net2" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <line x1="0" y1="0" x2="0" y2="9" stroke="#cbd5e1" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect x={goalX} y={goalY} width={goalW} height={goalH} fill="url(#gf-net)" />
          <rect x={goalX} y={goalY} width={goalW} height={goalH} fill="url(#gf-net2)" />

          {/* Black goal posts + crossbar */}
          <path
            d={`M ${goalX} ${goalY + goalH} L ${goalX} ${goalY} L ${goalX + goalW} ${goalY} L ${goalX + goalW} ${goalY + goalH}`}
            fill="none" stroke="#111" strokeWidth="4" strokeLinejoin="miter" strokeLinecap="square"
          />

          {/* Marker or out-of-view label */}
          {outOfView ? (
            <>
              <rect x={W / 2 - 62} y="26" width="124" height="24" rx="6" fill="#e2e8f0" />
              <text x={W / 2} y="38" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="700" fill="#475569">
                Shot out of view
              </text>
            </>
          ) : marker ? (
            <g>
              <circle cx={marker.x} cy={marker.y} r="7.5" fill="#fff" stroke={color} strokeWidth="2.5" />
              {onTarget && <circle cx={marker.x} cy={marker.y} r="3" fill={color} />}
            </g>
          ) : null}
        </svg>
      </div>
    </div>
  );
}