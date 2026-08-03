"use client";

/**
 * SubIcon — substitution marker built from the circular-swap icon.
 * The two arcs are coloured: GREEN = player coming on, RED = player going off.
 * Use everywhere a substitution is shown for a consistent look.
 */
export default function SubIcon({
  size = 20,
  green = "#16a34a",
  red = "#dc2626",
  style,
}: {
  size?: number;
  green?: string;
  red?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {/* Top-right arc + arrowhead → GREEN (coming on) */}
      <path
        d="M18.2002 6.94416C16.7332 5.14727 14.5006 4 12 4C7.58172 4 4 7.58172 4 12C4 12.3387 4.02104 12.6724 4.06189 13"
        stroke={green}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.2002 4V6.99993L15.2002 7"
        stroke={green}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom-left arc + arrowhead → RED (going off) */}
      <path
        d="M6 17.2916C7.46589 18.9525 9.61061 20 12 20C16.4183 20 20 16.4183 20 12C20 11.6613 19.979 11.3276 19.9381 11"
        stroke={red}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 17H6V17.2916M6 20V17.2916"
        stroke={red}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
