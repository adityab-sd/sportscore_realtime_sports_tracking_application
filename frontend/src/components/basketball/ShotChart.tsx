"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import type { RawJSON } from "@/lib/api/basketball";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface Shot {
  id: string;
  x: number;
  y: number;
  made: boolean;
  quarter: number;
  clock: string;
  text: string;
  player: string;
  teamId: string;
  shotType: string; // "2pt" | "3pt" | "dunk" | "layup" | "mid-range"
  distance: number; // feet from basket
}

interface Props {
  data: RawJSON;
  homeTeamId: string;
  awayTeamId: string;
  homeColor?: string;
  awayColor?: string;
  homeShort: string;
  awayShort: string;
  homeLogo?: string;
  awayLogo?: string;
}

/* ------------------------------------------------------------------ */
/* Parse shots from ESPN CDN play-by-play                             */
/* ------------------------------------------------------------------ */

function classifyShot(text: string, distance: number): string {
  const t = text.toLowerCase();
  if (t.includes("dunk")) return "Dunk";
  if (t.includes("layup") || t.includes("lay up")) return "Layup";
  if (t.includes("three point") || t.includes("3pt") || t.includes("three-point") || distance >= 22) return "3PT";
  if (t.includes("hook")) return "Hook";
  if (t.includes("tip")) return "Tip-in";
  if (t.includes("jumper") || t.includes("jump shot")) return "Jumper";
  if (t.includes("pullup") || t.includes("pull-up")) return "Pull-up";
  if (t.includes("fadeaway") || t.includes("fade away")) return "Fadeaway";
  if (t.includes("floating") || t.includes("floater")) return "Floater";
  if (t.includes("turnaround")) return "Turnaround";
  if (t.includes("step back") || t.includes("stepback")) return "Step-back";
  if (t.includes("alley oop")) return "Alley-oop";
  if (t.includes("finger roll")) return "Finger Roll";
  if (t.includes("driving")) return "Driving";
  if (t.includes("cutting")) return "Cutting";
  if (distance <= 4) return "At Rim";
  if (distance <= 14) return "Mid-Range";
  return "Field Goal";
}

function extractDistance(text: string): number {
  const match = text.match(/(\d+)-foot/i) ?? text.match(/from (\d+) feet/i);
  return match ? Number(match[1]) : 0;
}

/** Extract player name from play-by-play text as last-resort fallback */
function extractPlayerFromText(text: string): string {
  if (!text) return "";
  const m = text.match(/^(.+?)\s+(?:makes|misses|made|missed|blocks)/i);
  return m ? m[1].trim() : "";
}

// ============================================================================
// PLEASE review — god component / extraction boundary
// ----------------------------------------------------------------------------
// ShotChart parses raw ESPN plays, classifies shots, draws a full SVG court,
// manages filters, tooltip state, and renders logos/stats in one 1000+ line
// component. A coordinate bug or payload change is hard to test in isolation.
//
// EXAMPLE:
//   const shots = parseShots(data);
//   return <ShotChartView shots={shots} filters={filters} court={NBA_COURT} />;
//
// WHY: Split parser, coordinate mapper, filters, and SVG view into testable units.
// ============================================================================
function parseShots(data: RawJSON): Shot[] {
  const gpj = data?.gamepackageJSON ?? data;
  const rawPlays: RawJSON[] = gpj?.plays ?? gpj?.items ?? [];
  const shots: Shot[] = [];

  for (const p of rawPlays) {
    if (!p.shootingPlay && !p.scoringPlay) continue;
    const coord = p.coordinate ?? p.coordinates;
    if (!coord || coord.x == null || coord.y == null) continue;

    const typeText = (p.type?.text ?? "").toLowerCase();
    if (typeText.includes("free throw")) continue;

    /* Player name — ESPN nests this differently across endpoints */
    const playerName =
      p.participants?.[0]?.athlete?.displayName ??
      p.participants?.[0]?.athlete?.shortName ??
      p.participants?.[0]?.displayName ??
      p.participants?.[0]?.name ??
      p.athlete?.displayName ??
      p.athlete?.shortName ??
      p.player?.displayName ??
      p.player?.name ??
      extractPlayerFromText(p.text ?? "");

    const fullText = p.text ?? "";
    const dist = extractDistance(fullText);

    shots.push({
      id: p.id ?? String(shots.length),
      // PLEASE review — coordinate numeric conversion can produce NaN: Math.max/min later will keep NaN and SVG circles render invalid positions. EXAMPLE: const x = Number(coord.x); const y = Number(coord.y); if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      x: Number(coord.x),
      y: Number(coord.y),
      made: p.scoringPlay ?? typeText.includes("made"),
      quarter: p.period?.number ?? 1,
      clock: p.clock?.displayValue ?? "",
      text: fullText,
      player: playerName,
      teamId: p.team?.id ?? "",
      shotType: classifyShot(fullText, dist),
      distance: dist,
    });
  }

  return shots;
}

