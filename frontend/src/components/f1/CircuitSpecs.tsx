import type { CircuitDetails } from "@/lib/circuits";
import CircuitMap from "./CircuitMap";

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: "18px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#67676d" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#15151e", marginTop: 6, lineHeight: 1.15 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#67676d", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// Circuit stats come from the CIRCUITS registry (circuits.ts). If the weekend
// couldn't be matched to a circuit, the whole section is omitted rather than
// showing empty fields.
export default function CircuitSpecs({ details }: { details: CircuitDetails | null }) {
  if (!details) return null;

  return (
    <section id="circuit" style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 4px", fontStyle: "italic", color: "#15151e" }}>Circuit</h2>
      <div style={{ fontSize: 14, color: "#67676d", marginBottom: 16 }}>
        {details.flagEmoji} {details.name} · {details.city}, {details.country}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: 20, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220 }}>
          <CircuitMap src={details.mapImage} alt={`${details.name} layout`} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <MetricCard label="First Grand Prix" value={String(details.firstGrandPrix)} />
          <MetricCard label="Circuit length" value={details.lengthKm} />
          <MetricCard label="Number of laps" value={String(details.laps)} />
          <MetricCard label="Race distance" value={details.raceDistanceKm} />
          <MetricCard label="Lap record" value={details.lapRecord.time} sub={`${details.lapRecord.driver} (${details.lapRecord.year})`} />
        </div>
      </div>

      {details.description && (
        <p style={{ marginTop: 20, fontSize: 15, lineHeight: 1.65, color: "#3a3a3f", maxWidth: 760 }}>{details.description}</p>
      )}
    </section>
  );
}