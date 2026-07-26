import Link from "next/link";
import type { ConstructorStanding } from "@/lib/api/f1";
import { findTeam, getTeamGradient, teamSlug } from "@/types/f1";

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return <>{n}<sup>{s[(v - 20) % 10] || s[v] || s[0]}</sup></>;
}

export default function TeamPodium({ constructors }: { constructors: ConstructorStanding[] }) {
  const top3 = constructors.slice(0, 3);
  const ordered = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  return (
    <div className="f1-podium">
      {ordered.map((c) => {
        const info = findTeam(c.team);
        const bg = getTeamGradient(c.team);
        return (
          <Link
            key={c.teamId}
            href={`/f1/teams/${info?.slug || teamSlug(c.team)}`}
            className="f1-podium-card"
            style={{ background: bg }}
          >
            <div>
              <div className="podium-rank">{ordinal(c.rank)}</div>
              <div className="podium-name" style={{ fontSize: 26, fontStyle: "italic", textTransform: "uppercase" }}>
                {c.team}
              </div>
              {info && (
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                  {info.drivers.join(" · ")}
                </div>
              )}
            </div>
            <div className="podium-points">
              {Math.round(c.points)}<span>PTS</span>
            </div>
            {info && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={info.carImage}
                alt={c.team}
                style={{
                  position: "absolute", right: -22, bottom: 10,
                  width: "74%", height: "auto", objectFit: "contain",
                  pointerEvents: "none", zIndex: 2,
                  filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.32))",
                }}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}