// Scaling a free arrow by its selection frame (docs/specs/008-canvas/arrow-bending.md "Moving
// a free arrow"). The frame's corner and edge handles work like a box's: the
// opposite corner or edge stays put and the arrow stretches to follow. Ends
// scale about that anchor; bends are vectors from the chord middle, so they
// scale by the same factors. Pure: start snapshot + total delta in, patch out.

import type { ArrowElement } from './index';

type Pt = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };
export type FrameHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w';

// The smallest extent a drag may shrink an axis to, so it never collapses
// or flips through itself.
export const ARROW_SCALE_MIN_PX = 8;
// Below this an axis has no extent to scale (a horizontal arrow is 0 tall).
const FLAT_PX = 0.5;

export type ScalePatch = Partial<
  Pick<ArrowElement, 'from' | 'to' | 'curveOffset' | 'curvePoints' | 'elbowOffset'>
>;

export function scaleFreeArrow(
  arrow: ArrowElement,
  box: Box,
  handle: FrameHandle,
  delta: Pt,
  keepAspect: boolean,
): ScalePatch {
  const west = handle.includes('w');
  const east = handle.includes('e');
  const north = handle.includes('n');
  const south = handle.includes('s');
  const factor = (extent: number, grows: number): number =>
    extent < FLAT_PX ? 1 : Math.max(ARROW_SCALE_MIN_PX, extent + grows) / extent;
  let sx = west ? factor(box.width, -delta.x) : east ? factor(box.width, delta.x) : 1;
  let sy = north ? factor(box.height, -delta.y) : south ? factor(box.height, delta.y) : 1;
  if (keepAspect && (west || east) && (north || south)) {
    const s = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
    sx = box.width < FLAT_PX ? 1 : s;
    sy = box.height < FLAT_PX ? 1 : s;
  }
  // The anchor is the side opposite the handle.
  const ax = west ? box.x + box.width : box.x;
  const ay = north ? box.y + box.height : box.y;
  const point = (p: Pt): Pt => ({ x: ax + (p.x - ax) * sx, y: ay + (p.y - ay) * sy });
  const vector = (v: { dx: number; dy: number }) => ({ dx: v.dx * sx, dy: v.dy * sy });
  const patch: ScalePatch = {};
  if (arrow.from.kind === 'free') patch.from = { kind: 'free', ...point(arrow.from) };
  if (arrow.to.kind === 'free') patch.to = { kind: 'free', ...point(arrow.to) };
  if (arrow.curveOffset) patch.curveOffset = vector(arrow.curveOffset);
  if (arrow.curvePoints) patch.curvePoints = arrow.curvePoints.map(vector);
  if (arrow.elbowOffset) patch.elbowOffset = vector(arrow.elbowOffset);
  return patch;
}
