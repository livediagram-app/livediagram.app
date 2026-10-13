// Square arrow routes for the editor's Tidy Up (docs/specs/008-canvas/layout-cleanup.md "Arrows
// route square, around the boxes"). Laid out, a straight arrow between two boxes that are not in
// line runs diagonally across whatever sits between, and a loop's way back runs straight through
// the column it returns along. A flowchart is read along square lines instead, so each arrow is
// given a route of right-angled legs, tried in order of preference and kept only if every leg
// clears every box it does not belong to:
//
//   - Down the flow (to a later band): straight when the two line up; otherwise one jog in the gap
//     between bands, through each long edge's lanes when it skips bands. A side step rejoining the
//     column comes down and turns into the side of the box it joins, as a flowchart draws it.
//   - Across a band: straight between the facing sides; over the top when something is between.
//   - Back up the flow (a loop): up from the top and into the facing side when the two are not in
//     line; otherwise out to the side, past everything in the way, up, and back in.
//
// Routing is worked out top to bottom: a left-to-right layout is transposed in and out, so one set
// of rules serves both. The result is ordinary arrow data: angled arrows threaded through their
// corners (`curvePoints`), which the author can drag like any other.

import type { Rect } from './geometry-primitives';
import type { Anchor, ArrowElement, ElementId } from './index';

type Pt = { x: number; y: number };

// Clearance kept between a leg and a box it passes, and how far out a loop's way back runs past
// the outermost box beside it.
const CLEARANCE = 10;
const LOOP_OFFSET = 32;

export type RouteRequest = {
  arrow: ArrowElement;
  from: ElementId;
  to: ElementId;
  /** A long edge's lane centres on the cross axis, one per band it passes. */
  lanes?: number[];
  /** The shapes the arrow is pinned to, when they sit inside a node that moves as a unit. */
  fromPort?: { id: ElementId; rect: Rect };
  toPort?: { id: ElementId; rect: Rect };
};

export type RouteInput = {
  dir: 'TB' | 'LR';
  /** Every laid-out node's final box. */
  nodes: Map<ElementId, Rect>;
  /** Boxes the layout did not move: routes keep clear of them too. */
  obstacles: Rect[];
  /** Nodes that sit beside a decision (auto-layout-tidy-rank.ts). */
  sideSteps: Set<ElementId>;
  /** Decisions (diamonds): an exit to a box wholly to one side leaves by that side's point. */
  decisions?: Set<ElementId>;
  requests: RouteRequest[];
};

type Route = { fromAnchor: Anchor; toAnchor: Anchor; points: Pt[] };

const swap = (r: Rect): Rect => ({ x: r.y, y: r.x, width: r.height, height: r.width });
const swapPt = (p: Pt): Pt => ({ x: p.y, y: p.x });
// A top-to-bottom anchor's name once transposed back to left-to-right.
const LR_ANCHOR: Record<string, Anchor> = { n: 'w', s: 'e', e: 's', w: 'n' };

