// A freehand element's points (docs/specs/006-document/stroke-points.md): laying raw canvas points
// out in a box and packing them, and reading a stroke's packed points back through the shared
// decode cache. Every writer and reader of a stroke's points goes through here or the codec.
import { decodeStrokePoints } from './stroke-points-cache';
import { encodeStrokePoints, type NormalisedPoint, type StrokePoints } from './stroke-points';
import type { Point } from './geometry-primitives';
import type { FreehandElement } from './element-types';

type Box = Pick<FreehandElement, 'x' | 'y' | 'width' | 'height'>;

// A box and its normalised points, before packing: what the live ink lays out each sample.
export type FreehandGeometry = Pick<FreehandElement, 'x' | 'y' | 'width' | 'height'> & {
  points: NormalisedPoint[];
};

// A freehand's box and normalised points for raw canvas-coord points: the
// bounds padded by a pixel on each side (so a perfectly straight line still has
// a dimension to normalise against; dividing by 0 would make NaN points), grown
// outwards to whole canvas px, and every point normalised into [0..1] inside it,
// so the saved element resizes proportionally. No points: a 1x1 box at the
// origin. Shared with the whiteboard pen's live ink, which lays itself out as
// exactly the stroke it lands as (docs/specs/023-whiteboard/whiteboard.md
// "Pens"). The whole-px box is what keeps drawn ink still while the stroke
// grows: layout snaps a positioned box and its svg to the pixel grid, so a
// fractional origin that moved with every sample re-rasterised the whole path
// at a new sub-pixel offset; a box on whole px moves by whole px only, which
// the path's coordinates absorb exactly.
export function freehandGeometry(rawPoints: readonly { x: number; y: number }[]): FreehandGeometry {
  if (rawPoints.length === 0) return { x: 0, y: 0, width: 1, height: 1, points: [] };
  let minX = rawPoints[0]!.x;
  let maxX = rawPoints[0]!.x;
  let minY = rawPoints[0]!.y;
  let maxY = rawPoints[0]!.y;
  for (const p of rawPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const PAD = 1;
  const x = Math.floor(minX - PAD);
  const y = Math.floor(minY - PAD);
  const width = Math.ceil(maxX + PAD) - x;
  const height = Math.ceil(maxY + PAD) - y;
  const points = rawPoints.map((p) => ({ nx: (p.x - x) / width, ny: (p.y - y) / height }));
  return { x, y, width, height, points };
}

// The box and packed points for raw canvas-coord points (docs/specs/006-document/stroke-points.md):
// freehandGeometry's box, its points and any pressures in one block. What every writer of a
// stroke's points calls: drawing, the eraser's pieces, imports.
export function packFreehandPoints(
  rawPoints: readonly { x: number; y: number }[],
  pressures?: readonly number[],
): Pick<FreehandElement, 'x' | 'y' | 'width' | 'height' | 'packedPoints'> {
  const { points, ...box } = freehandGeometry(rawPoints);
  return { ...box, packedPoints: encodeStrokePoints(points, pressures) };
}

/** The stroke's decoded points, shared and memoised: never written into. */
export function freehandStrokePoints(el: Pick<FreehandElement, 'packedPoints'>): StrokePoints {
  return decodeStrokePoints(el.packedPoints);
}

/**
 * The stroke's points on the canvas (rotation not applied). A box side below `minSide` counts as
 * `minSide`: the pen outline draws in a box at least 1 px each way.
 */
export function freehandCanvasPoints(
  el: Box & Pick<FreehandElement, 'packedPoints'>,
  minSide = 0,
): Point[] {
  const { count, nx, ny } = freehandStrokePoints(el);
  const w = Math.max(el.width, minSide);
  const h = Math.max(el.height, minSide);
  const out = new Array<Point>(count);
  for (let i = 0; i < count; i++) out[i] = { x: el.x + nx[i]! * w, y: el.y + ny[i]! * h };
  return out;
}

/** The stroke's normalised points as objects, for code that reads them one by one. */
export function freehandNormalisedPoints(
  el: Pick<FreehandElement, 'packedPoints'>,
): NormalisedPoint[] {
  const { count, nx, ny } = freehandStrokePoints(el);
  const out = new Array<NormalisedPoint>(count);
  for (let i = 0; i < count; i++) out[i] = { nx: nx[i]!, ny: ny[i]! };
  return out;
}

/** A pen's pressure per point, when it reported them; undefined for a constant-width stroke. */
export function freehandPressures(el: Pick<FreehandElement, 'packedPoints'>): number[] | undefined {
  const { pressures } = freehandStrokePoints(el);
  return pressures ? Array.from(pressures) : undefined;
}
