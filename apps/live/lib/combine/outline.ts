// The outlines combining works on (docs/specs/007-editor/logo-pages.md "Combine"): each combinable
// element's area as polygons in canvas px, its rotation applied, its curves traced to within
// COMBINE_TOLERANCE_PX. Pure; the boolean operation itself is combine.ts.
import {
  freehandCanvasPoints,
  freehandPenStroke,
  hasShapeArea,
  isPenStroke,
  outlineSegments,
  pathAnchors,
  pathContours,
  penStrokeOutline,
  samplePath,
  shapeAreaContours,
  SELF_PAINTING_SHAPES,
  type BoxedElement,
  type Point,
} from '@livediagram/document';

// No traced outline strays further than this from its shape, in canvas px.
export const COMBINE_TOLERANCE_PX = 0.25;

export type Ring = [number, number][];

/** Whether an element can be combined: a shape with an area, a closed path, or a closed or pen
 *  freehand stroke. */
export function isCombinable(el: BoxedElement): boolean {
  if (el.type === 'shape') return hasShapeArea(el.shape) && !SELF_PAINTING_SHAPES.has(el.shape);
  if (el.type === 'path') return el.closed && el.nodes.length >= 2;
  if (el.type === 'freehand') return el.pen !== 'highlighter' && (el.closed || isPenStroke(el));
  return false;
}

// A point turned by the element's rotation about its centre.
function placer(el: BoxedElement): (p: Point) => [number, number] {
  const deg = el.rotation ?? 0;
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  if (deg % 360 === 0) return (p) => [p.x, p.y];
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return (p) => [
    cx + (p.x - cx) * cos - (p.y - cy) * sin,
    cy + (p.x - cx) * sin + (p.y - cy) * cos,
  ];
}

/** The element's closed rings in canvas px, rotation applied; empty when it has none. A path's
 *  several contours are its islands and holes (even-odd), the caller resolving them. */
export function elementRings(el: BoxedElement): Ring[] {
  const place = placer(el);
  const rings: Point[][] = [];
  if (el.type === 'shape') {
    const local = shapeAreaContours(el, COMBINE_TOLERANCE_PX) ?? [];
    for (const ring of local) rings.push(ring.map((p) => ({ x: p.x + el.x, y: p.y + el.y })));
  } else if (el.type === 'path') {
    const { curve } = outlineSegments(Math.max(el.width, el.height) / 2, COMBINE_TOLERANCE_PX);
    for (const nodes of pathContours(el)) {
      rings.push(samplePath(pathAnchors({ ...el, nodes }), true, curve));
    }
  } else if (el.type === 'freehand') {
    rings.push(
      isPenStroke(el)
        ? penStrokeOutline(freehandPenStroke(el, { x: el.x, y: el.y }))
        : freehandCanvasPoints(el),
    );
  }
  return rings.filter((r) => r.length >= 3).map((r) => r.map(place));
}