/** Every requested arrow, re-pinned and routed square. Arrows not requested are not returned. */
export function routeTidyArrows(input: RouteInput): Map<ElementId, ArrowElement> {
  const lr = input.dir === 'LR';
  const nodes = new Map<ElementId, Rect>();
  for (const [id, r] of input.nodes) nodes.set(id, lr ? swap(r) : r);
  const obstacles = input.obstacles.map((r) => (lr ? swap(r) : r));
  const bands = bandsOf([...nodes.values()]);
  const bandOf = new Map<ElementId, number>();
  for (const [id, r] of nodes)
    bandOf.set(
      id,
      bands.findIndex((b) => r.y < b.bottom && r.y + r.height > b.top),
    );

  // Every box a leg must clear, built once; each route skips its own two nodes by identity.
  const blockers = [...nodes.values(), ...obstacles];
  const out = new Map<ElementId, ArrowElement>();
  for (const req of input.requests) {
    const u = nodes.get(req.from);
    const v = nodes.get(req.to);
    if (!u || !v) continue;
    const port = (p: { rect: Rect } | undefined, fallback: Rect) =>
      p ? (lr ? swap(p.rect) : p.rect) : fallback;
    const ctx: Ctx = {
      u: port(req.fromPort, u),
      v: port(req.toPort, v),
      nu: u,
      nv: v,
      bu: bandOf.get(req.from)!,
      bv: bandOf.get(req.to)!,
      bands,
      blockers,
    };
    const candidates = routeCandidates(
      ctx,
      req,
      input.sideSteps.has(req.from),
      input.decisions?.has(req.fromPort?.id ?? req.from) ?? false,
    );
    // The first clear route; failing that, the one through the fewest boxes.
    let route = candidates[0]!;
    let best = Infinity;
    for (const c of candidates) {
      const hits = routeHits(c.points, ctx);
      if (hits < best) [route, best] = [c, hits];
      if (hits === 0) break;
    }
    const points = lr ? route.points.map(swapPt) : route.points;
    const fromAnchor = lr ? LR_ANCHOR[route.fromAnchor]! : route.fromAnchor;
    const toAnchor = lr ? LR_ANCHOR[route.toAnchor]! : route.toAnchor;
    const fromId = req.fromPort?.id ?? req.from;
    const toId = req.toPort?.id ?? req.to;
    out.set(req.arrow.id, toArrow(req.arrow, fromId, toId, fromAnchor, toAnchor, points));
  }
  return out;
}

type Band = { top: number; bottom: number };
// `u` / `v` are the boxes the arrow is pinned to; `nu` / `nv` the nodes that hold them (the same
// boxes unless they sit in a unit).
type Ctx = {
  u: Rect;
  v: Rect;
  nu: Rect;
  nv: Rect;
  bu: number;
  bv: number;
  bands: Band[];
  blockers: Rect[];
};

// Rows of boxes: boxes whose vertical spans overlap share a band.
function bandsOf(rects: Rect[]): Band[] {
  const sorted = [...rects].sort((a, b) => a.y - b.y);
  const bands: Band[] = [];
  for (const r of sorted) {
    const last = bands[bands.length - 1];
    if (last && r.y < last.bottom) last.bottom = Math.max(last.bottom, r.y + r.height);
    else bands.push({ top: r.y, bottom: r.y + r.height });
  }
  return bands;
}

const cx = (r: Rect) => r.x + r.width / 2;
const cy = (r: Rect) => r.y + r.height / 2;
const right = (r: Rect) => r.x + r.width;
const bottom = (r: Rect) => r.y + r.height;

// The middle of the gap below band k (or a clearance below the last band).
function gapBelow(bands: Band[], k: number): number {
  const b = bands[k]!;
  const next = bands[k + 1];
  return next ? (b.bottom + next.top) / 2 : b.bottom + LOOP_OFFSET;
}
const gapAbove = (bands: Band[], k: number): number =>
  k > 0 ? gapBelow(bands, k - 1) : bands[k]!.top - LOOP_OFFSET;