/* ------------------------------------------------------------------ */
/* Court constants (full court, 940×500 viewBox, 10 units = 1 foot)   */
/* ------------------------------------------------------------------ */

// PLEASE review — NBA-only court constants: 94x50 ft geometry is hard-coded, so NCAA/WNBA court/arc variants render inaccurately. EXAMPLE: const court = league === "ncaam" ? NCAA_COURT : NBA_COURT;
const CW = 940;
const CH = 500;
const MID = CW / 2;

/* ------------------------------------------------------------------ */
/* Court SVG — detailed, ESPN-accurate rendering                      */
/* ------------------------------------------------------------------ */

function CourtSVG({
  homeShort,
  awayShort,
  homeColor,
  awayColor,
}: {
  homeShort: string;
  awayShort: string;
  homeColor: string;
  awayColor: string;
}) {
  const COURT_BG = "#E8DCC8";
  const PAINT_BG = "#DDD0B8";
  const LINE = "#C8B99A";
  const LW = 1.8;

  const basketX = 52; // 5.25 ft from baseline
  const paintW = 190; // 19 ft
  const paintH = 160; // 16 ft
  const paintY = (CH - paintH) / 2;
  const ftRadius = 60; // 6 ft free throw circle
  const arcRadius = 238; // 23.75 ft three-point
  const cornerLen = 140; // 14 ft corner three
  const restrictedR = 40; // 4 ft restricted area
  const centerR = 60; // 6 ft center circle
  const rimR = 9;
  const backboardW = 60; // 6 ft backboard width
  const backboardX = 40; // 4 ft from baseline

  // Hash mark positions along the paint (from baseline)
  // NBA has 4 hash marks on each side of the paint
  const hashPositions = [70, 110, 140, 170]; // approximate positions
  const hashLen = 12; // how far they extend from paint edge

  const s = { fill: "none", stroke: LINE, strokeWidth: LW };

  const paintYTop = paintY;
  const paintYBot = paintY + paintH;

  // Three-point arcs
  const tpCornerY1 = paintY;
  const tpCornerY2 = paintY + paintH;

  const leftArc = `M 0,${tpCornerY1} L ${cornerLen},${tpCornerY1}
    A ${arcRadius},${arcRadius} 0 0,1 ${cornerLen},${tpCornerY2}
    L 0,${tpCornerY2}`;
  const rightArc = `M ${CW},${tpCornerY1} L ${CW - cornerLen},${tpCornerY1}
    A ${arcRadius},${arcRadius} 0 0,0 ${CW - cornerLen},${tpCornerY2}
    L ${CW},${tpCornerY2}`;

  return (
    <g>
      {/* Court surface */}
      <rect x={0} y={0} width={CW} height={CH} fill={COURT_BG} />

      {/* Subtle center line region */}
      <rect x={MID - 1} y={0} width={2} height={CH} fill={LINE} opacity={0.6} />

      {/* ====== LEFT SIDE ====== */}

      {/* Paint fill */}
      <rect x={0} y={paintY} width={paintW} height={paintH} fill={PAINT_BG} />
      {/* Paint outline */}
      <rect x={0} y={paintY} width={paintW} height={paintH} {...s} />

      {/* Inner paint box (smaller box inside paint — 12ft wide) */}
      <rect x={0} y={(CH - 120) / 2} width={paintW} height={120} {...s} strokeDasharray="0" opacity={0.4} />

      {/* Hash marks on paint (outside) */}
      {hashPositions.map((hx, i) => (
        <g key={`lh-${i}`}>
          {/* Top side */}
          <line x1={hx} y1={paintYTop - hashLen} x2={hx} y2={paintYTop} {...s} />
          {/* Bottom side */}
          <line x1={hx} y1={paintYBot} x2={hx} y2={paintYBot + hashLen} {...s} />
        </g>
      ))}

      {/* Free throw circle */}
      <path
        d={`M ${paintW},${CH / 2 - ftRadius} A ${ftRadius},${ftRadius} 0 1,1 ${paintW},${CH / 2 + ftRadius}`}
        {...s}
      />
      <path
        d={`M ${paintW},${CH / 2 + ftRadius} A ${ftRadius},${ftRadius} 0 1,1 ${paintW},${CH / 2 - ftRadius}`}
        {...s}
        strokeDasharray="10,10"
      />

      {/* Restricted area */}
      <path
        d={`M ${basketX},${CH / 2 - restrictedR} A ${restrictedR},${restrictedR} 0 0,1 ${basketX},${CH / 2 + restrictedR}`}
        {...s}
      />
      {/* Close restricted to baseline */}
      <line x1={basketX} y1={CH / 2 - restrictedR} x2={0} y2={CH / 2 - restrictedR} {...s} opacity={0} />

      {/* Backboard */}
      <line
        x1={backboardX}
        y1={CH / 2 - backboardW / 2}
        x2={backboardX}
        y2={CH / 2 + backboardW / 2}
        stroke={LINE}
        strokeWidth={3}
      />

      {/* Rim */}
      <circle cx={basketX} cy={CH / 2} r={rimR} {...s} strokeWidth={2.5} />
      {/* Rim connector to backboard */}
      <line x1={backboardX} y1={CH / 2} x2={basketX - rimR} y2={CH / 2} stroke={LINE} strokeWidth={1.5} />

      {/* Three-point arc */}
      <path d={leftArc} {...s} />

      {/* ====== RIGHT SIDE (mirror) ====== */}

      <rect x={CW - paintW} y={paintY} width={paintW} height={paintH} fill={PAINT_BG} />
      <rect x={CW - paintW} y={paintY} width={paintW} height={paintH} {...s} />
      <rect x={CW - paintW} y={(CH - 120) / 2} width={paintW} height={120} {...s} opacity={0.4} />

      {hashPositions.map((hx, i) => (
        <g key={`rh-${i}`}>
          <line x1={CW - hx} y1={paintYTop - hashLen} x2={CW - hx} y2={paintYTop} {...s} />
          <line x1={CW - hx} y1={paintYBot} x2={CW - hx} y2={paintYBot + hashLen} {...s} />
        </g>
      ))}

      <path
        d={`M ${CW - paintW},${CH / 2 - ftRadius} A ${ftRadius},${ftRadius} 0 1,0 ${CW - paintW},${CH / 2 + ftRadius}`}
        {...s}
      />
      <path
        d={`M ${CW - paintW},${CH / 2 + ftRadius} A ${ftRadius},${ftRadius} 0 1,0 ${CW - paintW},${CH / 2 - ftRadius}`}
        {...s}
        strokeDasharray="10,10"
      />

      <path
        d={`M ${CW - basketX},${CH / 2 - restrictedR} A ${restrictedR},${restrictedR} 0 0,0 ${CW - basketX},${CH / 2 + restrictedR}`}
        {...s}
      />

      <line
        x1={CW - backboardX}
        y1={CH / 2 - backboardW / 2}
        x2={CW - backboardX}
        y2={CH / 2 + backboardW / 2}
        stroke={LINE}
        strokeWidth={3}
      />
      <circle cx={CW - basketX} cy={CH / 2} r={rimR} {...s} strokeWidth={2.5} />
      <line x1={CW - backboardX} y1={CH / 2} x2={CW - basketX + rimR} y2={CH / 2} stroke={LINE} strokeWidth={1.5} />

      <path d={rightArc} {...s} />

      {/* ====== CENTER COURT ====== */}
      <circle cx={MID} cy={CH / 2} r={centerR} {...s} />
      <circle cx={MID} cy={CH / 2} r={20} {...s} />

      {/* Court outline (last, on top) */}
      <rect x={0} y={0} width={CW} height={CH} fill="none" stroke={LINE} strokeWidth={2.5} />

      {/* Team labels on court */}
      <text
        x={MID / 2}
        y={CH / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={awayColor}
        fontSize={42}
        fontWeight={900}
        opacity={0.08}
        style={{ fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: "4px" }}
      >
        {awayShort}
      </text>
      <text
        x={MID + MID / 2}
        y={CH / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={homeColor}
        fontSize={42}
        fontWeight={900}
        opacity={0.08}
        style={{ fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: "4px" }}
      >
        {homeShort}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Tooltip component                                                  */
/* ------------------------------------------------------------------ */

interface TooltipData {
  shot: Shot;
  svgX: number;
  svgY: number;
  color: string;
  teamShort: string;
}

function ShotTooltip({ data, containerRef }: { data: TooltipData | null; containerRef: React.RefObject<HTMLDivElement | null> }) {
  if (!data) return null;

  const { shot, color, teamShort } = data;

  return (
    <div
      style={{
        position: "absolute",
        left: `${(data.svgX / CW) * 100}%`,
        top: `${(data.svgY / CH) * 100}%`,
        transform: "translate(-50%, -120%)",
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: "#1a1a2e",
          color: "#fff",
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 11,
          lineHeight: 1.5,
          whiteSpace: "nowrap",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)",
          border: `2px solid ${color}`,
          minWidth: 160,
        }}
      >
        {/* Player name */}
        <div style={{ fontWeight: 800, fontSize: 13, color, marginBottom: 2, letterSpacing: "-0.3px" }}>
          {shot.player || "Unknown"}
        </div>

        {/* Shot type + result */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: shot.made ? "#4ade80" : "#f87171",
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 600 }}>
            {shot.made ? "Made" : "Missed"} {shot.shotType}
          </span>
        </div>

        {/* Distance */}
        {shot.distance > 0 && (
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>
            {shot.distance} ft from basket
          </div>
        )}

        {/* Quarter + Clock */}
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 }}>
          Q{shot.quarter} · {shot.clock} · {teamShort}
        </div>

        {/* Description */}
        {shot.text && (
          <div
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 9,
              marginTop: 4,
              maxWidth: 220,
              whiteSpace: "normal",
              lineHeight: 1.4,
            }}
          >
            {shot.text}
          </div>
        )}
      </div>
      {/* Arrow */}
      <div
        style={{
          position: "absolute",
          bottom: -6,
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: `6px solid ${color}`,
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shot dot component                                                 */
/* ------------------------------------------------------------------ */

function ShotDot({
  shot,
  cx,
  cy,
  color,
  isHovered,
  onHover,
  onLeave,
}: {
  shot: Shot;
  cx: number;
  cy: number;
  color: string;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const r = isHovered ? 10 : 7;

  return (
    <g
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{ cursor: "pointer" }}
    >
      {/* Hover glow */}
      {isHovered && (
        <circle cx={cx} cy={cy} r={18} fill={color} opacity={0.15} />
      )}

      {/* Main dot */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={shot.made ? color : "transparent"}
        stroke={color}
        strokeWidth={shot.made ? 0 : 2.5}
        opacity={isHovered ? 1 : 0.85}
      />

      {/* Inner dot for missed shots (creates the "open circle" look like ESPN) */}
      {!shot.made && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="#E8DCC8"
          stroke={color}
          strokeWidth={2.5}
          opacity={isHovered ? 1 : 0.85}
        />
      )}

      {/* Made shot — subtle inner highlight */}
      {shot.made && (
        <circle
          cx={cx}
          cy={cy}
          r={r * 0.35}
          fill="rgba(255,255,255,0.3)"
          opacity={isHovered ? 1 : 0}
        />
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Filter pill button                                                 */
/* ------------------------------------------------------------------ */

function FilterPill({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        fontWeight: active ? 700 : 500,
        padding: "5px 12px",
        borderRadius: 20,
        border: active ? `1.5px solid ${color || "var(--obsidian)"}` : "1.5px solid var(--border)",
        background: active ? (color ? `${color}10` : "var(--obsidian)08") : "transparent",
        color: active ? (color || "var(--obsidian)") : "var(--text-secondary)",
        cursor: "pointer",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        fontFamily: "system-ui, -apple-system, sans-serif",
        letterSpacing: "-0.2px",
      }}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ShotChart({
  data,
  homeTeamId,
  awayTeamId,
  homeColor = "#003F88",
  awayColor = "#000000",
  homeShort,
  awayShort,
  homeLogo,
  awayLogo,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const allShots = useMemo(() => parseShots(data), [data]);

  /* Derived filter options */
  const quarters = useMemo(
    () => [...new Set(allShots.map((s) => s.quarter))].sort((a, b) => a - b),
    [allShots]
  );

  const shotTypes = useMemo(
    () => [...new Set(allShots.map((s) => s.shotType))].sort(),
    [allShots]
  );

  const players = useMemo(
    () => [...new Set(allShots.map((s) => s.player).filter(Boolean))].sort(),
    [allShots]
  );

  /* Filter state */
  const [filterQ, setFilterQ] = useState<number | null>(null);
  const [filterPlayer, setFilterPlayer] = useState<string | null>(null);
  const [filterResult, setFilterResult] = useState<"all" | "made" | "missed">("all");
  const [filterShotType, setFilterShotType] = useState<string | null>(null);
  const [filterTeam, setFilterTeam] = useState<"all" | "home" | "away">("all");
  const [hoveredShot, setHoveredShot] = useState<string | null>(null);

  /* Apply filters */
  const filtered = useMemo(() => {
    let s = allShots;
    if (filterQ != null) s = s.filter((sh) => sh.quarter === filterQ);
    if (filterPlayer) s = s.filter((sh) => sh.player === filterPlayer);
    if (filterResult === "made") s = s.filter((sh) => sh.made);
    if (filterResult === "missed") s = s.filter((sh) => !sh.made);
    if (filterShotType) s = s.filter((sh) => sh.shotType === filterShotType);
    if (filterTeam === "home") s = s.filter((sh) => sh.teamId === homeTeamId);
    if (filterTeam === "away") s = s.filter((sh) => sh.teamId === awayTeamId);
    return s;
  }, [allShots, filterQ, filterPlayer, filterResult, filterShotType, filterTeam, homeTeamId, awayTeamId]);

  /* Stats */
  const stats = useMemo(() => {
    const homeMade = filtered.filter((s) => s.teamId === homeTeamId && s.made).length;
    const homeMiss = filtered.filter((s) => s.teamId === homeTeamId && !s.made).length;
    const awayMade = filtered.filter((s) => s.teamId === awayTeamId && s.made).length;
    const awayMiss = filtered.filter((s) => s.teamId === awayTeamId && !s.made).length;
    const homeTotal = homeMade + homeMiss;
    const awayTotal = awayMade + awayMiss;

    return {
      homeMade,
      homeMiss,
      homeTotal,
      homePct: homeTotal > 0 ? ((homeMade / homeTotal) * 100).toFixed(1) : "–",
      awayMade,
      awayMiss,
      awayTotal,
      awayPct: awayTotal > 0 ? ((awayMade / awayTotal) * 100).toFixed(1) : "–",
    };
  }, [filtered, homeTeamId, awayTeamId]);

  /* Coordinate mapping
   * ESPN CDN PBP gives HALF-COURT coordinates oriented vertically:
   *   x = sideline-to-sideline (0–50 ft, court width)
   *   y = baseline-to-halfcourt (0–47 ft, half-court depth)
   * Both teams share the same coordinate space (relative to one basket).
   *
   * We rotate 90° to a horizontal full-court layout and mirror the
   * home team's shots to the right half so each team has its own side.
   *
   * Away team → LEFT basket  (cx grows from left edge)
   * Home team → RIGHT basket (cx grows from right edge, mirrored)
   */
  const mapCoords = useCallback(
    (shot: Shot): { cx: number; cy: number } => {
      const isHome = shot.teamId === homeTeamId;

      // Rotate: y (depth from baseline) → horizontal, x (sideline) → vertical
      let cx: number;
      let cy = shot.x * 10;   // sideline position → vertical (0-500)

      if (isHome) {
        // Mirror to right half: baseline at right edge
        cx = CW - (shot.y * 10);
      } else {
        // Left half: baseline at left edge
        cx = shot.y * 10;
      }

      // Clamp to court bounds
      cx = Math.max(5, Math.min(CW - 5, cx));
      cy = Math.max(5, Math.min(CH - 5, cy));

      return { cx, cy };
    },
    [homeTeamId]
  );

  const hasActiveFilter = filterQ != null || filterPlayer != null || filterResult !== "all" || filterShotType != null || filterTeam !== "all";

  const clearFilters = () => {
    setFilterQ(null);
    setFilterPlayer(null);
    setFilterResult("all");
    setFilterShotType(null);
    setFilterTeam("all");
  };

  /* Auto-construct ESPN CDN logo URLs if not provided via props */
  // PLEASE review — hard-coded NBA logo CDN path: WNBA/NCAA teams will request nba/500/scoreboard URLs. EXAMPLE: const logoUrl = logo ?? buildEspnLogoUrl({ league, abbreviation });
  const awayLogoUrl =
    awayLogo ||
    `https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/${awayShort.toLowerCase()}.png`;
  const homeLogoUrl =
    homeLogo ||
    `https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/${homeShort.toLowerCase()}.png`;

  if (allShots.length === 0) return null;

  const tooltipShot = filtered.find((s) => s.id === hoveredShot);
  const tooltipData: TooltipData | null = tooltipShot
    ? (() => {
        const { cx, cy } = mapCoords(tooltipShot);
        const isHome = tooltipShot.teamId === homeTeamId;
        return {
          shot: tooltipShot,
          svgX: cx,
          svgY: cy,
          color: isHome ? homeColor : awayColor,
          teamShort: isHome ? homeShort : awayShort,
        };
      })()
    : null;

  return (
    <div
      style={{
        background: "var(--white)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "var(--obsidian)",
              letterSpacing: "-0.4px",
            }}
          >
            SHOT CHART
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            {filtered.length} shot{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Dropdowns row */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* Quarter filter */}
          {/* PLEASE review — filter value numeric parsing: Number(...) can be NaN if the option value is tampered with, leaving filters in a state no shot can match. EXAMPLE: const q = Number(e.target.value); setFilterQ(Number.isFinite(q) ? q : null). */}
          <select
            value={filterQ ?? ""}
            onChange={(e) => setFilterQ(e.target.value ? Number(e.target.value) : null)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 28px 6px 12px",
              borderRadius: 8,
              border: "1.5px solid var(--border)",
              background: "var(--white)",
              color: filterQ != null ? "var(--obsidian)" : "var(--text-secondary)",
              cursor: "pointer",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23999'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
              fontFamily: "inherit",
            }}
          >
            <option value="">All Quarters</option>
            {quarters.map((q) => (
              <option key={q} value={q}>
                {q <= 4 ? `Q${q}` : `OT${q - 4}`}
              </option>
            ))}
          </select>

          {/* Shot type filter */}
          <select
            value={filterShotType ?? ""}
            onChange={(e) => setFilterShotType(e.target.value || null)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 28px 6px 12px",
              borderRadius: 8,
              border: "1.5px solid var(--border)",
              background: "var(--white)",
              color: filterShotType ? "var(--obsidian)" : "var(--text-secondary)",
              cursor: "pointer",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23999'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
              fontFamily: "inherit",
            }}
          >
            <option value="">All Play Types</option>
            {shotTypes.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* Player filter */}
          <select
            value={filterPlayer ?? ""}
            onChange={(e) => setFilterPlayer(e.target.value || null)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 28px 6px 12px",
              borderRadius: 8,
              border: "1.5px solid var(--border)",
              background: "var(--white)",
              color: filterPlayer ? "var(--obsidian)" : "var(--text-secondary)",
              cursor: "pointer",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23999'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
              maxWidth: 160,
              fontFamily: "inherit",
            }}
          >
            <option value="">All Players</option>
            {players.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Quick filter pills ── */}
      <div
        style={{
          padding: "10px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          alignItems: "center",
          background: "var(--white)",
        }}
      >
        {/* Team pills */}
        <FilterPill
          label={awayShort}
          active={filterTeam === "away"}
          onClick={() => setFilterTeam(filterTeam === "away" ? "all" : "away")}
          color={awayColor}
        />
        <FilterPill
          label={homeShort}
          active={filterTeam === "home"}
          onClick={() => setFilterTeam(filterTeam === "home" ? "all" : "home")}
          color={homeColor}
        />

        <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 4px" }} />

        {/* Result pills */}
        <FilterPill
          label="Made"
          active={filterResult === "made"}
          onClick={() => setFilterResult(filterResult === "made" ? "all" : "made")}
          color="#16a34a"
        />
        <FilterPill
          label="Missed"
          active={filterResult === "missed"}
          onClick={() => setFilterResult(filterResult === "missed" ? "all" : "missed")}
          color="#dc2626"
        />

        {/* Clear all */}
        {hasActiveFilter && (
          <>
            <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 4px" }} />
            <button
              onClick={clearFilters}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-secondary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 2,
                padding: "5px 4px",
                fontFamily: "inherit",
              }}
            >
              Clear all
            </button>
          </>
        )}
      </div>

      {/* ── Court ── */}
      <div
        ref={containerRef}
        style={{
          padding: "12px 16px",
          background: "#F0E9D8",
          position: "relative",
        }}
      >
        <svg
          viewBox={`0 0 ${CW} ${CH}`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <CourtSVG
            homeShort={homeShort}
            awayShort={awayShort}
            homeColor={homeColor}
            awayColor={awayColor}
          />

          {/* Shot dots — missed first (so made shots render on top) */}
          {/* PLEASE review — duplicated filtering work in render: filtered is traversed twice every render, which is expensive for dense play-by-play. EXAMPLE: const [misses, makes] = partition(filtered, (s) => !s.made); */}
          {filtered
            .filter((s) => !s.made)
            .map((shot) => {
              const isHome = shot.teamId === homeTeamId;
              const color = isHome ? homeColor : awayColor;
              const { cx, cy } = mapCoords(shot);
              return (
                <ShotDot
                  key={shot.id}
                  shot={shot}
                  cx={cx}
                  cy={cy}
                  color={color}
                  isHovered={hoveredShot === shot.id}
                  onHover={() => setHoveredShot(shot.id)}
                  onLeave={() => setHoveredShot(null)}
                />
              );
            })}
          {filtered
            .filter((s) => s.made)
            .map((shot) => {
              const isHome = shot.teamId === homeTeamId;
              const color = isHome ? homeColor : awayColor;
              const { cx, cy } = mapCoords(shot);
              return (
                <ShotDot
                  key={shot.id}
                  shot={shot}
                  cx={cx}
                  cy={cy}
                  color={color}
                  isHovered={hoveredShot === shot.id}
                  onHover={() => setHoveredShot(shot.id)}
                  onLeave={() => setHoveredShot(null)}
                />
              );
            })}
        </svg>

        {/* Tooltip overlay */}
        <ShotTooltip data={tooltipData} containerRef={containerRef} />
      </div>

      {/* ── Legend / Stats bar ── */}
      <div
        style={{
          padding: "14px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          flexWrap: "wrap",
          fontSize: 12,
          color: "var(--text-secondary)",
          fontFamily: "inherit",
        }}
      >
        {/* Away team stats */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 20px",
          }}
        >
          {/* Team badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <img
              src={awayLogoUrl}
              alt={awayShort}
              style={{ width: 22, height: 22, objectFit: "contain" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <span style={{ fontWeight: 800, color: awayColor, fontSize: 13, letterSpacing: "-0.3px" }}>
              {awayShort}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width={12} height={12}>
                <circle cx={6} cy={6} r={5} fill={awayColor} />
              </svg>
              <span style={{ fontWeight: 500 }}>Made ({stats.awayMade})</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width={12} height={12}>
                <circle cx={6} cy={6} r={4.5} fill="none" stroke={awayColor} strokeWidth={2} />
              </svg>
              <span style={{ fontWeight: 500 }}>Missed ({stats.awayMiss})</span>
            </span>
          </div>

          <span
            style={{
              fontWeight: 800,
              fontSize: 14,
              color: awayColor,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {stats.awayPct}%
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 6px" }} />

        {/* Home team stats */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <img
              src={homeLogoUrl}
              alt={homeShort}
              style={{ width: 22, height: 22, objectFit: "contain" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <span style={{ fontWeight: 800, color: homeColor, fontSize: 13, letterSpacing: "-0.3px" }}>
              {homeShort}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width={12} height={12}>
                <circle cx={6} cy={6} r={5} fill={homeColor} />
              </svg>
              <span style={{ fontWeight: 500 }}>Made ({stats.homeMade})</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width={12} height={12}>
                <circle cx={6} cy={6} r={4.5} fill="none" stroke={homeColor} strokeWidth={2} />
              </svg>
              <span style={{ fontWeight: 500 }}>Missed ({stats.homeMiss})</span>
            </span>
          </div>

          <span
            style={{
              fontWeight: 800,
              fontSize: 14,
              color: homeColor,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {stats.homePct}%
          </span>
        </div>
      </div>
    </div>
  );
}