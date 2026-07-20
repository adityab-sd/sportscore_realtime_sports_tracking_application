// ADDRESSED: Empty schedule page breaks the route — added a proper default export
// with a coming-soon state so /f1/schedule renders as a valid App Router page.
import Link from "next/link";

export default function F1SchedulePage() {
  return (
    <div style={{ maxWidth: 520, margin: "80px auto", padding: "0 var(--gap)", textAlign: "center" }}>
      <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 12px" }}>
        F1 Schedule
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>
        Race schedule data is not available yet. Check back soon.
      </p>
      <Link href="/f1" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>← Back to F1</Link>
    </div>
  );
}
