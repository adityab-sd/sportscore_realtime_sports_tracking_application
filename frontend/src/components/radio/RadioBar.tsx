"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X, Play, Pause, Volume2 } from "lucide-react";
import { useSignalR } from "@/hooks/useSignalR";
import { useRadioSignalR } from "@/hooks/useRadioSignalR";

interface Props { open: boolean; onClose: () => void }

export default function RadioBar({ open, onClose }: Props) {
  const { events, state: radioState } = useRadioSignalR();
  const { matches } = useSignalR(); // reused just to resolve "Home vs Away" from matchId

  const pathname = usePathname();

  // Section -> sport mapping. Sections outside a known sport (home, news, etc.)
  // pass through everything unfiltered, since there's no more specific context
  // to narrow by. Adjust the prefixes here if your route structure differs.
  const currentSport = useMemo(() => {
    if (!pathname) return null;
    if (pathname.startsWith("/football")) return "football";
    if (pathname.startsWith("/basketball")) return "basketball";
    if (pathname.startsWith("/baseball")) return "baseball";
    if (pathname.startsWith("/f1")) return "f1";
    return null;
  }, [pathname]);

  // Events not tagged with a sport (shouldn't happen post-fix, but covers any
  // messages already in flight from before the backend added the field) are
  // let through rather than silently dropped.
  const filteredEvents = useMemo(() => {
    if (!currentSport) return events;
    return events.filter(e => !e.sport || e.sport === currentSport);
  }, [events, currentSport]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // playing starts false on purpose: browsers block audio-with-sound autoplay
  // without a user gesture, so the first real "start" has to be the person
  // pressing the button below, not us calling .play() on mount.
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(-1); // -1 = nothing loaded yet
  const [live, setLive] = useState(true); // true = keep jumping to the newest clip as it arrives

  const current = index >= 0 ? filteredEvents[index] : null;

  const matchLabel = useMemo(() => {
    if (!current) return null;
    const m = matches.find(m => m.id === current.matchId);
    return m ? `${m.homeTeam.name} vs ${m.awayTeam.name}` : `Match #${current.matchId}`;
  }, [current, matches]);

  // Section changed (user navigated between Football/Basketball/elsewhere):
  // drop back to the live edge of whatever's now in scope, rather than
  // leaving a stale index pointing at a clip that may no longer be in the
  // filtered list.
  useEffect(() => {
    setLive(true);
  }, [currentSport]);

  // New clip arrived (or the filter changed): if we're at the "live edge"
  // (haven't manually browsed back), move the pointer to the newest one in
  // the currently-filtered list. The src-load effect below picks it up.
  const latestEvent = filteredEvents[filteredEvents.length - 1] ?? null;

  useEffect(() => {
    if (filteredEvents.length === 0) {
      setIndex(-1);
      return;
    }
    if (live) setIndex(filteredEvents.length - 1);
  }, [latestEvent, live, currentSport]);

  // Load whichever clip `index` points to into the <audio> element.
  useEffect(() => {
    if (!audioRef.current || !current) return;
    audioRef.current.src = `data:${current.contentType};base64,${current.audioBase64}`;
    if (playing) {
      audioRef.current.play().catch(() => setPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function handlePlayPause() {
    if (!audioRef.current || !current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      const expectedSrc = `data:${current.contentType};base64,${current.audioBase64}`;
      // Guard against the src-loading effect not having run yet (e.g. clicking
      // play right as a new event arrives) — set it here too, synchronously,
      // so .play() is never called against a stale/empty element.
      if (audioRef.current.src !== expectedSrc) {
        audioRef.current.src = expectedSrc;
      }
      audioRef.current
          .play()
          .then(() => setPlaying(true))
          .catch(() => setPlaying(false));
    }
  }

  function handleEnded() {
    setIndex(i => Math.min(i + 1, filteredEvents.length - 1));
  }

  function goPrev() {
    setLive(false);
    setIndex(i => Math.max(i - 1, 0));
  }

  function goNext() {
    setIndex(i => {
      const next = Math.min(i + 1, filteredEvents.length - 1);
      if (next === filteredEvents.length - 1) setLive(true);
      return next;
    });
  }

  if (!open) return null;

  const hasClip = !!current;
  const statusLabel =
    radioState === "connected" ? "Waiting for commentary…"
    : radioState === "connecting" ? "Connecting…"
    : "Reconnecting…";

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
      {/* Hidden playback element - this is what's actually producing sound */}
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
          {/* Waveform bars */}
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
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: "var(--indigo)",
              textTransform: "uppercase" as const, letterSpacing: "0.8px",
            }}>
              Radio Mode{currentSport ? ` · ${currentSport[0].toUpperCase()}${currentSport.slice(1)}` : ""}
            </span>
            {hasClip && (
              <>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>• {matchLabel}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: "var(--live-bg)", color: "var(--live-text)",
                  padding: "1px 5px", borderRadius: 3,
                }}>
                  {current!.minute}&apos;
                </span>
              </>
            )}
          </div>
          <p style={{
            fontSize: 13, color: "var(--obsidian)",
            margin: 0, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {hasClip ? current!.text : statusLabel}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <button
            aria-label="Previous commentary clip"
            onClick={goPrev}
            disabled={index <= 0}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "1px solid var(--border)", background: "var(--white)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: index <= 0 ? "default" : "pointer", fontSize: 11, color: "var(--text-secondary)",
              opacity: index <= 0 ? 0.4 : 1,
              transition: "background 100ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--white)")}
          >
            ‹
          </button>

          <button
            aria-label={playing ? "Pause radio" : "Play radio"}
            onClick={handlePlayPause}
            disabled={!hasClip}
            style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "var(--indigo)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: hasClip ? "pointer" : "default",
              opacity: hasClip ? 1 : 0.5,
              transition: "background 120ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--indigo-mid)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--indigo)")}
          >
            {playing ? <Pause size={16} color="#fff" /> : <Play size={16} color="#fff" />}
          </button>

          <button
            aria-label="Next commentary clip"
            onClick={goNext}
            disabled={index >= filteredEvents.length - 1}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "1px solid var(--border)", background: "var(--white)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: index >= filteredEvents.length - 1 ? "default" : "pointer", fontSize: 11, color: "var(--text-secondary)",
              opacity: index >= filteredEvents.length - 1 ? 0.4 : 1,
              transition: "background 100ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--white)")}
          >
            ›
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
    </div>
  );
}
