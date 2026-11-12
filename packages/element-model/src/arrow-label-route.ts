// Arrow label route geometry (docs/specs/008-canvas/arrow-labels.md): the drawn route as a measured
// polyline, a point and the local direction at any distance along it, the clearance each end keeps for its
// head, and the spans (segments) a label may occupy. Re-exported from arrow-label-layout.ts.

import { arrowEndpointSpread } from './arrow-endpoint-spread';
import { arrowPathPolyline } from './arrow-path';
import {
  ARROWHEAD_SIZE_PX,
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowheadStartShapeOf,
  arrowStyleOf,
  type ArrowheadShape,
} from './arrow-style';
import { isErShape } from './er-heads';
import { endpointPosition } from './geometry';
import type { ArrowElement, Element } from './element';

export type Pt = { x: number; y: number };

export const END_STUB_PX = 12;
const LOCAL_DIRECTION_WINDOW_PX = 24;

export type Route = { pts: Pt[]; cum: number[]; length: number };

export function routeOf(pts: Pt[]): Route {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  }
  return { pts, cum, length: cum[cum.length - 1] ?? 0 };
}

export function pointAt(r: Route, s: number): Pt {
  const d = Math.max(0, Math.min(r.length, s));
  for (let i = 1; i < r.pts.length; i++) {
    if (d <= r.cum[i]! || i === r.pts.length - 1) {
      const seg = r.cum[i]! - r.cum[i - 1]!;
      const f = seg > 1e-9 ? (d - r.cum[i - 1]!) / seg : 0;
      const a = r.pts[i - 1]!;
      const b = r.pts[i]!;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
  }
  return r.pts[0] ?? { x: 0, y: 0 };
}

export function directionAt(r: Route, s: number): Pt {
  const a = pointAt(r, s - LOCAL_DIRECTION_WINDOW_PX);
  const b = pointAt(r, s + LOCAL_DIRECTION_WINDOW_PX);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return len > 1e-9 ? { x: (b.x - a.x) / len, y: (b.y - a.y) / len } : { x: 1, y: 0 };
}

// Endpoints as both renderers draw them: resolved, plus the converging-fan spread.
export function arrowResolvedEnds(arrow: ArrowElement, elements: Element[]): { from: Pt; to: Pt } {
  const rawFrom = endpointPosition(arrow.from, elements);
  const rawTo = endpointPosition(arrow.to, elements);
  const fs = arrowEndpointSpread(arrow.id, 'from', elements);
  const ts = arrowEndpointSpread(arrow.id, 'to', elements);
  return {
    from: { x: rawFrom.x + fs.x, y: rawFrom.y + fs.y },
    to: { x: rawTo.x + ts.x, y: rawTo.y + ts.y },
  };
}

export function arrowRoute(
  arrow: ArrowElement,
  elements: Element[],
): { route: Route; from: Pt; to: Pt } {
  const { from, to } = arrowResolvedEnds(arrow, elements);
  const pts = arrowPathPolyline(
    arrowStyleOf(arrow),
    from,
    to,
    arrow.from,
    arrow.to,
    arrow.curveOffset,
    arrow.elbowOffset,
    arrow.curvePoints,
  );
  return { route: routeOf(pts), from, to };
}

// The drawn route as a polyline, endpoints resolved the way both renderers do.
export function arrowRoutePoints(arrow: ArrowElement, elements: Element[]): Pt[] {
  return arrowRoute(arrow, elements).route.pts;
}

export function headLength(
  arrow: ArrowElement,
  shape: ArrowheadShape = arrowheadShapeOf(arrow),
): number {
  const base = (8 / ARROWHEAD_SIZE_PX.medium) * ARROWHEAD_SIZE_PX[arrowheadSizeOf(arrow)];
  // An ER end (er-heads.ts) runs 1.5 heads back from the table.
  return shape === 'diamond' || shape === 'diamond-hollow'
    ? base * 1.5
    : isErShape(shape)
      ? base * 1.5
      : base;
}

export function endClearances(arrow: ArrowElement): { start: number; end: number } {
  const ends = arrow.arrowEnds ?? 'to';
  return {
    start:
      ends === 'from' || ends === 'both'
        ? headLength(arrow, arrowheadStartShapeOf(arrow)) + END_STUB_PX
        : END_STUB_PX,
    end: ends === 'to' || ends === 'both' ? headLength(arrow) + END_STUB_PX : END_STUB_PX,
  };
}

export type Span = { start: number; end: number; atRouteStart: boolean; atRouteEnd: boolean };

export function segmentSpans(r: Route): Span[] {
  const spans: Span[] = [];
  for (let i = 1; i < r.pts.length; i++) {
    spans.push({
      start: r.cum[i - 1]!,
      end: r.cum[i]!,
      atRouteStart: i === 1,
      atRouteEnd: i === r.pts.length - 1,
    });
  }
  return spans;
}

export function openRunOf(span: Span, clear: { start: number; end: number }): [number, number] {
  return [
    span.start + (span.atRouteStart ? clear.start : END_STUB_PX),
    span.end - (span.atRouteEnd ? clear.end : END_STUB_PX),
  ];
}
