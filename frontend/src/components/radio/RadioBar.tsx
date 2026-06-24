"use client";

import { useState } from "react";
import { X, Play, Pause, Volume2 } from "lucide-react";
import { mockRadioEvents } from "@/lib/mock/radioData";

interface Props { open: boolean; onClose: () => void }

export default function RadioBar({ open, onClose }: Props) {
  const [playing, setPlaying] = useState(true);
  const [eventIdx, setEventIdx] = useState(0);
  const current = mockRadioEvents[eventIdx % mockRadioEvents.length];

  if (!open) return null;

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
              Radio Mode
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>• {current.match}</span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: "var(--live-bg)", color: "var(--live-text)",
              padding: "1px 5px", borderRadius: 3,
            }}>
              {current.minute}&apos;
            </span>
          </div>
          <p style={{
            fontSize: 13, color: "var(--obsidian)",
            margin: 0, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {current.text}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => setEventIdx(i => (i - 1 + mockRadioEvents.length) % mockRadioEvents.length)}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "1px solid var(--border)", background: "var(--white)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 11, color: "var(--text-secondary)",
              transition: "background 100ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--white)")}
          >
            ‹
          </button>

          <button
            onClick={() => setPlaying(!playing)}
            style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "var(--indigo)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "background 120ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--indigo-mid)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--indigo)")}
          >
            {playing ? <Pause size={16} color="#fff" /> : <Play size={16} color="#fff" />}
          </button>

          <button
            onClick={() => setEventIdx(i => (i + 1) % mockRadioEvents.length)}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "1px solid var(--border)", background: "var(--white)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 11, color: "var(--text-secondary)",
              transition: "background 100ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--white)")}
          >
            ›
          </button>

          <button style={{ display: "flex", padding: 6 }} className="desktop-only">
            <Volume2 size={16} color="var(--text-muted)" />
          </button>

          <button
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
