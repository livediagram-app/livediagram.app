import type { ReactNode } from 'react';
import type { ShapeKind } from '@livediagram/diagram';

// Mini glyphs for every ShapeKind on a 16x16 viewBox, shown next to the shape
// kind picker in SelectedElementSection, the context-menu Shape category, and
// the style-preset swatches (spec/48) — so a preview tracks the user's actual
// shape (a circle previews as a circle, not a square).
//
// `ShapeGlyph` is the parameterised renderer (fill / stroke / weight / dash /
// size); `ShapeIcon` is the plain outline wrapper existing callers use. Shapes
// without bespoke geometry fall back to the rounded square so every kind draws
// something.
//
// Distinct from ShapeSvgOverlay in shape-svg-overlay.tsx: that one paints the
// canvas-sized shape at any aspect ratio (it owns the device-frame + cylinder +
// cloud geometry the canvas renders); these are the small flat preview tiles,
// hand-tuned for the 16x16 viewBox so the diamond and cylinder still read at
// icon scale.

// Per-kind inner geometry + the stroke width hand-tuned for it at icon scale.
const SHAPE_GLYPH: Partial<Record<ShapeKind, { sw: number; body: ReactNode }>> = {
  square: { sw: 1.5, body: <rect x="3" y="3" width="10" height="10" rx="1.5" /> },
  circle: { sw: 1.5, body: <circle cx="8" cy="8" r="5" /> },
  diamond: { sw: 1.5, body: <polygon points="8,3 13,8 8,13 3,8" /> },
  cylinder: {
    sw: 1.4,
    body: (
      <>
        <path d="M3 5 L3 12 A5 1.5 0 0 0 13 12 L13 5" />
        <ellipse cx="8" cy="5" rx="5" ry="1.5" />
      </>
    ),
  },
  parallelogram: { sw: 1.5, body: <polygon points="4,3 13,3 12,13 3,13" /> },
  hexagon: { sw: 1.5, body: <polygon points="5,3 11,3 14,8 11,13 5,13 2,8" /> },
  document: {
    sw: 1.4,
    body: <path d="M3 3 L13 3 L13 12 C11 13.4 9.5 11.5 8 12.6 C6.5 13.7 5 11.5 3 12.6 Z" />,
  },
  stadium: { sw: 1.5, body: <rect x="2" y="5" width="12" height="6" rx="3" /> },
  actor: {
    sw: 1.3,
    body: (
      <>
        <circle cx="8" cy="3.4" r="2" />
        <path d="M8 5.4 L8 10" />
        <path d="M4.5 7.2 L11.5 7.2" />
        <path d="M8 10 L5.5 13.6" />
        <path d="M8 10 L10.5 13.6" />
      </>
    ),
  },
  cloud: {
    sw: 1.3,
    body: (
      <path d="M5 12 C3 12 2 10.5 3.2 9.3 C2.3 8 3.7 6.6 5 7.2 C5.4 5.2 8.4 5 8.8 7.1 C10.6 6.3 12 8 10.9 9.3 C12 10.2 11.2 12 9.6 12 Z" />
    ),
  },
  browser: {
    sw: 1.3,
    body: (
      <>
        <rect x="2" y="3" width="12" height="10" rx="1.5" />
        <path d="M2 6 L14 6" />
      </>
    ),
  },
  monitor: {
    sw: 1.3,
    body: (
      <>
        <rect x="2" y="2.5" width="12" height="8" rx="1" />
        <path d="M5.5 13.5 L10.5 13.5" />
        <path d="M8 10.5 L8 13.5" />
      </>
    ),
  },
  laptop: {
    sw: 1.3,
    body: (
      <>
        <rect x="3" y="3" width="10" height="7" rx="0.8" />
        <path d="M1.5 12.5 L14.5 12.5 L13.5 10 L2.5 10 Z" />
      </>
    ),
  },
  phone: { sw: 1.3, body: <rect x="5" y="1.5" width="6" height="13" rx="1.4" /> },
  tablet: { sw: 1.3, body: <rect x="3" y="2" width="10" height="12" rx="1" /> },
  triangle: { sw: 1.3, body: <polygon points="8,2.5 14,13.5 2,13.5" /> },
  trapezoid: { sw: 1.3, body: <polygon points="4,3.5 12,3.5 15,12.5 1,12.5" /> },
  star: {
    sw: 1.3,
    body: (
      <polygon points="8,1.5 9.5,5.9 14.2,6 10.5,8.8 11.8,13.3 8,10.6 4.2,13.3 5.5,8.8 1.8,6 6.5,5.9" />
    ),
  },
  'speech-bubble': {
    sw: 1.3,
    body: (
      <path d="M3 2.5 H13 a1.5 1.5 0 0 1 1.5 1.5 V9 a1.5 1.5 0 0 1 -1.5 1.5 H6.5 L4 14 L5 11.5 H3 a1.5 1.5 0 0 1 -1.5 -1.5 V4 a1.5 1.5 0 0 1 1.5 -1.5 Z" />
    ),
  },
  smartwatch: {
    sw: 1.3,
    body: (
      <>
        <rect x="5" y="3.5" width="6" height="9" rx="2" />
        <path d="M6.5 3.5 V1.5 M9.5 3.5 V1.5 M6.5 12.5 V14.5 M9.5 12.5 V14.5 M11 7 H12.3" />
      </>
    ),
  },
};

// Fallback geometry for kinds without a bespoke glyph (frame, progress shapes,
// icon, …) so a preview always draws an outline.
const FALLBACK_GLYPH = SHAPE_GLYPH.square!;

// Parameterised shape glyph: an outline by default, or filled / dashed /
// weighted for the preset swatches. Always draws something (falls back to the
// rounded square for kinds without bespoke geometry).
export function ShapeGlyph({
  kind,
  fill = 'none',
  stroke = 'currentColor',
  strokeWidth,
  dash,
  size = 14,
}: {
  kind: ShapeKind;
  fill?: string;
  stroke?: string;
  // Overrides the per-shape default weight (in 16-unit viewBox units).
  strokeWidth?: number;
  // SVG stroke-dasharray (16-unit units) for dotted / dashed previews.
  dash?: string;
  size?: number;
}) {
  const g = SHAPE_GLYPH[kind] ?? FALLBACK_GLYPH;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth ?? g.sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dash}
      aria-hidden
    >
      {g.body}
    </svg>
  );
}

export function ShapeIcon({ kind }: { kind: ShapeKind }) {
  return <ShapeGlyph kind={kind} />;
}
