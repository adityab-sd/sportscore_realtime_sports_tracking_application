import Skeleton from "@/components/ui/Skeleton";

// One skeleton per real page layout. These deliberately mirror the structure of
// each page (same containers, same block positions) so the jump when real data
// arrives is minimal. Route loading.tsx files each import the matching one.

/* ---------- shared bits ---------- */

function Container({ children, pt = 28, pb = 40, className = "container" }: { children: React.ReactNode; pt?: number; pb?: number; className?: string }) {
  return <div className={className} style={{ paddingTop: pt, paddingBottom: pb }}>{children}</div>;
}

function PageTitle({ sub = true }: { sub?: boolean }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <Skeleton width={220} height={28} style={{ marginBottom: sub ? 8 : 0 }} />
      {sub && <Skeleton width={300} height={13} />}
    </div>
  );
}

function MatchCardBlock() {
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
      <Skeleton width={90} height={10} style={{ marginBottom: 12 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}><Skeleton width={22} height={22} radius={6} /><Skeleton width="60%" height={14} /></div>
        <Skeleton width={40} height={22} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" }}><Skeleton width="60%" height={14} /><Skeleton width={22} height={22} radius={6} /></div>
      </div>
    </div>
  );
}

function MatchGrid({ n = 6 }: { n?: number }) {
  return <div className="matches-grid">{Array.from({ length: n }).map((_, i) => <MatchCardBlock key={i} />)}</div>;
}

function TableBlock({ rows = 12, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i ? "1px solid var(--border)" : "none" }}>
          <Skeleton width={16} height={14} />
          <Skeleton width={24} height={24} radius={6} />
          <Skeleton width="34%" height={14} />
          <span style={{ marginLeft: "auto", display: "flex", gap: 20 }}>
            {Array.from({ length: cols }).map((_, j) => <Skeleton key={j} width={20} height={14} />)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- page archetypes ---------- */

// Home ( / )
export function HomeSkeleton() {
  return (
    <div>
      <Skeleton width="100%" height={420} radius={0} />
      <Skeleton width="100%" height={44} radius={0} />
      <Container pt={28} pb={40}>
        <Skeleton width={160} height={12} style={{ marginBottom: 16 }} />
        <div className="matches-grid" style={{ marginBottom: 40 }}>
          {Array.from({ length: 4 }).map((_, i) => <MatchCardBlock key={i} />)}
        </div>
        <Skeleton width={140} height={12} style={{ marginBottom: 16 }} />
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}><Skeleton height={150} radius={12} style={{ marginBottom: 10 }} /><Skeleton width="85%" height={14} style={{ marginBottom: 6 }} /><Skeleton width="50%" height={12} /></div>
          ))}
        </div>
      </Container>
    </div>
  );
}

// Sport landing ( /football, /basketball, /baseball )
export function SportLandingSkeleton() {
  return (
    <Container>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 20 }}>
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} width={72} height={52} />)}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width={92} height={34} radius={999} />)}
      </div>
      <Skeleton width={130} height={12} style={{ marginBottom: 14 }} />
      <MatchGrid n={6} />
    </Container>
  );
}

// Standings / statistics / injuries / transactions ( tables )
export function TableSkeleton() {
  return (
    <Container>
      <PageTitle />
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} width={110} height={32} radius={999} />)}
      </div>
      <TableBlock rows={14} cols={6} />
    </Container>
  );
}

// News list ( /{sport}/news, /f1/news )
export function NewsListSkeleton() {
  return (
    <Container>
      <PageTitle />
      <Skeleton height={260} radius={14} style={{ marginBottom: 24 }} />
      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i}><Skeleton height={160} radius={12} style={{ marginBottom: 10 }} /><Skeleton width="90%" height={15} style={{ marginBottom: 6 }} /><Skeleton width="55%" height={12} /></div>
        ))}
      </div>
    </Container>
  );
}

// News article ( /{sport}/news/[id] )
export function ArticleSkeleton() {
  return (
    <Container pt={28} pb={56}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Skeleton width={90} height={12} style={{ marginBottom: 20 }} />
        <Skeleton width="95%" height={30} style={{ marginBottom: 10 }} />
        <Skeleton width="70%" height={30} style={{ marginBottom: 16 }} />
        <Skeleton width={220} height={12} style={{ marginBottom: 22 }} />
        <Skeleton height={380} radius={14} style={{ marginBottom: 26 }} />
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} width={i % 4 === 3 ? "62%" : "100%"} height={14} style={{ marginBottom: 12 }} />
        ))}
      </div>
    </Container>
  );
}

// Match / game detail ( /{sport}/[id] )
export function MatchDetailSkeleton() {
  return (
    <Container pt={24} pb={48}>
      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, marginBottom: 22 }}>
        <Skeleton width={140} height={11} style={{ margin: "0 auto 18px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flex: 1 }}><Skeleton width={56} height={56} radius={14} /><Skeleton width={90} height={14} /></div>
          <Skeleton width={90} height={44} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flex: 1 }}><Skeleton width={56} height={56} radius={14} /><Skeleton width={90} height={14} /></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width={92} height={32} radius={999} />)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} height={48} radius={10} />)}
      </div>
    </Container>
  );
}

