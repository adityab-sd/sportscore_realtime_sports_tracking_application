"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Play, Pause, Volume2, Loader2 } from "lucide-react";
import { useRadio } from "@/hooks/useRadio";
import { generateRadio, type RadioPhase, type RadioPlayInput, type RadioResponse } from "@/lib/api/radio";
import { toUnifiedMatch } from "@/lib/adaptMatch";
import { adaptPlays } from "@/lib/adaptPlays";
import { classifyStatus } from "@/types/football";
import type { ESPNMatchDetail } from "@/lib/api/espn";
import type { PlayPoint } from "@/types/plays";

interface Props { open: boolean; onClose: () => void }

interface Clip {
  key: string;
  phase: RadioPhase;
  text: string;
  audioBase64: string | null;
  contentType: string | null;
  label: string;
}

// ── pure helpers ────────────────────────────────────────────────────────────

function phaseFromDetail(detail: ESPNMatchDetail | null): RadioPhase | null {
  if (!detail) return null;
  const s = detail.statusState;
  if (s === "pre") return "pre";
  if (s === "post") return "post";
  if (s === "in") return "live";
  // Fallback for feeds that don't set statusState cleanly.
  const c = classifyStatus(detail.status);
  return c === "finished" ? "post" : c === "live" ? "live" : "pre";
}

// Football play -> radio play. adaptPlays already normalises ESPN's plays.
function playsOf(detail: ESPNMatchDetail): PlayPoint[] {
  try {
    const unified = toUnifiedMatch(detail);
    return adaptPlays(detail, unified);
  } catch {
    return [];
  }
}

function toInput(p: PlayPoint): RadioPlayInput {
  return {
    minute: p.minute,
    type: p.result || p.type,
    team: p.team ?? undefined,
    player: p.player ?? null,
    text: p.text,
  };
}

// What's worth calling out on live radio (skip throw-ins, goal kicks, etc.).
function isNotable(p: PlayPoint): boolean {
  return (
    p.result === "goal" ||
    p.result === "shot-on-target" ||
    p.result === "shot-blocked" ||
    p.result === "save" ||
    p.yellowCard ||
    p.redCard
  );
}

// Decisive moments for a full-time round-up.
function isKeyPlay(p: PlayPoint): boolean {
  return p.result === "goal" || p.yellowCard || p.redCard;
}

const phaseLabel = (phase: RadioPhase | null): string =>
  phase === "pre" ? "Preview" : phase === "post" ? "Full-Time" : phase === "live" ? "Live" : "";

const phasePrompt = (phase: RadioPhase | null): string =>
  phase === "pre"
    ? "Press play for the match preview."
    : phase === "post"
    ? "Press play for the full-time round-up."
    : phase === "live"
    ? "Press play for live commentary."
    : "Open a match to start Radio Mode.";

// ── component ────────────────────────────────────────────────────────────────

