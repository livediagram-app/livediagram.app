// Face-placed anchors (docs/specs/008-canvas/arrow-anchors.md "Anchors per
// shape"): on a triangle, hexagon, parallelogram or trapezoid an anchor sits
// at a point along one of the drawn faces rather than where the box anchor
// projects onto the outline. The points are derived from each kind's polygon
// in the shared geometry table, so a silhouette change moves its anchors
// with it. Coordinates are in the kind's 0..100 box.

import type { Anchor } from './arrow-types';
import { shapePolygonVertices } from './shape-geometry';
import type { ShapeKind } from './shape-kind';

type P = readonly [number, number];
type Layout = Partial<Record<Anchor, P>>;

const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Four-sided kinds, vertices top-left, top-right, bottom-right, bottom-left:
// corners on the corners, top and bottom middles on the vertical centre
// line, each top / bottom quarter halfway between that middle and the nearer
// corner of its face, and the side faces at a quarter, a half, three quarters.
function quadLayout([tl, tr, br, bl]: P[]): Layout {
  const n: P = [50, tl![1]];
  const s: P = [50, bl![1]];
  return {
    nw: tl!,
    nnw: mid(n, tl!),
    n,
    nne: mid(n, tr!),
    ne: tr!,
    ene: lerp(tr!, br!, 0.25),
    e: lerp(tr!, br!, 0.5),
    ese: lerp(tr!, br!, 0.75),
    se: br!,
    sse: mid(s, br!),
    s,
    ssw: mid(s, bl!),
    sw: bl!,
    wsw: lerp(tl!, bl!, 0.75),
    w: lerp(tl!, bl!, 0.5),
    wnw: lerp(tl!, bl!, 0.25),
  };
}

// Flat-top hexagon, vertices top-left, top-right, right, bottom-right,
// bottom-left, left: three on the top and bottom faces (a middle and a
// quarter halfway to each end); the corners and side quarters split each
// slanted face into thirds; the side middles are the side points.
function hexagonLayout([t1, t2, r, b2, b1, l]: P[]): Layout {
  const n = mid(t1!, t2!);
  const s = mid(b1!, b2!);
  return {
    nnw: mid(n, t1!),
    n,
    nne: mid(n, t2!),
    ne: lerp(t2!, r!, 1 / 3),
    ene: lerp(t2!, r!, 2 / 3),
    e: r!,
    ese: lerp(r!, b2!, 1 / 3),
    se: lerp(r!, b2!, 2 / 3),
    sse: mid(s, b2!),
    s,
    ssw: mid(s, b1!),
    sw: lerp(l!, b1!, 2 / 3),
    wsw: lerp(l!, b1!, 1 / 3),
    w: l!,
    wnw: lerp(t1!, l!, 2 / 3),
    nw: lerp(t1!, l!, 1 / 3),
  };
}

// Triangle, vertices apex, bottom-right, bottom-left: three per face, the
// face's middle and a quarter halfway between it and each end.
function triangleLayout([apex, br, bl]: P[]): Layout {
  const w = mid(bl!, apex!);
  const e = mid(br!, apex!);
  const s = mid(bl!, br!);
  return {
    ene: mid(e, apex!),
    e,
    ese: mid(e, br!),
    sse: mid(s, br!),
    s,
    ssw: mid(s, bl!),
    wsw: mid(w, bl!),
    w,
    wnw: mid(w, apex!),
  };
}

const vertices = (kind: ShapeKind): P[] => shapePolygonVertices(kind)!;

const LAYOUTS: Partial<Record<ShapeKind, Layout>> = {
  parallelogram: quadLayout(vertices('parallelogram')),
  trapezoid: quadLayout(vertices('trapezoid')),
  hexagon: hexagonLayout(vertices('hexagon')),
  triangle: triangleLayout(vertices('triangle')),
};

export function anchorLayoutPoint(kind: ShapeKind, anchor: Anchor): P | null {
  return LAYOUTS[kind]?.[anchor] ?? null;
}
