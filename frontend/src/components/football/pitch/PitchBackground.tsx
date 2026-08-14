"use client";
import { ReactNode } from "react";

/**
 * PitchBackground — a single reusable SVG pitch, styled to match ESPN's
 * post-match shot-map field.
 *
 * Renders the grass, vertical mow stripes, and FULL field markings (outer
 * boundary, halfway line, centre circle + spot, both penalty boxes, both
 * 6-yard boxes, penalty spots and the penalty arc "D") inside a viewBox so it
 * scales fluidly to any container width (fully responsive — no fixed width).
 *
 * Children are rendered on top (dots, ball, trails) and share the same
 * coordinate space via the exported px()/py() helpers, so ShotMap and
 * LiveBallTracker keep working without any change on their side.
 *
 * Aspect ratio (1.7:1) and marking geometry are tuned to ESPN's rendering,
 * not to real-world metres — ESPN's own pitch is not drawn to metric scale.
 */

// ESPN-style proportions: ~1.7 : 1 (wider than a to-scale pitch).
export const PITCH_W = 680;
export const PITCH_H = 400;
const PAD = 8;

// Playing area (inside the padding) — everything is derived from these.
const PLAY_W = PITCH_W - PAD * 2;
const PLAY_H = PITCH_H - PAD * 2;
const CY = PITCH_H / 2;

// Marking geometry (fractions of the playing area, tuned to ESPN).
const BOX_DEPTH = 0.16 * PLAY_W;   // penalty box depth (into the pitch)
const BOX_HEIGHT = 0.60 * PLAY_H;  // penalty box width (across the pitch)
const SIX_DEPTH = 0.055 * PLAY_W;  // 6-yard box depth
const SIX_HEIGHT = 0.27 * PLAY_H;  // 6-yard box width
const SPOT_DIST = 0.105 * PLAY_W;  // penalty spot from the goal line
const ARC_R = 0.10 * PLAY_W;       // penalty arc radius
const CIRCLE_R = 0.135 * PLAY_H;   // centre circle radius
const GOAL_H = 0.13 * PLAY_H;      // little goal on the line

const boxY = CY - BOX_HEIGHT / 2;
const sixY = CY - SIX_HEIGHT / 2;
const goalY = CY - GOAL_H / 2;

// Penalty-arc endpoints: where the arc meets the top of the penalty box.
const ARC_DX = BOX_DEPTH - SPOT_DIST;                 // horizontal gap
const ARC_DY = Math.sqrt(Math.max(0, ARC_R * ARC_R - ARC_DX * ARC_DX));

const LINE = "rgba(255,255,255,0.72)";
const LINE_W = 1.4;

/** Map normalized 0..1 field coordinate → SVG user units. */
export const px = (v: number) => PAD + v * PLAY_W;
export const py = (v: number) => PAD + v * PLAY_H;

interface Props {
  children?: ReactNode;
  /** Optional short codes shown at each end (e.g. "NYC" / "TOR"). */
  homeShort?: string;
  awayShort?: string;
  /** When set, tints each half in the team colour to visually split the pitch. */
  homeColor?: string;
  awayColor?: string;
  split?: boolean;
  onBackgroundClick?: () => void;
}

