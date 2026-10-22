// Ported from draw.io, Copyright (c) 2006-2015 JGraph Holdings Ltd and draw.io AG, Apache-2.0
// (packages/licences/texts/drawio-31.7.0-LICENSE.txt); translated to TypeScript and changed.
// draw.io's segment router, ported from jgraph/drawio v31.7.0 (mxEdgeStyle.SegmentConnector in
// mxgraph/src/view/mxEdgeStyle.js; Apache-2.0): an orthogonal route through the waypoints, each
// waypoint fixing one segment's x or y in turn. OrthConnector falls back to it for edges with
// waypoints and for fixed ends too close together.

import { contains, type Pt } from './geometry';
import {
  routingCenterX,
  routingCenterY,
  transformControlPoint,
  type EdgeStyle,
  type RouteBox,
} from './edge-styles';
import { styleValue, type CellState } from './state';

const TOL = 1;

/** mxEdgeStyle.scalePointArray at scale 1: rounded to a tenth. */
export const roundPoints = (points: (Pt | null)[]): (Pt | null)[] =>
  points.map((p) => (p ? { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 } : null));

/** mxEdgeStyle.scaleCellState at scale 1: the box rounded to a tenth. */
export function roundState<T extends RouteBox>(state: T | null): T | null {
  if (!state) return null;
  const r = (n: number) => Math.round(n * 10) / 10;
  return { ...state, x: r(state.x), y: r(state.y), width: r(state.width), height: r(state.height) };
}

const inside = (box: RouteBox | null, p: Pt | null | undefined) =>
  !!box && !!p && contains(box, p.x, p.y);

