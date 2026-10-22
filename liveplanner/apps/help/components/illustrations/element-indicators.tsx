// Illustrations for the Element Indicators article (docs/specs/008-canvas/element-indicators.md):
// the three styles side by side, where the indicators sit on a box, a round shape and an element
// too small for them, and a mind map root's commands appearing on hover. Glyphs, words and hover
// cards are lifted from apps/editor: components/canvas/ElementIndicators.tsx and
// components/canvas/indicator-items.ts. Each glyph is drawn in the element's own text colour at
// half strength, the way the editor draws it at rest.

import type { ReactNode } from 'react';

type GlyphKind = 'link' | 'note' | 'action' | 'comment' | 'outline' | 'tidy';

/** One indicator glyph, drawn in a 14-unit box centred on (cx, cy). `strength` is the opacity:
 *  0.5 at rest, 0.85 while the element is hovered, 1 under the pointer. */
export function Glyph({
  kind,
  cx,
  cy,
  scale = 1,
  strength = 0.5,
}: {
  kind: GlyphKind;
  cx: number;
  cy: number;
  scale?: number;
  strength?: number;
}) {
  const s = {
    className: 'stroke-slate-800',
    strokeWidth: 1.5,
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  let body: ReactNode;
  switch (kind) {
    case 'link':
      body = (
        <g {...s}>
          <path d="M-2 2 L2 -2" />
          <path d="M-0.5 -3.5 L1.2 -5.2 a2.6 2.6 0 0 1 3.7 3.7 L3.2 0.2" />
          <path d="M0.5 3.5 L-1.2 5.2 a2.6 2.6 0 0 1 -3.7 -3.7 L-3.2 -0.2" />
        </g>
      );
      break;
    case 'note':
      body = (
        <g {...s}>
          <rect x={-4.5} y={-5.5} width={9} height={11} rx={1.5} />
          <path d="M-2 -2 H2 M-2 0.8 H2 M-2 3.4 H0.5" />
        </g>
      );
      break;
    case 'action':
      body = (
        <g {...s}>
          <rect x={-4.5} y={-4.5} width={9} height={10.5} rx={1.5} />
          <rect x={-2} y={-6} width={4} height={2.6} rx={0.8} />
          <path d="M-2 1 L-0.5 2.6 L2.4 -0.4" />
        </g>
      );
      break;
    case 'comment':
      body = (
        <path d="M-5.5 -4.5 H5.5 V2.5 H-1 L-4 5.5 V2.5 H-5.5 Z" {...s} strokeLinejoin="round" />
      );
      break;
    case 'outline':
      body = (
        <g {...s}>
          <path d="M-5 -4 H5 M-2 0 H5 M-2 4 H5" />
          <path d="M-5 0 H-4 M-5 4 H-4" />
        </g>
      );
      break;
    case 'tidy':
      body = (
        <g {...s}>
          <circle cx={-4} cy={0} r={1.6} />
          <circle cx={4} cy={-4} r={1.6} />
          <circle cx={4} cy={4} r={1.6} />
          <path d="M-2.4 0 H0 V-4 H2.4 M0 0 V4 H2.4" />
        </g>
      );
      break;
  }
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`} opacity={strength}>
      {body}
    </g>
  );
}

// --- The three styles ---------------------------------------------------------------------------

// --- Where they sit -----------------------------------------------------------------------------

// --- A mind map root's commands -----------------------------------------------------------------