// Fixtures ( /{sport}/fixtures ) — Results + Upcoming sections
export function FixturesSkeleton() {
  return (
    <Container pt={28} pb={48}>
      <PageTitle />
      {["Results", "Upcoming"].map((_, s) => (
        <section key={s} style={{ marginBottom: 32 }}>
          <Skeleton width={130} height={18} style={{ marginBottom: 14 }} />
          <MatchGrid n={4} />
        </section>
      ))}
    </Container>
  );
}

// Player / team / driver / F1 team profile — colored hero banner + stat tables
export function ProfileSkeleton() {
  return (
    <div>
      <div style={{ background: "var(--navy)", paddingTop: 40, paddingBottom: 40 }}>
        <div className="container" style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Skeleton width={96} height={96} radius={16} style={{ background: "rgba(255,255,255,0.18)" }} />
          <div style={{ flex: 1 }}>
            <Skeleton width={260} height={30} radius={8} style={{ background: "rgba(255,255,255,0.22)", marginBottom: 12 }} />
            <Skeleton width={160} height={14} radius={6} style={{ background: "rgba(255,255,255,0.16)" }} />
          </div>
        </div>
      </div>
      <Container pt={24} pb={48}>
        <Skeleton width={200} height={16} style={{ marginBottom: 16 }} />
        <TableBlock rows={6} cols={5} />
        <div style={{ height: 28 }} />
        <Skeleton width={160} height={16} style={{ marginBottom: 16 }} />
        <TableBlock rows={8} cols={4} />
      </Container>
    </div>
  );
}

// Card-grid list ( /f1/drivers, /f1/teams )
export function CardGridSkeleton() {
  return (
    <div className="f1-container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <PageTitle />
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
            <Skeleton height={120} radius={10} style={{ marginBottom: 12 }} />
            <Skeleton width="70%" height={15} style={{ marginBottom: 6 }} />
            <Skeleton width="45%" height={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

// F1 landing ( /f1 ) — season schedule row + standings podium
export function F1LandingSkeleton() {
  return (
    <div className="f1-container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <section style={{ marginBottom: 48 }}>
        <Skeleton width={180} height={22} style={{ marginBottom: 18 }} />
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={180} radius={14} />)}
        </div>
      </section>
      <section>
        <Skeleton width={160} height={22} style={{ marginBottom: 18 }} />
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 20 }}>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={200} radius={14} />)}
        </div>
        <TableBlock rows={8} cols={3} />
      </section>
    </div>
  );
}

// F1 race weekend ( /f1/race/[id] ) — dark hero + sessions + results
export function F1RaceSkeleton() {
  return (
    <div>
      <div style={{ background: "var(--obsidian)", paddingTop: 48, paddingBottom: 48 }}>
        <div className="f1-container">
          <Skeleton width={140} height={12} radius={6} style={{ background: "rgba(255,255,255,0.2)", marginBottom: 16 }} />
          <Skeleton width="60%" height={52} radius={8} style={{ background: "rgba(255,255,255,0.22)", marginBottom: 12 }} />
          <Skeleton width={220} height={16} radius={6} style={{ background: "rgba(255,255,255,0.16)" }} />
        </div>
      </div>
      <div className="f1-container" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 40 }}>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={90} radius={12} />)}
        </div>
        <Skeleton width={160} height={22} style={{ marginBottom: 18 }} />
        <TableBlock rows={10} cols={4} />
      </div>
    </div>
  );
}

// League page ( /{sport}/league/[slug] ) — date picker + standings + fixtures
export function LeagueSkeleton() {
  return (
    <Container>
      <PageTitle />
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 22 }}>
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} width={72} height={52} />)}
      </div>
      <TableBlock rows={10} cols={6} />
      <div style={{ height: 28 }} />
      <MatchGrid n={4} />
    </Container>
  );
}

// Security / privacy page — narrow, card grid
export function SecuritySkeleton() {
  return (
    <main className="container" style={{ paddingTop: 56, paddingBottom: 72, maxWidth: 760 }}>
      <Skeleton width={260} height={28} style={{ marginBottom: 10 }} />
      <Skeleton width="80%" height={14} style={{ marginBottom: 32 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
            <Skeleton width={40} height={40} radius={10} style={{ marginBottom: 12 }} />
            <Skeleton width="60%" height={15} style={{ marginBottom: 8 }} />
            <Skeleton width="100%" height={12} style={{ marginBottom: 6 }} />
            <Skeleton width="75%" height={12} />
          </div>
        ))}
      </div>
    </main>
  );
}

// Coming-soon ( /rugby )
export function ComingSoonSkeleton() {
  return (
    <div className="container" style={{ paddingTop: 96, paddingBottom: 120, textAlign: "center" }}>
      <Skeleton width={64} height={64} radius={16} style={{ margin: "0 auto 20px" }} />
      <Skeleton width={280} height={30} style={{ margin: "0 auto 14px" }} />
      <Skeleton width={360} height={14} style={{ margin: "0 auto 8px" }} />
      <Skeleton width={300} height={14} style={{ margin: "0 auto" }} />
    </div>
  );
}
