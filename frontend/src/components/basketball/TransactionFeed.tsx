"use client";

import { BBTransaction } from "@/lib/api/basketball";
import { formatShortDate } from "@/lib/formatDate";

export default function TransactionFeed({ transactions }: { transactions: BBTransaction[] }) {
  const safe = Array.isArray(transactions) ? transactions : [];
  if (safe.length === 0) return null;
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Transactions</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{safe.length}</span>
      </div>
      {safe.map((tx, i) => (
        <div key={tx.id || `${tx.date}:${tx.description}`} style={{ padding: "11px 18px", borderBottom: i < safe.length - 1 ? "1px solid var(--border)" : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            {tx.team && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)" }}>{tx.team}</span>}
            {tx.date && <span style={{ fontSize: 11, color: "var(--text-muted)" }} suppressHydrationWarning>{formatShortDate(tx.date)}</span>}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45 }}>{tx.description}</div>
        </div>
      ))}
    </div>
  );
}