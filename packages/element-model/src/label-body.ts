// A shape's label body (docs/specs/008-canvas/canvas-and-palette.md "Shape primitives"): the band of
// its box its label sits in, when that is not the whole box. The canvas, the editor and every export
// read it, so a label sits in the same place wherever it is drawn.

import type { BoxedElement } from './element';

// The cylinder as drawn (shape-geometry.ts): its lid is an ellipse centred 15% down the box, 12%
// tall either way, and its base bulges down to 85% + 12%. The label sits on the front of the body,
// between the lid's lower edge and the base's.
export const CYLINDER_LID_BOTTOM = (15 + 12) / 100;
export const CYLINDER_BASE_BOTTOM = (85 + 12) / 100;

// A parallelogram (20,0 100,0 80,100 0,100) and a trapezoid (22,4 78,4 98,96 2,96) as drawn: their slanted
// sides cross the box's middle 10% and 12% in from each side, so the label keeps that far in.
export const PARALLELOGRAM_SIDE = 0.1;
export const TRAPEZOID_SIDE = 0.12;

/** How far in from the box's top and bottom the label's band starts, and from each side, in px. */
export type LabelBodyInset = { top: number; bottom: number; side: number };

const WHOLE_BOX: LabelBodyInset = { top: 0, bottom: 0, side: 0 };

/** The band a shape's label sits in, as insets from its box; the whole box for most kinds. */
export function labelBodyInset(el: BoxedElement): LabelBodyInset {
  if (el.type !== 'shape') return WHOLE_BOX;
  if (el.shape === 'parallelogram') return { top: 0, bottom: 0, side: el.width * PARALLELOGRAM_SIDE };
  if (el.shape === 'trapezoid') return { top: 0, bottom: 0, side: el.width * TRAPEZOID_SIDE };
  if (el.shape !== 'cylinder') return WHOLE_BOX;
  return {
    top: el.height * CYLINDER_LID_BOTTOM,
    bottom: el.height * (1 - CYLINDER_BASE_BOTTOM),
    side: 0,
  };
}
