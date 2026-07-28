"use client";

import Link from "next/link";

interface Props {
  roster: { id: string; name: string; jersey: string | null; position: string | null }[];
  currentId: string;
  teamId: string;
  league: string;
  quickLinks: { label: string; href: string }[];
  leagueQuickLinks: { label: string; href: string }[];
  leagueShort?: string;
  teamShortName?: string;
  side: "left" | "right";
}

export default function PlayerSidebars({
  roster, currentId, teamId, league,
  quickLinks, leagueQuickLinks, leagueShort, teamShortName, side,
}: Props) {
  if (side === "left") {
    if (roster.length === 0) return null;

    // Group by position
    const groups: Record<string, typeof roster> = {};
    for (const p of roster) {
      const pos = p.position ?? "Other";
      if (!groups[pos]) groups[pos] = [];
      groups[pos].push(p);
    }

    return (
      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
          Switch Player
        </div>
        <div style={{ maxHeight: 480, overflowY: "auto" }}>
          {Object.entries(groups).map(([pos, players]) => (
            <div key={pos}>
              <div style={{ padding: "5px 14px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", background: "var(--cloud)", borderBottom: "1px solid var(--border)" }}>
                {pos}
              </div>
              {players.map(p => (
                <Link key={p.id} href={`/football/player/${p.id}?league=${league}&team=${teamId}`} style={{ textDecoration: "none" }}>
                  <div
                    className={`player-switch-row${p.id === currentId ? " active" : ""}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 14px", borderBottom: "1px solid var(--border)",
                      background: p.id === currentId ? "var(--navy-light)" : "transparent",
                      transition: "background 100ms",
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", width: 22, textAlign: "center", flexShrink: 0 }}>
                      {p.jersey ?? "–"}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: p.id === currentId ? 700 : 500, color: p.id === currentId ? "var(--navy)" : "var(--obsidian)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Right side — quick links
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {quickLinks.length > 0 && (
        <QuickLinksCard
          title={`${teamShortName ?? "Team"} Quick Links`}
          links={quickLinks}
        />
      )}
      {leagueQuickLinks.length > 0 && (
        <QuickLinksCard
          title={`${leagueShort ?? "League"} Quick Links`}
          links={leagueQuickLinks}
        />
      )}
    </div>
  );
}

function QuickLinksCard({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
        {title}
      </div>
      <div style={{ padding: "8px 0" }}>
        {links.map(l => (
          <Link key={l.label} href={l.href} style={{ textDecoration: "none" }}>
            <div className="quick-link-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", transition: "background 100ms" }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>›</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--navy)" }}>{l.label}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}