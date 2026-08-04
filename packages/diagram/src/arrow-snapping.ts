import { endpointPosition, type Point } from './geometry';
import {
  arrowLabelAnchor,
  arrowStyleOf,
  projectToArrow,
  type ArrowElement,
  type Element,
  type ElementId,
} from './index';

// ARROW-TO-ARROW SNAPPING (spec/50).
//
// Split out of geometry-snapping.ts, which had grown to four unrelated snap
// families under one roof (alignment, arrow endpoints to boxes, resize bounds,
// element anchors) plus this one. It shares nothing with them — no helper, no
// constant, in either direction — so it was a section comment away from being
// its own module already.
//
// Lets an arrow endpoint connect to a point ALONG another arrow's line — the
// sequence-diagram pattern. We offer evenly-spaced snap points so endpoints
// line up neatly, scaled to the arrow's length (~one every 24px), clamped.
const ARROW_SNAP_SPACING_PX = 24;
const ARROW_SNAP_MIN_DIVISIONS = 4;
const ARROW_SNAP_MAX_DIVISIONS = 40;

function arrowEnds(arrow: ArrowElement, elements: Element[]): { from: Point; to: Point } {
  return {
    from: endpointPosition(arrow.from, elements),
    to: endpointPosition(arrow.to, elements),
  };
}

// Absolute point at parametric position `t` along an arrow (offset 0 = on the
// line). Shares arrowLabelAnchor so it matches the rendered centreline exactly.
function arrowPointAtT(arrow: ArrowElement, from: Point, to: Point, t: number): Point {
  return arrowLabelAnchor(
    arrowStyleOf(arrow),
    from,
    to,
    arrow.from,
    arrow.to,
    arrow.curveOffset,
    arrow.elbowOffset,
    { t, offset: 0 },
    arrow.curvePoints,
  );
}

function arrowSnapDivisions(from: Point, to: Point): number {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.max(
    ARROW_SNAP_MIN_DIVISIONS,
    Math.min(ARROW_SNAP_MAX_DIVISIONS, Math.round(len / ARROW_SNAP_SPACING_PX)),
  );
}

// The evenly-spaced snap points (absolute coords + parametric `t`) along an
// arrow, for the editor to render as connection dots while dragging an
// endpoint near it.
export function arrowSnapPoints(
  arrow: ArrowElement,
  elements: Element[],
): { x: number; y: number; t: number }[] {
  const { from, to } = arrowEnds(arrow, elements);
  const n = arrowSnapDivisions(from, to);
  const out: { x: number; y: number; t: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = arrowPointAtT(arrow, from, to, t);
    out.push({ x: p.x, y: p.y, t });
  }
  return out;
}

// Snap a cursor to the nearest evenly-spaced point on a nearby arrow line.
// `threshold` gates on the PERPENDICULAR distance to the line (so you can snap
// anywhere along it, even between dots), then the position quantises to the
// nearest division so it lines up neatly. Skips `excludeId` (the dragged
// arrow) and any arrow already attached to it (prevents a two-arrow cycle).
export function snapToArrowPoint(
  cursor: Point,
  elements: Element[],
  threshold: number,
  excludeId: ElementId,
): { arrowId: ElementId; t: number; x: number; y: number; dist: number } | null {
  let best: { arrowId: ElementId; t: number; x: number; y: number; dist: number } | null = null;
  for (const el of elements) {
    if (el.type !== 'arrow' || el.id === excludeId) continue;
    if (
      (el.from.kind === 'on-arrow' && el.from.arrowId === excludeId) ||
      (el.to.kind === 'on-arrow' && el.to.arrowId === excludeId)
    )
      continue;
    const { from, to } = arrowEnds(el, elements);
    const proj = projectToArrow(
      arrowStyleOf(el),
      from,
      to,
      el.from,
      el.to,
      el.curveOffset,
      el.elbowOffset,
      cursor,
      el.curvePoints,
    );
    const dist = Math.abs(proj.offset);
    if (dist <= threshold && (best === null || dist < best.dist)) {
      const n = arrowSnapDivisions(from, to);
      const qt = Math.round(proj.t * n) / n;
      const p = arrowPointAtT(el, from, to, qt);
      best = { arrowId: el.id, t: qt, x: p.x, y: p.y, dist };
    }
  }
  return best ? { arrowId: best.arrowId, t: best.t, x: best.x, y: best.y, dist: best.dist } : null;
}
