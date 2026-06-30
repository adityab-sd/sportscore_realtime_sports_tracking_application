import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoster, getTeam } from "@/lib/api/espn";
import { leagueName } from "@/types/football";

export const dynamic = "force-dynamic";
interface Props { params: Promise<{ id: string }>; searchParams: Promise<{ league?: string; team?: string }> }

const posFull: Record<string, string> = {
  G: "Goalkeeper", GK: "Goalkeeper", D: "Defender", DF: "Defender",
  M: "Midfielder", MF: "Midfielder", F: "Forward", FW: "Forward",
};

export default async function PlayerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { league = "eng.1", team: teamId } = await searchParams;
  if (!teamId) return notFound();

  const [roster, team] = await Promise.all([getRoster(league, teamId), getTeam(league, teamId)]);
  const player = roster.find(p => p.id === id);
  if (!player) return notFound();

  return (
    <div className="container" style={{ maxWidth: 620, paddingTop: 28, paddingBottom: 40 }}>
      <Link href={`/football/team/${teamId}?league=${league}`} style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", display: "inline-block", marginBottom: 24 }}>← {team?.name ?? "Team"}</Link>

      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "36px 24px", textAlign: "center" }}>
        {player.headshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.headshot} alt={player.name} width={96} height={96} style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", background: "var(--cloud)", margin: "0 auto 16px", display: "block" }} />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--navy-light)", color: "var(--navy)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <span className="score-num" style={{ fontSize: 34 }}>{player.jersey ?? "–"}</span>
          </div>
        )}
        <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 8px", letterSpacing: "-0.3px" }}>{player.name}</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 20px" }}>{team?.name ?? ""} · {leagueName(league)}</p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {player.position && <Stat label="Position" value={posFull[player.position] ?? player.position} />}
          {player.jersey && <Stat label="Number" value={`#${player.jersey}`} />}
          {player.age != null && <Stat label="Age" value={String(player.age)} />}
          {player.nationality && <Stat label="Nationality" value={player.nationality} />}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--cloud)", borderRadius: 10, padding: "12px 16px", minWidth: 90 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--obsidian)" }}>{value}</div>
    </div>
  );
}
