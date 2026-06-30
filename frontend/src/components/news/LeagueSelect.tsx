"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { LEAGUES } from "@/types/football";

export default function LeagueSelect() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("league") ?? "all";

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete("league");
    else next.set("league", value);
    const qs = next.toString();
    router.push(qs ? `?${qs}` : "?");
  }

  const selectStyle: React.CSSProperties = {
    background: "var(--white)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 32px 8px 12px",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--obsidian)",
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    backgroundImage:
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23121212' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    backgroundSize: "12px",
    minWidth: 200,
  };

  return (
    <select
      value={current}
      onChange={handleChange}
      style={selectStyle}
      aria-label="Filter news by league or category"
    >
      <option value="all">All Competitions</option>

      <optgroup label="──────────────">
        <option value="transfer">Transfer News</option>
      </optgroup>

      <optgroup label="Leagues">
        {LEAGUES.map(l => (
          <option key={l.slug} value={l.slug}>{l.name}</option>
        ))}
      </optgroup>
    </select>
  );
}