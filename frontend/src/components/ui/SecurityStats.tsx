"use client";

import { useEffect, useState } from "react";
import { ShieldOff, LockKeyhole } from "lucide-react";

interface Stats {
  blockedRequests: number;
  lockedAccounts: number;
}

export default function SecurityStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
  useEffect(() => {
    let cancelled = false;

    fetch(`${apiBase}/api/security/stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setStats(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  if (!stats) return null;

  return (
    <section aria-label="Live security stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 22px", display: "flex", alignItems: "center", gap: 14 }}>
        <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(15, 27, 61, 0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ShieldOff size={20} color="var(--navy)" strokeWidth={2} />
        </div>
        <div>
          <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--navy)" }}>{stats.blockedRequests.toLocaleString()}</p>
          <p style={{ fontSize: 12.5, color: "#6b7280", margin: 0 }}>Abusive requests blocked</p>
        </div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 22px", display: "flex", alignItems: "center", gap: 14 }}>
        <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(15, 27, 61, 0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <LockKeyhole size={20} color="var(--navy)" strokeWidth={2} />
        </div>
        <div>
          <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--navy)" }}>{stats.lockedAccounts.toLocaleString()}</p>
          <p style={{ fontSize: 12.5, color: "#6b7280", margin: 0 }}>Brute-force attempts stopped</p>
        </div>
      </div>
    </section>
  );
}
