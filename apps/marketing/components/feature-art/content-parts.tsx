// The line-art glyphs the content cards draw (icons and component tiles), shared by ./content and
// ./content-tech. Not in the FeatureArt barrel, so its Glyph never meets canvas-parts' own.

import type { ReactNode } from 'react';

// A 16-unit line glyph, placed at (x, y) and drawn `size` across.
export function Glyph({
  x,
  y,
  size = 12,
  className,
  children,
}: {
  x: number;
  y: number;
  size?: number;
  className: string;
  children: ReactNode;
}) {
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const ICON_PATHS: Record<string, ReactNode> = {
  server: (
    <>
      <rect x="2.5" y="2.5" width="11" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="11" height="4.5" rx="1" />
      <path d="M5 4.75h.01M5 11.25h.01" strokeWidth="2" />
    </>
  ),
  database: (
    <>
      <ellipse cx="8" cy="4" rx="5" ry="1.8" />
      <path d="M3 4v8a5 1.8 0 0 0 10 0V4" />
      <path d="M3 8a5 1.8 0 0 0 10 0" />
    </>
  ),
  cloud: <path d="M5 12.5a3 3 0 0 1 .3-6 3.6 3.6 0 0 1 6.8 1 2.5 2.5 0 0 1-.4 5z" />,
  user: (
    <>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3.5 13.5a4.5 4.5 0 0 1 9 0" />
    </>
  ),
  lock: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </>
  ),
  bolt: <path d="M9 2 4 9h3.5L7 14l5-7H8.5z" />,
  globe: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M2.5 8h11M8 2.5c-3 3.5-3 7.5 0 11M8 2.5c3 3.5 3 7.5 0 11" />
    </>
  ),
  queue: (
    <>
      <rect x="2" y="5" width="3" height="6" rx="0.8" />
      <rect x="6.5" y="5" width="3" height="6" rx="0.8" />
      <rect x="11" y="5" width="3" height="6" rx="0.8" />
    </>
  ),
};