/** mxEdgeStyle.SegmentConnector */
export const segmentConnector: EdgeStyle = (
  edge,
  sourceScaled,
  targetScaled,
  controlHints,
  result,
) => {
  const pts = roundPoints(edge.absolutePoints);
  const source = roundState<CellState>(sourceScaled);
  const target = roundState<CellState>(targetScaled);
  const tempPoints: Pt[] = [];
  const addPoint = (p: Pt) => tempPoints.push(p);
  let lastPushed: Pt | null = result.length > 0 ? (result[0] ?? null) : null;
  let horizontal = true;
  let hint: Pt | null;
  // `var pe` in draw.io: only assigned when there are waypoints.
  let pe: Pt | null = null;

  const pushPoint = (p: Pt) => {
    p.x = Math.round(p.x * 10) / 10;
    p.y = Math.round(p.y * 10) / 10;
    if (!lastPushed || Math.abs(lastPushed.x - p.x) >= TOL || Math.abs(lastPushed.y - p.y) >= 1) {
      result.push(p);
      lastPushed = p;
    }
  };

  const first = pts[0] ?? null;
  const lastInx = pts.length - 1;
  const last = pts[lastInx] ?? null;
  let pt: Pt | null = first
    ? { ...first }
    : source
      ? { x: routingCenterX(source), y: routingCenterY(source) }
      : null;

  if (controlHints.length > 0) {
    let hints = controlHints.map((h) => transformControlPoint(edge, h));
    if (pt) {
      if (Math.abs(hints[0]!.x - pt.x) < TOL) hints[0]!.x = pt.x;
      if (Math.abs(hints[0]!.y - pt.y) < TOL) hints[0]!.y = pt.y;
    }
    pe = last;
    if (pe) {
      const h = hints[hints.length - 1]!;
      if (Math.abs(h.x - pe.x) < TOL) h.x = pe.x;
      if (Math.abs(h.y - pe.y) < TOL) h.y = pe.y;
    }
    hint = hints[0]!;
    let currentTerm: RouteBox | null = first ? null : source;
    let currentPt: Pt | null = first;
    let currentHint = hint;

    for (let i = 0; i < 2; i++) {
      const fixedVertAlign = !!currentPt && currentPt.x === currentHint.x;
      const fixedHozAlign = !!currentPt && currentPt.y === currentHint.y;
      const inHozChan =
        !!currentTerm &&
        currentHint.y >= currentTerm.y &&
        currentHint.y <= currentTerm.y + currentTerm.height;
      const inVertChan =
        !!currentTerm &&
        currentHint.x >= currentTerm.x &&
        currentHint.x <= currentTerm.x + currentTerm.width;
      const hozChan = fixedHozAlign || (!currentPt && inHozChan);
      const vertChan = fixedVertAlign || (!currentPt && inVertChan);

      if (!(i === 0 && ((hozChan && vertChan) || (fixedVertAlign && fixedHozAlign)))) {
        if (currentPt && !fixedHozAlign && !fixedVertAlign && (inHozChan || inVertChan)) {
          horizontal = !inHozChan;
          break;
        }
        if (vertChan || hozChan) {
          horizontal = hozChan;
          if (i === 1) horizontal = hints.length % 2 === 0 ? hozChan : vertChan;
          break;
        }
      }
      currentPt = last;
      currentTerm = currentPt ? null : target;
      currentHint = hints[hints.length - 1]!;
      if (fixedVertAlign && fixedHozAlign) hints = hints.slice(1);
    }

    if (pt) {
      if (
        horizontal &&
        ((first && first.y !== hint.y) ||
          (!first && source && (hint.y < source.y || hint.y > source.y + source.height)))
      ) {
        addPoint({ x: pt.x, y: hint.y });
      } else if (
        !horizontal &&
        ((first && first.x !== hint.x) ||
          (!first && source && (hint.x < source.x || hint.x > source.x + source.width)))
      ) {
        addPoint({ x: hint.x, y: pt.y });
      }
      if (horizontal) pt.y = hint.y;
      else pt.x = hint.x;
      for (const h of hints) {
        horizontal = !horizontal;
        hint = h;
        if (horizontal) pt.y = h.y;
        else pt.x = h.x;
        addPoint({ ...pt });
      }
    }
  } else {
    hint = pt;
    horizontal = true;
  }

  // The last point.
  pt = last ?? (target ? { x: routingCenterX(target), y: routingCenterY(target) } : null);
  if (pt && hint) {
    if (
      horizontal &&
      ((last && last.y !== hint.y) ||
        (!last && target && (hint.y < target.y || hint.y > target.y + target.height)))
    ) {
      addPoint({ x: pt.x, y: hint.y });
    } else if (
      !horizontal &&
      ((last && last.x !== hint.x) ||
        (!last && target && (hint.x < target.x || hint.x > target.x + target.width)))
    ) {
      addPoint({ x: hint.x, y: pt.y });
    }
  }

  // Bends inside a floating end's terminal go, unless a self-loop keeps them inside.
  if (
    !sourceScaled ||
    sourceScaled !== targetScaled ||
    String(styleValue(edge.style, 'innerLoopWaypoints') ?? '0') !== '1'
  ) {
    if (!first && source) {
      while (tempPoints.length > 0 && inside(source, tempPoints[0])) tempPoints.splice(0, 1);
    }
    if (!last && target) {
      while (tempPoints.length > 0 && inside(target, tempPoints[tempPoints.length - 1])) {
        tempPoints.splice(tempPoints.length - 1, 1);
      }
    }
  }

  for (const p of tempPoints) pushPoint(p);

  // The last bend within the tolerance of a fixed end goes; the one before lines up with it.
  const tail = result[result.length - 1];
  if (pe && tail && Math.abs(pe.x - tail.x) <= TOL && Math.abs(pe.y - tail.y) <= TOL) {
    result.splice(result.length - 1, 1);
    const before = result[result.length - 1];
    if (before) {
      if (Math.abs(before.x - pe.x) < TOL) before.x = pe.x;
      if (Math.abs(before.y - pe.y) < TOL) before.y = pe.y;
    }
  }
};
