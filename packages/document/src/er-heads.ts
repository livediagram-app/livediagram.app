// The ER ends' strokes (docs/specs/008-canvas/canvas-and-palette.md "Arrowhead shape"), in the arrowhead marker's
// 0..10 box: the line comes in from x = 0 and meets the table at x = 10 (the marker's attachment sits at x = 9).
// One geometry for the canvas markers and the export, so the two draw the same glyph.

import type { ArrowheadShape } from './arrow-style';

export type ErShape = 'one' | 'zero-or-one' | 'many' | 'zero-or-many' | 'one-or-many';
export type ErGlyph = {
  lines: readonly (readonly [number, number, number, number])[];
  // A ring, hollow on the paper: [cx, cy, r].
  rings: readonly (readonly [number, number, number])[];
};

const BAR = (x: number) => [x, 1, x, 9] as const;
const CROW = [
  [4, 5, 10, 0.5],
  [4, 5, 10, 9.5],
  [4, 5, 10, 5],
] as const;

export const ER_GLYPHS: Readonly<Record<ErShape, ErGlyph>> = {
  one: { lines: [BAR(5.5), BAR(7.5)], rings: [] },
  'zero-or-one': { lines: [BAR(7.5)], rings: [[3.5, 5, 2]] },
  many: { lines: CROW, rings: [] },
  'one-or-many': { lines: [...CROW, BAR(2)], rings: [] },
  'zero-or-many': { lines: CROW, rings: [[1.6, 5, 1.6]] },
};

export const isErShape = (shape: ArrowheadShape): shape is ErShape => shape in ER_GLYPHS;
