// Shimmer skeleton primitive. Server-safe (no client JS). Relies on the
// `.skeleton` / @keyframes shimmer rule in globals.css.

export default function Skeleton({
  width = "100%",
  height = 16,
  radius = 8,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className="skeleton"
      aria-hidden
      style={{ display: "block", width, height, borderRadius: radius, ...style }}
    />
  );
}
