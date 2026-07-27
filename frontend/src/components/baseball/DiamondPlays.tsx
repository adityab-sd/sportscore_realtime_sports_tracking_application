"use client";
import { useState } from "react";

interface BBEvent { minute: number; type: string; detail: string; player: string | null; assist: string | null; teamId: string }
interface TeamRef { id: string; name: string; shortName: string; logo: string | null }

// Parse a scoring-play description into how far the batter advanced.
function classify(text: string): { base: number; label: string } {
  const t = (text || "").toLowerCase();
  if (/grand slam|home run|homers|homered|\bhr\b/.test(t)) return { base: 4, label: "Home Run" };
  if (/triple/.test(t)) return { base: 3, label: "Triple" };
  if (/double/.test(t)) return { base: 2, label: "Double" };
  if (/singles|single/.test(t)) return { base: 1, label: "Single" };
  if (/walk|hit by pitch|hbp/.test(t)) return { base: 1, label: "Walk" };
  if (/sacrifice|sac fly|groundout|flies out|grounds out|lines out|pop|strike/.test(t)) return { base: 0, label: "Out" };
  if (/scores|rbi|error|fielder/.test(t)) return { base: 1, label: "Reached" };
  return { base: 0, label: "Play" };
}

const HOME = { x: 200, y: 330 };
const FIRST = { x: 305, y: 225 };
const SECOND = { x: 200, y: 120 };
const THIRD = { x: 95, y: 225 };
const CIRCUIT = [HOME, FIRST, SECOND, THIRD, HOME];
const BASES = [FIRST, SECOND, THIRD];

function pathTo(base: number): string {
  if (base <= 0) return "";
  const pts = CIRCUIT.slice(0, base + 1);
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
}

function Diamond({ base, accent }: { base: number; accent: string }) {
  const reached = pathTo(base);
  return (
    <svg viewBox="0 0 400 400" style={{ width: "100%", maxWidth: 360, height: "auto", display: "block", margin: "0 auto" }}>
      {/* Outfield grass */}
      <path d="M200,330 L360,170 A226,226 0 0,0 40,170 Z" fill="#5B8C3E" opacity={0.18} />
      {/* Infield dirt */}
      <path d="M200,330 L305,225 L200,120 L95,225 Z" fill="#C89B6B" opacity={0.25} />
      {/* Foul lines */}
      <line x1={HOME.x} y1={HOME.y} x2={360} y2={170} stroke="var(--border)" strokeWidth={2} />
      <line x1={HOME.x} y1={HOME.y} x2={40} y2={170} stroke="var(--border)" strokeWidth={2} />
      {/* Base paths */}
      <path d={CIRCUIT.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--border)" strokeWidth={2.5} />
      {/* Mound */}
      <circle cx={200} cy={225} r={12} fill="#C89B6B" opacity={0.5} stroke="var(--border)" strokeWidth={1} />

      {/* Reached path (animated) */}
      {reached && (
        <path key={base} d={reached} fill="none" stroke={accent} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={600} strokeDashoffset={600} style={{ animation: "diamond-run 0.9s ease forwards" }} />
      )}

      {/* Bases */}
      {[HOME, ...BASES].map((p, i) => {
        const lit = base >= i && base > 0;
        return <rect key={i} x={p.x - 8} y={p.y - 8} width={16} height={16} rx={2}
          transform={`rotate(45 ${p.x} ${p.y})`}
          fill={lit ? accent : "var(--white)"} stroke={lit ? accent : "var(--text-muted)"} strokeWidth={2} />;
      })}

      {/* Runner dot at reached base */}
      {base > 0 && (
        <circle cx={CIRCUIT[base].x} cy={CIRCUIT[base].y} r={7} fill={accent} stroke="#fff" strokeWidth={2}
          style={{ animation: "diamond-pop 0.9s ease forwards" }} />
      )}

      <style>{`
        @keyframes diamond-run { to { stroke-dashoffset: 0; } }
        @keyframes diamond-pop { 0%,70% { opacity: 0; } 100% { opacity: 1; } }
      `}</style>
    </svg>
  );
}

export default function DiamondPlays({ events, homeTeam, awayTeam }: { events: BBEvent[]; homeTeam: TeamRef; awayTeam: TeamRef }) {
  const plays = events.map((e, i) => ({ ...e, idx: i, ...classify(e.detail) }));
  const [selected, setSelected] = useState(0);
  if (plays.length === 0) return null;
  const cur = plays[Math.min(selected, plays.length - 1)];
  const isHome = String(cur.teamId) === String(homeTeam.id);
  const accent = isHome ? "#003f88" : "#b91c1c";
  const teamShort = isHome ? homeTeam.shortName : awayTeam.shortName;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
        Scoring Plays · On the Diamond
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(240px, 1fr)", gap: 0 }} className="page-split">
        {/* Field */}
        <div style={{ padding: "18px 16px", borderRight: "1px solid var(--border)", background: "var(--cloud)" }}>
          <Diamond base={cur.base} accent={accent} />
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: accent }}>{cur.label}</div>
            {cur.player && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", marginTop: 2 }}>{cur.player}</div>}
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{teamShort} · Inning {cur.minute}</div>
          </div>
        </div>
        {/* Play list */}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {plays.map((p) => {
            const active = p.idx === selected;
            const home = String(p.teamId) === String(homeTeam.id);
            return (
              <button key={p.idx} onClick={() => setSelected(p.idx)} style={{
                display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                padding: "10px 14px", border: "none", borderBottom: "1px solid var(--border)",
                borderLeft: active ? `3px solid ${home ? "#003f88" : "#b91c1c"}` : "3px solid transparent",
                background: active ? "var(--cloud)" : "var(--white)", transition: "background 120ms",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: home ? "#003f88" : "#b91c1c", minWidth: 40 }}>{home ? homeTeam.shortName : awayTeam.shortName} · {p.minute}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)" }}>{p.label}</span>
                </div>
                {p.player && <div style={{ fontSize: 12, fontWeight: 600, color: "var(--obsidian)" }}>{p.player}</div>}
                <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.35 }}>{p.detail}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}