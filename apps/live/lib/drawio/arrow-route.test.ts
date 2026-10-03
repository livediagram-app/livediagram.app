import { describe, expect, it } from 'vitest';
import { arrowPathPolyline, type BoxedElement } from '@livediagram/document';
import {
  DRAWIO_CURVE_TOLERANCE_PX,
  axisOf,
  exitSide,
  nearestAnchor,
  routeShape,
  simplifyRoute,
  snapRouteEnds,
} from './arrow-route';

const box = (x: number, y: number, width: number, height: number): BoxedElement =>
  ({ id: 'b', type: 'shape', shape: 'square', x, y, width, height }) as BoxedElement;

describe('axisOf', () => {
  it('reads a segment less than a pixel off level as horizontal, and off plumb as vertical', () => {
    expect(axisOf({ x: 0, y: 653.2 }, { x: 118, y: 653 })).toBe('h');
    expect(axisOf({ x: 10, y: 0 }, { x: 10.5, y: 80 })).toBe('v');
    expect(axisOf({ x: 0, y: 0 }, { x: 30, y: 20 })).toBeNull();
  });
});

describe('exitSide', () => {
  it('names the side a segment leaves towards', () => {
    expect(exitSide({ x: 100, y: 25 }, { x: 300, y: 25 })).toBe('e');
    expect(exitSide({ x: 100, y: 25 }, { x: 100, y: 100 })).toBe('s');
    expect(exitSide({ x: 0, y: 25 }, { x: -40, y: 25 })).toBe('w');
    expect(exitSide({ x: 0, y: 25 }, { x: 40, y: 60 })).toBeNull();
  });
});

describe('nearestAnchor', () => {
  const a = box(0, 0, 100, 50);

  it('takes the anchor nearest the point on the side the route leaves through', () => {
    expect(nearestAnchor(a, { x: 100, y: 20 }, 'e')).toBe('e');
    expect(nearestAnchor(a, { x: 70, y: 50 }, 's')).toBe('sse');
  });

  it('leaves a side-middle point downwards from a bottom corner, not from the side', () => {
    // draw.io's segment router can run a fixed east exit straight down.
    expect(nearestAnchor(a, { x: 100, y: 25 }, 's')).toBe('se');
  });

  it('takes the nearest anchor of all for a slanted end', () => {
    expect(nearestAnchor(a, { x: 66.7, y: 50 }, null)).toBe('sse');
  });
});

describe('simplifyRoute', () => {
  it('drops repeated points and the corners of a straight run', () => {
    expect(
      simplifyRoute([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 50, y: 0.2 },
        { x: 100, y: 0 },
        { x: 100, y: 80 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
    ]);
  });

  it('keeps two ends for a route folded onto one point', () => {
    expect(simplifyRoute([{ x: 5, y: 5 }])).toEqual([
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ]);
  });
});

describe('snapRouteEnds', () => {
  it('moves the corner next to each end along with it, on the end segment’s axis', () => {
    const route = [
      { x: 100, y: 22 },
      { x: 200, y: 22 },
      { x: 200, y: 180 },
      { x: 350, y: 180 },
    ];
    expect(snapRouteEnds(route, { x: 100, y: 25 }, { x: 350, y: 175 }, true)).toEqual([
      { x: 100, y: 25 },
      { x: 200, y: 25 },
      { x: 200, y: 175 },
      { x: 350, y: 175 },
    ]);
  });

  it('turns a level orthogonal line whose ends no longer line up into a step halfway', () => {
    const route = [
      { x: 100, y: 30 },
      { x: 300, y: 30 },
    ];
    expect(snapRouteEnds(route, { x: 100, y: 25 }, { x: 300, y: 37.5 }, true)).toEqual([
      { x: 100, y: 25 },
      { x: 200, y: 25 },
      { x: 200, y: 37.5 },
      { x: 300, y: 37.5 },
    ]);
  });

  it('keeps a straight line straight', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 300, y: 30 },
    ];
    expect(snapRouteEnds(route, { x: 2, y: 0 }, { x: 300, y: 25 }, false)).toEqual([
      { x: 2, y: 0 },
      { x: 300, y: 25 },
    ]);
  });

  it('drops a corner the snap lines up', () => {
    const route = [
      { x: 100, y: 25 },
      { x: 200, y: 25 },
      { x: 200, y: 28 },
      { x: 300, y: 28 },
    ];
    expect(snapRouteEnds(route, { x: 100, y: 25 }, { x: 300, y: 25 }, true)).toEqual([
      { x: 100, y: 25 },
      { x: 300, y: 25 },
    ]);
  });
});

