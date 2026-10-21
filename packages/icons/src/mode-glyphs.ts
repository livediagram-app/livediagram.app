// The selection-mode glyphs (docs/specs/008-canvas/canvas-and-palette.md), as data: the ONE drawing of each
// mode that the editor's palette renders (through <Prims>), plus the Highlighter, a former mode whose glyph its
// Draw tile kept; `units` is the glyph's viewBox.

import { lucidePaintRoller, lucideSquareDashedMousePointer } from './lucide.generated';
import type { StyledPrim } from './types';

export type ModeGlyph = { units: 16 | 24; prims: readonly StyledPrim[] };

export const MODE_GLYPHS: Record<string, ModeGlyph> = {
  select: { units: 24, prims: lucideSquareDashedMousePointer },
  // An open hand: four finger capsules and a palm curling in from the wrist.
  pan: {
    units: 24,
    prims: [
      { t: 'path', d: 'M18 11V6a2 2 0 0 0-4 0' },
      { t: 'path', d: 'M14 10V4a2 2 0 0 0-4 0v2' },
      { t: 'path', d: 'M10 10.5V6a2 2 0 0 0-4 0v8' },
      {
        t: 'path',
        d: 'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
      },
    ],
  },
  // A tilted block eraser sitting on the canvas line.
  eraser: {
    units: 16,
    prims: [
      {
        t: 'path',
        d: 'M3 10.5l4.5-4.5a1.3 1.3 0 0 1 1.8 0l2.7 2.7a1.3 1.3 0 0 1 0 1.8l-2.7 2.7H5.2z',
      },
      { t: 'path', d: 'M6.2 7.3l3.5 3.5' },
      { t: 'path', d: 'M2.5 13.5h11' },
    ],
  },
  format: { units: 24, prims: lucidePaintRoller },
  // A cube: the top rhombus and the two front faces.
  isometric: {
    units: 16,
    prims: [
      { t: 'path', d: 'M8 1.8l5.2 3v0L8 7.8 2.8 4.8z' },
      { t: 'path', d: 'M2.8 4.8v5.4L8 13.2v-5.4' },
      { t: 'path', d: 'M13.2 4.8v5.4L8 13.2' },
    ],
  },
  // A marker over a faint, heavy stroke of highlight. Not a selection mode any more: the
  // Highlighter is a Draw tile (docs/specs/008-canvas/highlighter.md), which keeps this drawing.
  highlighter: {
    units: 16,
    prims: [
      { t: 'path', d: 'M3.5 10.5 L9 5 L11.5 7.5 L6 13 Z' },
      { t: 'path', d: 'M9 5 L11 2.5 L14 5.5 L11.5 7.5' },
      { t: 'path', d: 'M2 14.5 H9', sw: 2.4, opacity: 0.45 },
    ],
  },
};
