// Bending an arrow by dragging its line (docs/specs/008-canvas/arrow-bending.md, blueprint
// docs/specs/008-canvas/blueprints/arrow-bending.md).
//
// A press on the line is planned once, from the arrow as it stands, and every
// pointer move applies the plan to the total pointer delta. Pure and
// idempotent per frame: the same plan and delta always give the same patch.

import { arrowResolvedEnds } from './arrow-label-layout';
import { arrowPathPolyline, curveAnchorPoints, curveControlPoint } from './arrow-path';
import { arrowStyleOf } from './arrow-style';
import { distToSegment } from './geometry-primitives';
import type { ArrowElement, Element } from './index';

type Pt = { x: number; y: number };
type Delta = { dx: number; dy: number };

// The grab is held this far in from each end, so a press beside an arrowhead
// does not throw the bow out to infinity (the control point scales with
// 1 / (t (1 - t))).
export const BEND_T_MIN = 0.2;
// Samples used to find where on a quadratic the press landed.
const CURVE_SAMPLES = 64;

export type BendPlan =
  | { kind: 'bow'; from: Pt; to: Pt; t: number; grab: Pt }
  // `fromBow`: the points began as a single bow, converted to its apex; the bow's offset goes.
  | { kind: 'insert'; mid: Pt; points: Delta[]; index: number; grab: Pt; fromBow?: true }
  | { kind: 'slide'; mid: Pt; route: Pt[]; segment: number; dir: Pt; grab: Pt };

export type BendPatch = Partial<
  Pick<ArrowElement, 'arrowStyle' | 'curveOffset' | 'curvePoints' | 'elbowOffset'>
>;

const clampT = (t: number) => Math.min(1 - BEND_T_MIN, Math.max(BEND_T_MIN, t));

function nearestSegment(pts: Pt[], p: Pt): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(p, pts[i]!, pts[i + 1]!);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function planArrowBend(arrow: ArrowElement, elements: Element[], grab: Pt): BendPlan {
  const { from, to } = arrowResolvedEnds(arrow, elements);
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const style = arrowStyleOf(arrow);
  const points = arrow.curvePoints ?? [];
  const chord = Math.hypot(to.x - from.x, to.y - from.y);

  if (style === 'angled') {
    const route = arrowPathPolyline(
      'angled',
      from,
      to,
      arrow.from,
      arrow.to,
      arrow.curveOffset,
      arrow.elbowOffset,
      arrow.curvePoints,
    );
    const segment = nearestSegment(route, grab);
    const a = route[segment]!;
    const b = route[segment + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const dir = len > 1e-9 ? { x: (b.x - a.x) / len, y: (b.y - a.y) / len } : { x: 1, y: 0 };
    return { kind: 'slide', mid, route, segment, dir, grab };
  }

  if (points.length > 0 || chord < 1e-6) {
    const anchors = [from, ...curveAnchorPoints(from, to, points), to];
    return { kind: 'insert', mid, points, index: nearestSegment(anchors, grab), grab };
  }

  if (style === 'curved') {
    // A single bow gains a point (arrow-bending.md "Curved arrow with a single bow"): the bow
    // becomes a bend point at its apex, the point the quadratic passes through at its middle
    // (halfway from the chord's midpoint to the control point), and the grab is inserted beside
    // it, on whichever side of the apex it was grabbed. Its handle still reshapes the bow alone.
    const c = curveControlPoint(from, to, arrow.curveOffset, arrow.from, arrow.to);
    const apex = { dx: (c.x - mid.x) / 2, dy: (c.y - mid.y) / 2 };
    let bestT = 0.5;
    let bestDist = Infinity;
    for (let i = 0; i <= CURVE_SAMPLES; i++) {
      const t = i / CURVE_SAMPLES;
      const x = (1 - t) ** 2 * from.x + 2 * t * (1 - t) * c.x + t * t * to.x;
      const y = (1 - t) ** 2 * from.y + 2 * t * (1 - t) * c.y + t * t * to.y;
      const d = Math.hypot(grab.x - x, grab.y - y);
      if (d < bestDist) {
        bestDist = d;
        bestT = t;
      }
    }
    return {
      kind: 'insert',
      mid,
      points: [apex],
      index: bestT < 0.5 ? 0 : 1,
      grab,
      fromBow: true,
    };
  }

  const t =
    ((grab.x - from.x) * (to.x - from.x) + (grab.y - from.y) * (to.y - from.y)) / chord ** 2;
  return { kind: 'bow', from, to, t: clampT(t), grab };
}

export function applyArrowBend(plan: BendPlan, delta: Pt): BendPatch {
  const p = { x: plan.grab.x + delta.x, y: plan.grab.y + delta.y };
  switch (plan.kind) {
    case 'bow': {
      // The quadratic through `p` at t: solve B(t) = p for the control point.
      const { from, to, t } = plan;
      const k = 2 * t * (1 - t);
      const c = {
        x: (p.x - (1 - t) ** 2 * from.x - t * t * to.x) / k,
        y: (p.y - (1 - t) ** 2 * from.y - t * t * to.y) / k,
      };
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      return { arrowStyle: 'curved', curveOffset: { dx: c.x - mx, dy: c.y - my } };
    }
    case 'insert': {
      const next = plan.points.slice();
      next.splice(plan.index, 0, { dx: p.x - plan.mid.x, dy: p.y - plan.mid.y });
      return plan.fromBow
        ? { arrowStyle: 'curved', curveOffset: undefined, curvePoints: next }
        : { curvePoints: next };
    }
    case 'slide': {
      // Only the sideways part of the drag moves the segment.
      const along = delta.x * plan.dir.x + delta.y * plan.dir.y;
      const d = { x: delta.x - along * plan.dir.x, y: delta.y - along * plan.dir.y };
      const { route, segment } = plan;
      const last = route.length - 1;
      const out: Pt[] = [];
      route.forEach((v, j) => {
        const moved = { x: v.x + d.x, y: v.y + d.y };
        if (j === segment) {
          // An endpoint stays; its moved copy becomes a new jog beside it.
          if (j === 0) out.push(v, moved);
          else out.push(moved);
        } else if (j === segment + 1) {
          if (j === last) out.push(moved, v);
          else out.push(moved);
        } else {
          out.push(v);
        }
      });
      return {
        arrowStyle: 'angled',
        elbowOffset: undefined,
        curvePoints: out.slice(1, -1).map((v) => ({ dx: v.x - plan.mid.x, dy: v.y - plan.mid.y })),
      };
    }
  }
}
