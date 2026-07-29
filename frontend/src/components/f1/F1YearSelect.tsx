"use client";

import { useRouter, usePathname } from "next/navigation";

/**
 * Season-year dropdown. Writes the choice to the `?year=` search param and lets
 * the (server) page re-fetch that season. `years[0]` is the default (current)
 * season, so selecting it drops the param to keep URLs clean.
 *
 * Note: deliberately does NOT use useSearchParams() — that hook forces a Suspense
 * boundary and breaks the build for every page that renders this component. `year`
 * is the only param these F1 pages read, so rebuilding the URL from the pathname
 * alone is safe and avoids that footgun.
 */
export default function F1YearSelect({ years, current }: { years: number[]; current: number }) {
  const router = useRouter();
  const pathname = usePathname();

  function onChange(year: number) {
    router.push(year === years[0] ? pathname : `${pathname}?year=${year}`);
  }

  return (
    <div className="f1-year-select">
      <select
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Season"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <svg className="f1-year-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}