type P = { x: number; y: number };
// draw.io's curve (mxPolyline.paintCurvedLine): quadratics through the segment middles, the corners
// their control points, sampled finely.
function drawioCurve(pts: P[]): P[] {
  const out: P[] = [];
  const q = (a: P, c: P, b: P, t: number) => ({
    x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
    y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
  });
  let start = pts[0]!;
  const piece = (c: P, end: P) => {
    for (let i = 0; i <= 64; i++) out.push(q(start, c, end, i / 64));
    start = end;
  };
  for (let i = 1; i < pts.length - 2; i++) {
    piece(pts[i]!, { x: (pts[i]!.x + pts[i + 1]!.x) / 2, y: (pts[i]!.y + pts[i + 1]!.y) / 2 });
  }
  piece(pts[pts.length - 2]!, pts[pts.length - 1]!);
  return out;
}

// The farthest any point of `truth` lies from the polyline `drawn`.
function deviation(truth: P[], drawn: P[]): number {
  const toSegment = (p: P, a: P, b: P) => {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len = vx * vx + vy * vy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len));
    return Math.hypot(p.x - a.x - vx * t, p.y - a.y - vy * t);
  };
  return Math.max(
    ...truth.map((p) => Math.min(...drawn.slice(1).map((b, i) => toSegment(p, drawn[i]!, b)))),
  );
}

describe('routeShape', () => {
  const from = { x: 0, y: 0 };
  const to = { x: 100, y: 100 };

  it('draws a curve as straight when its chord is within the tolerance of draw.io’s', () => {
    const step = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 3 },
      { x: 200, y: 3 },
    ];
    expect(routeShape(step, true)).toEqual({ arrowStyle: 'straight' });
  });

  it('draws a route without corners straight', () => {
    expect(routeShape([from, to], true)).toEqual({ arrowStyle: 'straight' });
  });

  it('stores corners as bend points from the middle of the ends', () => {
    expect(routeShape([from, { x: 0, y: 50 }, { x: 100, y: 50 }, to], false)).toEqual({
      arrowStyle: 'angled',
      curvePoints: [
        { dx: -50, dy: 0 },
        { dx: 50, dy: 0 },
      ],
    });
  });

  it('makes a one-corner curve draw.io’s quadratic, its corner the control point', () => {
    expect(routeShape([from, { x: 100, y: 0 }, to], true)).toEqual({
      arrowStyle: 'curved',
      curveOffset: { dx: 50, dy: -50 },
    });
  });

  it.each([
    [
      'an S between two shapes',
      [
        { x: 70, y: 70 },
        { x: 160, y: 70 },
        { x: 160, y: 330 },
        { x: 250, y: 330 },
      ],
    ],
    [
      'a step that draws as its chord',
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 8 },
        { x: 200, y: 8 },
      ],
    ],
    [
      'a long route with three corners',
      [
        { x: 310, y: 100 },
        { x: 310, y: 160 },
        { x: 440, y: 160 },
        { x: 440, y: 70 },
        { x: 510, y: 70 },
      ],
    ],
  ])('draws %s within the tolerance of draw.io’s curve, through few points', (_, route) => {
    const shape = routeShape(route, true);
    const from = route[0]!;
    const to = route[route.length - 1]!;
    const free = (p: P) => ({ kind: 'free' as const, ...p });
    const drawn = arrowPathPolyline(
      shape.arrowStyle,
      from,
      to,
      free(from),
      free(to),
      undefined,
      undefined,
      shape.curvePoints,
    );
    expect(deviation(drawioCurve(route), drawn)).toBeLessThanOrEqual(DRAWIO_CURVE_TOLERANCE_PX);
    expect(deviation(drawn, drawioCurve(route))).toBeLessThanOrEqual(DRAWIO_CURVE_TOLERANCE_PX);
    // draw.io draws one quadratic per corner; a handful of points per quadratic keeps it workable.
    expect(shape.curvePoints?.length ?? 0).toBeLessThanOrEqual(4 * (route.length - 2));
  });
});
