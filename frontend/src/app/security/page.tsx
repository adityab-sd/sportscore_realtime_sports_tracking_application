import type { Metadata } from "next";
import { EyeOff, BadgeX, Lock, ShieldCheck, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Security & Privacy | SportScore",
  description: "How SportScore protects your privacy and keeps the platform secure.",
};

const features = [
  {
    icon: EyeOff,
    title: "No tracking",
    body: "We never record how you click, scroll, or move through the site. Your browsing stays yours.",
  },
  {
    icon: BadgeX,
    title: "No ads",
    body: "A clean, distraction-free experience. Nothing sold, nothing tracked for advertisers.",
  },
  {
    icon: Lock,
    title: "Encrypted credentials",
    body: "Sensitive keys and configuration values are encrypted at rest and never exposed in our code.",
  },
  {
    icon: ShieldCheck,
    title: "Abuse protection",
    body: "Automated attacks and repeated login attempts are detected and blocked automatically.",
  },
];

export default function SecurityPrivacyPage() {
  return (
    <main className="container" style={{ paddingTop: 56, paddingBottom: 72, maxWidth: 760 }}>
      <header style={{ textAlign: "center", marginBottom: 48 }}>
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--navy)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <ShieldCheck size={26} color="#fff" strokeWidth={2} />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", margin: "0 0 8px" }}>
          Security &amp; privacy
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "#6b7280",
            margin: "0 auto",
            maxWidth: 480,
            lineHeight: 1.6,
          }}
        >
          Sport<span style={{ color: "var(--color-accent)" }}>Score</span> is built to be fast,
          open, and safe to use — no account required, nothing tracked.
        </p>
      </header>

      <section
        aria-label="Security and privacy features"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {features.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "22px 22px 20px",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "rgba(15, 27, 61, 0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <Icon size={18} color="var(--navy)" strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px", color: "var(--navy)" }}>
              {title}
            </h2>
            <p style={{ fontSize: 13.5, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>
              {body}
            </p>
          </div>
        ))}
      </section>

      <div
        style={{
          background: "var(--blue)",
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <CheckCircle2 size={20} color="#fff" strokeWidth={2} aria-hidden="true" />
        <p style={{ fontSize: 13.5, color: "#fff", margin: 0, lineHeight: 1.5 }}>
          Actively monitored and patched against known security vulnerabilities.
        </p>
      </div>
    </main>
  );
}