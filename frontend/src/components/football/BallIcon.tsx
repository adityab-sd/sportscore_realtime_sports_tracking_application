"use client";

/**
 * BallIcon — the standard SportScore football icon.
 * Classic soccer-ball mark (pentagon panels in a circle). Use this everywhere
 * a goal / football icon is needed so the look is consistent across the app.
 */
export default function BallIcon({
  size = 20,
  color = "currentColor",
  className,
  style,
}: {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 385 385"
      width={size}
      height={size}
      fill={color}
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M192.5,0C86.355,0,0,86.355,0,192.5C0,298.645,86.355,385,192.5,385C298.645,385,385,298.645,385,192.5 C385,86.355,298.645,0,192.5,0z M306.912,115.531l-65.753,37.963l-39.207-22.638V54.932l38.601-22.286 c24.608,7.418,47.513,20.692,66.359,38.457V115.531L306.912,115.531z M201.952,330.066v-75.924l39.207-22.637l65.753,37.963v44.428 c-18.848,17.766-41.751,31.038-66.359,38.457L201.952,330.066z M359.408,192.5c0,12.918-1.494,25.801-4.443,38.311L316.361,253.1 l-65.752-37.963v-45.271l65.752-37.962l38.604,22.287C357.914,166.699,359.408,179.582,359.408,192.5z M78.088,269.469 l65.753-37.963l39.206,22.637v75.924l-38.601,22.287c-24.608-7.419-47.512-20.691-66.358-38.457V269.469z M183.047,54.933v75.924 l-39.206,22.638l-65.753-37.963V71.105c18.847-17.764,41.75-31.038,66.358-38.457L183.047,54.933z M134.393,169.864v45.271 l-65.754,37.962l-38.604-22.287c-2.948-12.508-4.442-25.391-4.442-38.312s1.494-25.804,4.442-38.311l38.604-22.287L134.393,169.864 z" />
    </svg>
  );
}