export default function RadioBar({ open, onClose }: Props) {
  const { active, detail } = useRadio();

  const phase = useMemo(() => phaseFromDetail(detail), [detail]);
  const matchLabel = detail ? `${detail.homeTeam.name} vs ${detail.awayTeam.name}` : null;

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [current, setCurrent] = useState<Clip | null>(null);
  const [playing, setPlaying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Refs so async callbacks / event handlers read live values, not stale closures.
  const playingRef = useRef(false);
  const generatingRef = useRef(false);
  const pendingRef = useRef<Clip[]>([]);
  const spokenRef = useRef<Set<string>>(new Set()); // live: play ids already sent
  const startedRef = useRef(false);                  // live: user has pressed play
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { generatingRef.current = generating; }, [generating]);

  // Identity of "what we're currently doing radio for". Changing match OR phase
  // (e.g. kickoff, or a match finishing while you listen) resets everything.
  const resetKey = `${active?.matchId ?? "none"}:${phase ?? "none"}`;

  useEffect(() => {
    // Full reset + stop whenever the target match or its phase changes.
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
    }
    pendingRef.current = [];
    spokenRef.current = new Set();
    startedRef.current = false;
    setCurrent(null);
    setPlaying(false);
    setGenerating(false);
    setErr(null);
  }, [resetKey]);

  // ── playback plumbing ──────────────────────────────────────────────────────

  function playClip(clip: Clip) {
    setCurrent(clip);
    const el = audioRef.current;
    if (el && clip.audioBase64) {
      el.src = `data:${clip.contentType};base64,${clip.audioBase64}`;
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      // TTS unavailable — show the text, nothing to play.
      setPlaying(false);
    }
  }

  // Play now if idle, otherwise buffer and play when the current clip ends.
  function pushClip(clip: Clip) {
    if (playingRef.current) {
      pendingRef.current = [...pendingRef.current, clip];
    } else {
      playClip(clip);
    }
  }

  function handleEnded() {
    if (pendingRef.current.length > 0) {
      const [next, ...rest] = pendingRef.current;
      pendingRef.current = rest;
      playClip(next);
    } else {
      setPlaying(false);
    }
  }

  function handleResp(resp: RadioResponse | null, label: string) {
    if (!resp) { setErr("Radio is unavailable right now."); return; }
    if (resp.error) { setErr(resp.error); return; }
    if (!resp.text) { setErr("No commentary was generated."); return; }
    setErr(null);
    pushClip({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      phase: resp.phase,
      text: resp.text,
      audioBase64: resp.audioBase64,
      contentType: resp.contentType,
      label,
    });
  }

  function buildBase() {
    if (!active || !detail) return null;
    return {
      sport: active.sport,
      home: detail.homeTeam.name,
      away: detail.awayTeam.name,
      competition: detail.competition,
      venue: detail.venue ?? null,
      kickoff: detail.kickoff ?? null,
      status: detail.status,
      homeScore: detail.homeScore ?? null,
      awayScore: detail.awayScore ?? null,
    };
  }

  // ── generation per phase ────────────────────────────────────────────────────

  async function generatePre() {
    const base = buildBase();
    if (!base) return;
    setGenerating(true);
    const resp = await generateRadio({ ...base, phase: "pre" });
    setGenerating(false);
    handleResp(resp, "Preview");
  }

  async function generatePost() {
    const base = buildBase();
    if (!base || !detail) return;
    setGenerating(true);
    const plays = playsOf(detail).filter(isKeyPlay).slice(0, 12).map(toInput);
    const resp = await generateRadio({ ...base, phase: "post", plays });
    setGenerating(false);
    handleResp(resp, "Full-time");
  }

  async function generateLive(catchup: boolean) {
    const base = buildBase();
    if (!base || !detail) return;

    const all = playsOf(detail);
    let toSend: PlayPoint[];

    if (catchup) {
      toSend = all.filter(isNotable).slice(-6);
      for (const p of all) spokenRef.current.add(p.id); // don't replay history later
    } else {
      toSend = all.filter(p => isNotable(p) && !spokenRef.current.has(p.id));
      // Mark ALL new plays spoken (even non-notable) so they never accumulate.
      for (const p of all) spokenRef.current.add(p.id);
      if (toSend.length === 0) return;
    }

    setGenerating(true);
    const resp = await generateRadio({ ...base, phase: "live", catchup, plays: toSend.map(toInput) });
    setGenerating(false);
    handleResp(resp, catchup ? "Live" : `Live · ${toSend[0]?.minute ?? ""}'`);
  }

  function startForPhase() {
    if (!phase || !detail || generatingRef.current) return;
    if (phase === "pre") { generatePre(); return; }
    if (phase === "post") { generatePost(); return; }
    startedRef.current = true;   // live
    generateLive(true);
  }

  // Live: once started, narrate new notable plays as fresh detail arrives.
  useEffect(() => {
    if (phase !== "live" || !startedRef.current || !detail) return;
    if (generatingRef.current) return;
    const hasNew = playsOf(detail).some(p => isNotable(p) && !spokenRef.current.has(p.id));
    if (hasNew) generateLive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, phase]);

  // ── controls ────────────────────────────────────────────────────────────────

  function handlePlayPause() {
    const el = audioRef.current;
    if (playing) {
      el?.pause();
      setPlaying(false);
      return;
    }
    // Resume an existing clip that has audio…
    if (current && current.audioBase64 && el) {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      return;
    }
    // …otherwise generate the first clip for this phase (this click is the user
    // gesture browsers require before audio can play).
    startForPhase();
  }

  if (!open) return null;

  const canPlay = !!phase && !!detail;
  const busy = generating;

  const bodyText = err
    ? err
    : current
    ? current.text + (current.audioBase64 ? "" : "  (audio unavailable — showing text)")
    : busy
    ? "Generating…"
    : phasePrompt(phase);

  return (
    <div
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--white)",
        borderTop: "2px solid var(--indigo)",
        zIndex: 50,
        boxShadow: "0 -4px 24px rgba(107,33,168,0.10)",
        animation: "fadeSlideUp 0.25s ease both",
      }}
    >
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onPause={() => setPlaying(false)}
        style={{ display: "none" }}
      />

      <div style={{
        maxWidth: 900, margin: "0 auto",
        padding: "12px 20px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        {/* Icon */}
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "var(--indigo-light)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {busy ? (
            <Loader2 size={18} color="var(--indigo)" style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 2, height: 20 }}>
              {[0.2, 0.5, 1, 0.6, 0.3, 0.7, 0.4].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: 2.5,
                    height: `${h * 100}%`,
                    background: "var(--indigo)",
                    borderRadius: 2,
                    transformOrigin: "center",
                    animation: playing ? `waveBar 1s ease-in-out ${i * 0.12}s infinite` : "none",
                    willChange: "transform",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: "var(--indigo)",
              textTransform: "uppercase" as const, letterSpacing: "0.8px",
            }}>
              Radio Mode{phase ? ` · ${phaseLabel(phase)}` : ""}
            </span>
            {matchLabel && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                • {matchLabel}
              </span>
            )}
          </div>
          <p style={{
            fontSize: 13, color: "var(--obsidian)",
            margin: 0, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {bodyText}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <button
            aria-label={playing ? "Pause radio" : "Play radio"}
            onClick={handlePlayPause}
            disabled={!canPlay || busy}
            style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "var(--indigo)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: (!canPlay || busy) ? "default" : "pointer",
              opacity: (!canPlay || busy) ? 0.5 : 1,
              transition: "background 120ms",
            }}
            onMouseEnter={e => { if (canPlay && !busy) e.currentTarget.style.background = "var(--indigo-mid)"; }}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--indigo)")}
          >
            {playing ? <Pause size={16} color="#fff" /> : <Play size={16} color="#fff" />}
          </button>

          <button type="button" aria-label="Volume control (coming soon)" style={{ display: "flex", padding: 6 }} className="desktop-only">
            <Volume2 size={16} color="var(--text-muted)" />
          </button>

          <button
            aria-label="Close radio bar"
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "1px solid var(--border)", background: "var(--white)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "background 100ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--white)")}
          >
            <X size={15} color="var(--text-muted)" />
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}