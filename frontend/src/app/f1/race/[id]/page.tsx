import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResults, getNews } from "@/lib/api/f1";
import { getCircuitSvg, getCountryFlag, formatRaceDate } from "@/types/f1";
import { headlineSession, resolveCircuit, cleanGpName } from "@/types/f1-race";

import F1Tabs from "@/components/f1/F1Tabs";
import SessionSchedule from "@/components/f1/SessionSchedule";
import RaceResultPreview from "@/components/f1/RaceResultPreview";
import CircuitSpecs from "@/components/f1/CircuitSpecs";
import RelatedArticles, { type ArticleCard } from "@/components/f1/RelatedArticles";

export const dynamic = "force-dynamic";

const BROADCASTERS: { name: string; logo?: string }[] = [{ name: "Sky Sports F1" }, { name: "Channel 4" }];

const layoutCss = `
.f1-race-2col { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 820px) { .f1-race-2col { grid-template-columns: 2fr 1fr; } }
@media (max-width: 768px) {
  .f1-hero-circuit { display: none !important; }
  .f1-hero-inner { padding-top: 32px !important; padding-bottom: 32px !important; }
}
`;

function toYear(v?: string): number | undefined {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { year } = await searchParams;
  const weekend = await getResults(id, toYear(year));
  return { title: weekend ? `${weekend.name} — F1 — SportScore` : "F1 Race — SportScore" };
}

function fmtNewsDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export default async function RacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id } = await params;
  const { year: yearParam } = await searchParams;
  const year = toYear(yearParam);

  const [weekend, news] = await Promise.all([getResults(id, year), getNews(6)]);
  if (!weekend) return notFound();

  const circuitSvg = getCircuitSvg(weekend.name);
  const flag = getCountryFlag(weekend.country || "");
  const details = resolveCircuit(weekend);
  const gpName = cleanGpName(weekend.name, weekend.country || "");
  const grandPrixName = /grand prix/i.test(gpName) ? gpName : `${gpName} Grand Prix`;
  const season = weekend.name.match(/\b(20\d{2})\b/)?.[1];

  const statusLabel =
    weekend.statusState === "post" ? "Completed" : weekend.statusState === "in" ? "Live" : "Upcoming";

  const headline = headlineSession(weekend.sessions);

  const articles: ArticleCard[] = (Array.isArray(news) ? news : []).map((n) => ({
    title: n.headline,
    href: `/f1/news/${n.id}`,
    date: n.published ? fmtNewsDate(n.published) : undefined,
    image: n.image ?? undefined,
    category: n.category || undefined,
  }));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: layoutCss }} />
      <F1Tabs />

      {/* ── Hero ── */}
      <div style={{ position: "relative", background: "linear-gradient(120deg, #0e0e14 0%, #15151e 55%, #1e1e2a 100%)", color: "#fff", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(/f1/dot.png)",
            backgroundSize: "cover",
            backgroundPosition: "right center",
            backgroundRepeat: "no-repeat",
            filter: "invert(1)",
            mixBlendMode: "screen",
            opacity: 0.14,
            maskImage: "linear-gradient(to left, #000 0%, transparent 62%)",
            WebkitMaskImage: "linear-gradient(to left, #000 0%, transparent 62%)",
            pointerEvents: "none",
          }}
        />
        {circuitSvg && (
          <img
            src={circuitSvg}
            alt=""
            aria-hidden
            className="f1-hero-circuit"
            style={{
              position: "absolute",
              right: "clamp(16px, 2vw, 40px)",
              top: "50%",
              transform: "translateY(-50%)",
              width: "min(22%, 240px)",
              objectFit: "contain",
              opacity: 0.85,
              filter: "invert(1)",
              pointerEvents: "none",
            }}
          />
        )}

        <div className="f1-container f1-hero-inner" style={{ position: "relative", paddingTop: 48, paddingBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#fff", textTransform: "uppercase", background: statusLabel === "Live" ? "#e10600" : "rgba(255,255,255,0.1)", padding: "4px 10px", borderRadius: 999, marginBottom: 14 }}>
            {statusLabel === "Live" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
            {statusLabel}
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: "rgba(255,255,255,0.55)", marginBottom: 6 }}>
            <span style={{ fontSize: 22, marginRight: 8, verticalAlign: "-2px" }}>{flag || details?.flagEmoji}</span>
            {season ? `Round · ${season}` : "Formula 1"}
          </div>

          <h1 style={{ fontSize: "clamp(28px, 6vw, 58px)", fontWeight: 900, margin: 0, fontStyle: "italic", textTransform: "uppercase", letterSpacing: "-0.5px", lineHeight: 1.02, maxWidth: 720 }}>
            {grandPrixName}
          </h1>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 16, fontSize: 14, color: "rgba(255,255,255,0.6)" }}>
            <span>
              {weekend.circuit}
              {weekend.city ? ` · ${weekend.city}` : ""}
              {weekend.country ? `, ${weekend.country}` : ""}
            </span>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>{formatRaceDate(weekend.startDate, weekend.endDate)}</span>
          </div>
        </div>

        <div style={{ height: 4, background: "#e10600" }} />
      </div>

      <div style={{ background: "#f7f4f1" }}>
        <div className="f1-container" style={{ paddingTop: 32, paddingBottom: 64 }}>
          {/* ── Schedule ── */}
          <SessionSchedule sessions={weekend.sessions} raceId={weekend.id} year={year} />

          {/* ── Headline result + broadcast ── */}
          <section id="results" style={{ marginBottom: 48 }}>
            <div className="f1-race-2col">
              <div>
                {headline ? (
                  <RaceResultPreview grid={headline.grid ?? []} sessionLabel={headline.label} />
                ) : (
                  <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: 32, textAlign: "center", color: "#67676d" }}>
                    Results will appear once the session is complete.
                  </div>
                )}
              </div>

              <aside style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: 20, alignSelf: "start" }}>
                <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", color: "#15151e", marginBottom: 12 }}>Where to watch</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {BROADCASTERS.map((b) => (
                    <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#f7f7f9", borderRadius: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#e10600" }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#15151e" }}>{b.name}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "#9a9aa0", marginTop: 12, marginBottom: 0 }}>Broadcasters vary by region.</p>
              </aside>
            </div>
          </section>

          {/* ── Circuit ── */}
          <CircuitSpecs details={details} />

          {/* ── Related articles ── */}
          <RelatedArticles articles={articles} />
        </div>
      </div>
    </>
  );
}