function routeCandidates(
  ctx: Ctx,
  req: RouteRequest,
  fromSideStep: boolean,
  fromDecision: boolean,
): Route[] {
  const { u, v, bu, bv, bands } = ctx;
  const out: Route[] = [];
  const ux = cx(u);
  const uy = cy(u);
  const vx = cx(v);
  const vy = cy(v);
  const faceToward = (box: Rect, x: number): { x: number; a: Anchor } =>
    x >= cx(box) ? { x: right(box), a: 'e' } : { x: box.x, a: 'w' };

  if (bv > bu) {
    // Down the flow.
    // Out of the side facing the target, across, and down into its top.
    function exitSide(): Route | null {
      if (vx >= u.x && vx <= right(u)) return null;
      const f = faceToward(u, vx);
      return {
        fromAnchor: f.a,
        toAnchor: 'n',
        points: [
          { x: f.x, y: uy },
          { x: vx, y: uy },
          { x: vx, y: v.y },
        ],
      };
    }
    const intoSide = (): Route | null => {
      if (ux >= v.x && ux <= right(v)) return null;
      const f = faceToward(v, ux);
      return {
        fromAnchor: 's',
        toAnchor: f.a,
        points: [
          { x: ux, y: bottom(u) },
          { x: ux, y: vy },
          { x: f.x, y: vy },
        ],
      };
    };
    const jogged = (xs: number[]): Route => {
      const pts: Pt[] = [{ x: xs[0]!, y: bottom(u) }];
      for (let k = 0; k < xs.length - 1; k++) {
        if (Math.abs(xs[k]! - xs[k + 1]!) < 0.5) continue;
        const y = gapBelow(bands, bu + k);
        pts.push({ x: xs[k]!, y }, { x: xs[k + 1]!, y });
      }
      pts.push({ x: xs[xs.length - 1]!, y: v.y });
      return { fromAnchor: 's', toAnchor: 'n', points: pts };
    };
    const span = bv - bu;
    const lanes = req.lanes && req.lanes.length === span - 1 ? req.lanes : null;
    const side = fromSideStep ? intoSide() : null;
    if (side) out.push(side);
    // A decision's answer to one side leaves by that side's point and drops into the box: the
    // flowchart way, rather than every answer squeezing out of the bottom point.
    const answer = fromDecision ? exitSide() : null;
    if (answer) out.push(answer);
    if (lanes) out.push(jogged([ux, ...lanes, vx]));
    // Jog just above the target, or just below the source.
    out.push(jogged([ux, ...Array<number>(span - 1).fill(ux), vx]));
    out.push(jogged([ux, ...Array<number>(span - 1).fill(vx), vx]));
    const late = fromDecision ? null : exitSide();
    if (late) out.push(late);
    if (!side) {
      const s = intoSide();
      if (s) out.push(s);
    }
    return out;
  }

  if (bv === bu) {
    // Across a band.
    const a = faceToward(u, vx);
    const b = faceToward(v, ux);
    const pts =
      Math.abs(uy - vy) < 0.5
        ? [
            { x: a.x, y: uy },
            { x: b.x, y: vy },
          ]
        : [
            { x: a.x, y: uy },
            { x: (a.x + b.x) / 2, y: uy },
            { x: (a.x + b.x) / 2, y: vy },
            { x: b.x, y: vy },
          ];
    out.push({ fromAnchor: a.a, toAnchor: b.a, points: pts });
    out.push(overTop(ctx), underBottom(ctx));
    return out;
  }

  // Back up the flow: a loop's way back.
  if (ux < v.x || ux > right(v)) {
    const f = faceToward(v, ux);
    out.push({
      fromAnchor: 'n',
      toAnchor: f.a,
      points: [
        { x: ux, y: u.y },
        { x: ux, y: vy },
        { x: f.x, y: vy },
      ],
    });
  }
  const around = (sign: 1 | -1): Route[] => {
    const top = Math.min(v.y, u.y);
    const bot = Math.max(bottom(u), bottom(v));
    const inSpan = [u, v, ...ctx.blockers].filter((r) => r.y < bot && bottom(r) > top);
    const x =
      sign === 1
        ? Math.max(...inSpan.map(right)) + LOOP_OFFSET
        : Math.min(...inSpan.map((r) => r.x)) - LOOP_OFFSET;
    const a: Anchor = sign === 1 ? 'e' : 'w';
    const ux0 = sign === 1 ? right(u) : u.x;
    const vx0 = sign === 1 ? right(v) : v.x;
    const yTop = gapAbove(bands, bv);
    return [
      {
        fromAnchor: a,
        toAnchor: a,
        points: [
          { x: ux0, y: uy },
          { x, y: uy },
          { x, y: vy },
          { x: vx0, y: vy },
        ],
      },
      {
        fromAnchor: a,
        toAnchor: 'n',
        points: [
          { x: ux0, y: uy },
          { x, y: uy },
          { x, y: yTop },
          { x: vx, y: yTop },
          { x: vx, y: v.y },
        ],
      },
    ];
  };
  const first: 1 | -1 = ux >= vx ? 1 : -1;
  out.push(...around(first), underBottom(ctx), ...around(first === 1 ? -1 : 1));
  return out;
}

