"use client";

interface Props {
  title: string;
  description?: string;
}

export default function ComingSoon({ title, description }: Props) {
  return (
    <div style={{
      background: "var(--cloud)",
      border: "1px dashed var(--border)",
      borderRadius: 12,
      padding: "28px 24px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {description ?? "Coming soon — backend integration in progress."}
      </div>
    </div>
  );
}
