"use client";
import { useSignalR } from "@/hooks/useSignalR";
import { classifyStatus } from "@/types/football";
import MatchCard from "./MatchCard";
import LiveStatus from "@/components/ui/LiveStatus";

interface Props {
  leagueName: string; // e.g. "Premier League" - matches Match.competition from backend
  slug: string;
}

export default function LeagueMatchFeed({ leagueName, slug }: Props) {
  const { matches, state, lastUpdate } = useSignalR();

  // Filter by sport=football AND competition name (basketball can share competition names like "Premier League"; double-guard).
  const leagueMatches = matches.filter(m =>
    (!m.sport || m.sport === "football") &&
    m.competition?.toLowerCase() === leagueName.toLowerCase()
  );

  const live = leagueMatches.filter(m => classifyStatus(m.status) === "live");
  const sched = leagueMatches.filter(m => classifyStatus(m.status) === "scheduled");
  const fin = leagueMatches.filter(m => classifyStatus(m.status) === "finished");

  const isEmpty = leagueMatches.length === 0;
  const isConnecting = state === "connecting";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 12 }}>
        <LiveStatus state={state} lastUpdate={lastUpdate} />
      </div>

      {isEmpty && isConnecting && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
          <div style={{ width: 28, height: 28, margin: "0 auto 12px", border: "3px solid var(--border)", borderTopColor: "var(--navy)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <p style={{ fontSize: 13, margin: 0 }}>Loading match data…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {isEmpty && !isConnecting && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", background: "var(--cloud)", borderRadius: 12 }}>
          <p style={{ fontSize: 14, margin: "0 0 6px", fontWeight: 600, color: "var(--text-secondary)" }}>No matches in the feed</p>
          <p style={{ fontSize: 13, margin: 0 }}>
            {state === "connected"
              ? "No matches for this league are currently being pushed via SignalR."
              : "SignalR is offline - check the backend is running."}
          </p>
        </div>
      )}

      {live.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div className="section-label"><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d" }} />Live</div>
          <div className="matches-grid">{live.map(m => <MatchCard key={m.id} match={m} />)}</div>
        </section>
      )}
      {sched.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div className="section-label">Scheduled</div>
          <div className="matches-grid">{sched.map(m => <MatchCard key={m.id} match={m} />)}</div>
        </section>
      )}
      {fin.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div className="section-label">Finished</div>
          <div className="matches-grid">{fin.map(m => <MatchCard key={m.id} match={m} />)}</div>
        </section>
      )}
    </div>
  );
}