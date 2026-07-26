"use client";

import * as React from "react";

export interface RadarChartDatum {
  label: string;
  /** Raw value for this axis. */
  value: number;
  /**
   * Optional per-axis max, useful when metrics use different scales
   * (e.g. Discipline 0–10 vs Scoring 0–100). Falls back to `maxValue`.
   */
  max?: number;
}

interface RadarChartProps {
  data: RadarChartDatum[];
  /** Default max for axes that don't specify their own `max`. */
  maxValue?: number;
  size?: number;
  /** Number of concentric grid rings. */
  rings?: number;
  /** Stroke/fill color for the data polygon. */
  color?: string;
  fillOpacity?: number;
  /** Color of the label text. */
  labelColor?: string;
  /** Color of the grid lines/rings. */
  gridColor?: string;
  /** Show a numeric value next to each vertex. */
  showValues?: boolean;
  className?: string;
}

/**
 * Reusable radar / spider chart, built with plain SVG so it has no chart-
 * library dependency. Works for any number of axes (3+) — usable for team
 * stat summaries, individual player profiles, comparisons, etc.
 *
 * Usage:
 *   <RadarChart
 *     data={[
 *       { label: "Scoring", value: 72 },
 *       { label: "Creation", value: 54 },
 *       { label: "Experience", value: 40 },
 *       { label: "Discipline", value: 88 },
 *       { label: "Contribution", value: 61 },
 *     ]}
 *     maxValue={100}
 *   />
 */
export function RadarChart({
  data,
  maxValue = 100,
  size = 320,
  rings = 4,
  color = "var(--navy, #2952e3)",
  fillOpacity = 0.25,
  labelColor = "var(--obsidian, #0a1628)",
  gridColor = "var(--border, #e2e6ee)",
  showValues = false,
  className,
}: RadarChartProps) {
  const n = data.length;
  if (n < 3) return null;

  const padding = 56; // room for labels
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - padding;

  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  const pointAt = (i: number, radiusRatio: number) => {
    const a = angleFor(i);
    return {
      x: cx + Math.cos(a) * r * radiusRatio,
      y: cy + Math.sin(a) * r * radiusRatio,
    };
  };

  const toPolygonPoints = (radiusRatio: number) =>
    Array.from({ length: n }, (_, i) => {
      const p = pointAt(i, radiusRatio);
      return `${p.x},${p.y}`;
    }).join(" ");

  const dataPoints = data.map((d, i) => {
    const max = d.max ?? maxValue;
    const ratio = max > 0 ? Math.max(0, Math.min(1, d.value / max)) : 0;
    return pointAt(i, ratio);
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={className}
      style={{ overflow: "visible" }}
    >
      {/* Grid rings */}
      {Array.from({ length: rings }, (_, k) => (
        <polygon
          key={`ring-${k}`}
          points={toPolygonPoints((k + 1) / rings)}
          fill="none"
          stroke={gridColor}
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {Array.from({ length: n }, (_, i) => {
        const p = pointAt(i, 1);
        return (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke={gridColor}
            strokeWidth={1}
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={dataPolygon}
        fill={color}
        fillOpacity={fillOpacity}
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />

      {/* Data vertices */}
      {dataPoints.map((p, i) => (
        <circle key={`dot-${i}`} cx={p.x} cy={p.y} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
      ))}

      {/* Axis labels */}
      {data.map((d, i) => {
        const p = pointAt(i, 1.22);
        const a = angleFor(i);
        // Anchor text based on which side of the chart it falls on, so
        // labels don't collide with the shape.
        const cos = Math.cos(a);
        const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
        return (
          <text
            key={`label-${i}`}
            x={p.x}
            y={p.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            style={{ fontSize: 14, fontWeight: 800, fill: labelColor }}
          >
            {d.label}
            {showValues && (
              <tspan x={p.x} dy={16} style={{ fontSize: 11, fontWeight: 600 }}>
                {d.value}
              </tspan>
            )}
          </text>
        );
      })}
    </svg>
  );
}

export default RadarChart;