// Out of the top of both, across the gap above the higher one's band.
function overTop(ctx: Ctx): Route {
  const { u, v, bands } = ctx;
  const y = Math.min(gapAbove(bands, ctx.bu), gapAbove(bands, ctx.bv));
  return {
    fromAnchor: 'n',
    toAnchor: 'n',
    points: [
      { x: cx(u), y: u.y },
      { x: cx(u), y },
      { x: cx(v), y },
      { x: cx(v), y: v.y },
    ],
  };
}

// Out of the bottom of both, across the gap below the lower one's band: the way round when the row
// between them is full (a No running back to the lane it started in).
function underBottom(ctx: Ctx): Route {
  const { u, v, bands } = ctx;
  const y = Math.max(gapBelow(bands, ctx.bu), gapBelow(bands, ctx.bv));
  return {
    fromAnchor: 's',
    toAnchor: 's',
    points: [
      { x: cx(u), y: bottom(u) },
      { x: cx(u), y },
      { x: cx(v), y },
      { x: cx(v), y: bottom(v) },
    ],
  };
}

// How many times a leg of the route passes through a box other than its own two (kept a
// clearance away), or doubles back through its own boxes. Zero is a clear route.
function routeHits(points: Pt[], ctx: Ctx): number {
  let hits = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const p = points[i]!;
    const q = points[i + 1]!;
    for (const r of ctx.blockers)
      if (r !== ctx.nu && r !== ctx.nv && legHits(p, q, r, CLEARANCE)) hits++;
    // Its own boxes: only the first leg may touch the source, the last the target.
    if (i > 0 && legHits(p, q, ctx.u, -1)) hits++;
    if (i < points.length - 2 && legHits(p, q, ctx.v, -1)) hits++;
  }
  return hits;
}

// Whether the axis-aligned leg p→q crosses the box grown by `pad` (negative shrinks it, so a leg
// that only starts on its face does not count).
function legHits(p: Pt, q: Pt, r: Rect, pad: number): boolean {
  const x0 = r.x - pad;
  const x1 = r.x + r.width + pad;
  const y0 = r.y - pad;
  const y1 = r.y + r.height + pad;
  const lx = Math.min(p.x, q.x);
  const hx = Math.max(p.x, q.x);
  const ly = Math.min(p.y, q.y);
  const hy = Math.max(p.y, q.y);
  return hx > x0 && lx < x1 && hy > y0 && ly < y1;
}

// The arrow re-pinned to the route's faces, drawn straight for a single leg and angled through
// its corners otherwise. Geometry tuned for the old route (a dragged elbow, a curve, a dragged
// label) no longer fits the new one, so it is cleared.
function toArrow(
  a: ArrowElement,
  from: ElementId,
  to: ElementId,
  fromAnchor: Anchor,
  toAnchor: Anchor,
  points: Pt[],
): ArrowElement {
  const {
    elbowOffset: _elbow,
    curveOffset: _curve,
    curvePoints: _points,
    labelOffset: _label,
    ...rest
  } = a;
  const base: ArrowElement = {
    ...rest,
    from: { kind: 'pinned', elementId: from, anchor: fromAnchor },
    to: { kind: 'pinned', elementId: to, anchor: toAnchor },
  };
  const corners = points.slice(1, -1);
  if (corners.length === 0) return { ...base, arrowStyle: 'straight' };
  const start = points[0]!;
  const end = points[points.length - 1]!;
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  return {
    ...base,
    arrowStyle: 'angled',
    curvePoints: corners.map((c) => ({ dx: c.x - mx, dy: c.y - my })),
  };
}
