"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type F1BannerData = {
  live: boolean;
  gpName: string;
  sessionLabel: string;
  date: string | null;
  href: string;
  flag?: string | null; // emoji
};

function breakdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { d, clock: `${pad(h)}:${pad(m)}:${pad(sec)}` };
}

export default function F1LiveBanner({ data }: { data: F1BannerData }) {
  // Countdown ticks only on the client; before mount we render nothing time-based
  // so the server and client markup match (no hydration mismatch).
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (data.live || !data.date) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [data.live, data.date]);

  const targetMs = data.date ? new Date(data.date).getTime() : null;
  const remaining = now != null && targetMs != null ? breakdown(targetMs - now) : null;

  return (
    <Link href={data.href} className={`f1-live-banner${data.live ? " is-live" : ""}`}>
      <div className="f1-live-left">
        <span className="f1-live-tag">
          {data.live && <span className="f1-live-dot" />}
          {data.live ? "Live Now" : "Up Next"}
        </span>
        {data.flag && <span className="f1-live-flag">{data.flag}</span>}
        <span className="f1-live-title">{data.gpName}</span>
        <span className="f1-live-session">{data.sessionLabel}</span>
      </div>

      <div className="f1-live-right">
        {data.live ? (
          <span className="f1-live-follow">Follow live →</span>
        ) : remaining ? (
          <span className="f1-live-count">
            {remaining.d > 0 && <b>{remaining.d}d</b>} <b>{remaining.clock}</b>
          </span>
        ) : (
          <span className="f1-live-follow">View schedule →</span>
        )}
      </div>
    </Link>
  );
}