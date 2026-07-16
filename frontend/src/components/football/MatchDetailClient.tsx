"use client";
import Link from "next/link";
import { useSignalR } from "@/hooks/useSignalR";
import ScoreHeader from "./ScoreHeader";
import EventFeed from "./EventFeed";
import LiveStatus from "@/components/ui/LiveStatus";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>{title}</div>
      <div style={{ padding: "16px 18px" }}>{children}</div>
    </div>
  );
}

export default function MatchDetailClient({ id }: { id: number }) {
  const { matches, state, lastUpdate } = useSignalR();
  const match = matches.find(m => m.id === id);

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <Link href="/football" style={{ display: "inline-block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", padding: "6px 10px", borderRadius: 7, background: "var(--cloud)" }}>← Back to Football</Link>
        <LiveStatus state={state} lastUpdate={lastUpdate} />
      </div>

      {!match ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
          {state === "connecting" ? (
            <>
              <div style={{ width: 32, height: 32, margin: "0 auto 14px", border: "3px solid var(--border)", borderTopColor: "var(--navy)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p style={{ fontSize: 14, margin: 0 }}>Loading match…</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, margin: "0 0 6px", fontWeight: 600, color: "var(--text-secondary)" }}>Match not in the live feed</p>
              <p style={{ fontSize: 13, margin: 0 }}>It may have finished or isn&apos;t being broadcast right now.</p>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ScoreHeader match={match} league="" />
          <SectionCard title="Match Events"><EventFeed match={match} /></SectionCard>
        </div>
      )}
    </div>
  );
}
