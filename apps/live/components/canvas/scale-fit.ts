// The auto-fit (`scale`) label's view box (docs/specs/008-canvas/canvas-and-palette.md "Off-centre
// alignment leaves room under Scale"). The label's SVG scales its measured text box with
// `preserveAspectRatio="… meet"`, which fills the box until one axis is full, leaving no room on that
// axis for an alignment to show. An off-centre alignment widens the view box along its own axis,
// away from the chosen edge, so the text can span at most SCALE_ALIGNED_AXIS_MAX_FILL of it.
import type { TextAlignX, TextAlignY } from '@livediagram/document';

/**
 * The most of the box an auto-fit label may span along an axis aligned off-centre.
 * Provenance: issue #490, the Sailboat hull, where Top looked identical to Middle; 0.6 lets a
 * one-word label sit visibly at the edge and still read large.
 * Safe range: 0.4 to 0.8 (below, the text looks lost; above, the move is hard to see).
 */
export const SCALE_ALIGNED_AXIS_MAX_FILL = 0.6;

export type ViewBox = { x: number; y: number; w: number; h: number };

// One axis: centred keeps the measured extent; off-centre grows it to extent / fill, with the
// growth on the side away from the edge the text keeps to.
function axis(start: number, size: number, edge: 'start' | 'mid' | 'end'): [number, number] {
  if (edge === 'mid') return [start, size];
  const grown = size / SCALE_ALIGNED_AXIS_MAX_FILL;
  return edge === 'start' ? [start, grown] : [start - (grown - size), grown];
}

/** The view box an auto-fit label draws its measured text box through. */
export function scaleFitViewBox(bbox: ViewBox, alignX: TextAlignX, alignY: TextAlignY): ViewBox {
  const [x, w] = axis(
    bbox.x,
    bbox.w,
    alignX === 'left' ? 'start' : alignX === 'right' ? 'end' : 'mid',
  );
  const [y, h] = axis(
    bbox.y,
    bbox.h,
    alignY === 'top' ? 'start' : alignY === 'bottom' ? 'end' : 'mid',
  );
  return { x, y, w, h };
}