export default function PitchBackground({
  children,
  homeShort,
  awayShort,
  homeColor,
  awayColor,
  split,
  onBackgroundClick,
}: Props) {
  const leftGoalLineX = PAD;
  const rightGoalLineX = PITCH_W - PAD;

  return (
    <svg
      viewBox={`0 0 ${PITCH_W} ${PITCH_H}`}
      style={{ width: "100%", height: "auto", display: "block", borderRadius: 8 }}
      onClick={onBackgroundClick}
      role="img"
      aria-label="Football pitch shot map"
    >
      <defs>
        <linearGradient id="pitch-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3f9a45" />
          <stop offset="100%" stopColor="#358b3c" />
        </linearGradient>
      </defs>

      {/* Grass base */}
      <rect width={PITCH_W} height={PITCH_H} rx="6" fill="url(#pitch-grass)" />

      {/* Vertical mow stripes (ESPN look) — 7 bands */}
      {Array.from({ length: 7 }, (_, i) => (
        <rect
          key={i}
          x={i * (PITCH_W / 7)}
          y={0}
          width={PITCH_W / 7}
          height={PITCH_H}
          fill={i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
        />
      ))}

      {/* Optional team-half tints */}
      {split && homeColor && (
        <rect x={PAD} y={PAD} width={PLAY_W / 2} height={PLAY_H} fill={homeColor} opacity="0.1" />
      )}
      {split && awayColor && (
        <rect x={PITCH_W / 2} y={PAD} width={PLAY_W / 2} height={PLAY_H} fill={awayColor} opacity="0.1" />
      )}

      {/* Outer boundary */}
      <rect x={PAD} y={PAD} width={PLAY_W} height={PLAY_H} rx="1" fill="none" stroke={LINE} strokeWidth={LINE_W} />

      {/* Halfway line + centre circle + spot */}
      <line x1={PITCH_W / 2} y1={PAD} x2={PITCH_W / 2} y2={PITCH_H - PAD} stroke={LINE} strokeWidth={LINE_W} />
      <circle cx={PITCH_W / 2} cy={CY} r={CIRCLE_R} fill="none" stroke={LINE} strokeWidth={LINE_W} />
      <circle cx={PITCH_W / 2} cy={CY} r={2.2} fill={LINE} />

      {/* ── LEFT end ─────────────────────────────────────────────── */}
      {/* penalty box */}
      <rect x={PAD} y={boxY} width={BOX_DEPTH} height={BOX_HEIGHT} fill="none" stroke={LINE} strokeWidth={LINE_W} />
      {/* 6-yard box */}
      <rect x={PAD} y={sixY} width={SIX_DEPTH} height={SIX_HEIGHT} fill="none" stroke={LINE} strokeWidth={LINE_W} />
      {/* penalty spot */}
      <circle cx={PAD + SPOT_DIST} cy={CY} r={2.2} fill={LINE} />
      {/* penalty arc (D) — only the portion outside the box */}
      <path
        d={`M ${PAD + BOX_DEPTH} ${CY - ARC_DY} A ${ARC_R} ${ARC_R} 0 0 1 ${PAD + BOX_DEPTH} ${CY + ARC_DY}`}
        fill="none" stroke={LINE} strokeWidth={LINE_W}
      />
      {/* goal on the line */}
      <rect x={leftGoalLineX - 3} y={goalY} width={3} height={GOAL_H} fill="rgba(255,255,255,0.55)" />

      {/* ── RIGHT end ────────────────────────────────────────────── */}
      <rect x={PITCH_W - PAD - BOX_DEPTH} y={boxY} width={BOX_DEPTH} height={BOX_HEIGHT} fill="none" stroke={LINE} strokeWidth={LINE_W} />
      <rect x={PITCH_W - PAD - SIX_DEPTH} y={sixY} width={SIX_DEPTH} height={SIX_HEIGHT} fill="none" stroke={LINE} strokeWidth={LINE_W} />
      <circle cx={PITCH_W - PAD - SPOT_DIST} cy={CY} r={2.2} fill={LINE} />
      <path
        d={`M ${PITCH_W - PAD - BOX_DEPTH} ${CY - ARC_DY} A ${ARC_R} ${ARC_R} 0 0 0 ${PITCH_W - PAD - BOX_DEPTH} ${CY + ARC_DY}`}
        fill="none" stroke={LINE} strokeWidth={LINE_W}
      />
      <rect x={rightGoalLineX} y={goalY} width={3} height={GOAL_H} fill="rgba(255,255,255,0.55)" />

      {children}
    </svg>
  );
}