// The drawing parts the versatility feature illustrations are built from:
// the shape-library glyph the Shapes card cycles through, and the four small
// icons its neighbours hang on their cards.
//
// Split out of versatility.tsx for the same reason as canvas-parts.tsx — these
// sat between the scenes that use them, so the file alternated between two
// kinds of thing with nothing marking which you were reading.
//
// Versatility-specific on purpose: ./shared holds what every feature-art file
// uses (Frame and the colour constants), and none of these are wanted
// elsewhere.

import { BLUE_STROKE } from './shared';

export function ShapeGlyph({ kind }: { kind: string }) {
  const c = {
    width: 15,
    height: 15,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    'aria-hidden': true,
  } as const;
  switch (kind) {
    case 'square':
      return (
        <svg {...c}>
          <rect x="3" y="3" width="10" height="10" rx="2" />
        </svg>
      );
    case 'circle':
      return (
        <svg {...c}>
          <circle cx="8" cy="8" r="5" />
        </svg>
      );
    case 'diamond':
      return (
        <svg {...c}>
          <polygon points="8,3 13,8 8,13 3,8" strokeLinejoin="round" />
        </svg>
      );
    case 'hexagon':
      return (
        <svg {...c}>
          <polygon points="4,3 11,3 14,8 11,13 4,13 1,8" strokeLinejoin="round" />
        </svg>
      );
    case 'cylinder':
      return (
        <svg {...c}>
          <path d="M3 5 L3 12 A5 1.5 0 0 0 13 12 L13 5" strokeLinejoin="round" />
          <ellipse cx="8" cy="5" rx="5" ry="1.5" />
        </svg>
      );
    case 'browser':
      return (
        <svg {...c}>
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <line x1="2" y1="6" x2="14" y2="6" />
          <circle cx="4" cy="4.5" r="0.5" fill="currentColor" />
          <circle cx="5.8" cy="4.5" r="0.5" fill="currentColor" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...c}>
          <rect x="5" y="2" width="6" height="12" rx="1.5" />
          <line x1="7" y1="3.4" x2="9" y2="3.4" />
        </svg>
      );
    case 'tablet':
      return (
        <svg {...c}>
          <rect x="3.5" y="2.5" width="9" height="11" rx="1.5" />
          <circle cx="8" cy="12" r="0.5" fill="currentColor" />
        </svg>
      );
  }
  return null;
}

export function NoteIcon() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M3 2.5 H13 V13.5 H3 Z" strokeLinejoin="round" />
      <path d="M5.5 6 H10.5 M5.5 9 H9" strokeLinecap="round" />
    </svg>
  );
}

export function WandIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 16 16"
      fill="none"
      stroke={BLUE_STROKE}
      strokeWidth="1.5"
    >
      <path d="M3 13 L11 5" strokeLinecap="round" />
      <path
        d="M12 2 l0.7 1.8 L14.5 4.5 l-1.8 0.7 L12 7 l-0.7-1.8 L9.5 4.5 l1.8-0.7 Z"
        fill={BLUE_STROKE}
        stroke="none"
      />
    </svg>
  );
}

export function PencilGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="#64748b" strokeWidth="1.5">
      <path d="M11 2.5 L13.5 5 L5 13.5 L2.5 13.5 L2.5 11 Z" strokeLinejoin="round" />
    </svg>
  );
}

export function SparkleIcon({ light = false }: { light?: boolean }) {
  return (
    <svg width="9" height="9" viewBox="0 0 16 16" fill={light ? '#fff' : BLUE_STROKE} aria-hidden>
      <path d="M8 1 l1.4 4.2 L13.6 6.6 l-4.2 1.4 L8 12.2 l-1.4 -4.2 L2.4 6.6 l4.2 -1.4 Z" />
      <path d="M13 9.5 l0.55 1.65 L15.2 11.7 l-1.65 0.55 L13 13.9 l-0.55 -1.65 L10.8 11.7 l1.65 -0.55 Z" />
    </svg>
  );
}
