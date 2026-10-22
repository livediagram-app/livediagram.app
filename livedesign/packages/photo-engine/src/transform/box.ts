// Free Transform's box (docs/specs/031-photo/photo-tools.md "Moving and transforming"): a picture's
// box under a matrix, its eight handles, what a press on it grabs, and how a drag of each grab
// changes the matrix: inside moves, a handle scales (Shift keeps the shape, Alt about the centre),
// outside a corner rotates (Shift in 15° steps), and Ctrl/Cmd on a corner distorts it freely.
import {
  apply,
  chain,
  invert,
  quadToQuad,
  rotate,
  scale,
  translate,
  type Matrix,
  type Pt,
} from './matrix';

/** The handles, clockwise from the top-left: corners at even indexes, edge middles at odd ones. */
export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
export type Handle = (typeof HANDLES)[number];

export type Grab =
  | { kind: 'move' }
  | { kind: 'scale'; handle: Handle }
  | { kind: 'rotate' }
  | { kind: 'distort'; handle: Handle }
  | { kind: 'skew'; handle: Handle }
  | { kind: 'perspective'; handle: Handle };

// What a handle does beyond scaling: Free (Ctrl/Cmd on a corner distorts), Skew (an edge's handle slides
// that edge along itself) or Perspective (a corner and its partner on an edge move apart or together).
export type TransformMode = 'free' | 'skew' | 'perspective';

/** Where each handle sits on a w x h box, in the picture's own px. */
export function handlePoint(handle: Handle, w: number, h: number): Pt {
  const x = handle.includes('w') ? 0 : handle.includes('e') ? w : w / 2;
  const y = handle.includes('n') ? 0 : handle.includes('s') ? h : h / 2;
  return { x, y };
}

const opposite: Record<Handle, Handle> = {
  nw: 'se',
  n: 's',
  ne: 'sw',
  e: 'w',
  se: 'nw',
  s: 'n',
  sw: 'ne',
  w: 'e',
};

export const isCorner = (h: Handle): boolean => h.length === 2;

// An edge handle's two corners, as indexes of boxCorners (nw, ne, se, sw).
const EDGE_CORNERS: Partial<Record<Handle, [number, number]>> = {
  n: [0, 1],
  e: [1, 2],
  s: [3, 2],
  w: [0, 3],
};

/** The unit vector from `from` to `to` (the x axis when they meet). */
function unit(to: Pt, from: Pt): Pt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const n = Math.hypot(dx, dy);
  return n > 0 ? { x: dx / n, y: dy / n } : { x: 1, y: 0 };
}

/** The box's four corners on the photo (nw, ne, se, sw). */
export function boxCorners(m: Matrix, w: number, h: number): Pt[] {
  return [
    apply(m, { x: 0, y: 0 }),
    apply(m, { x: w, y: 0 }),
    apply(m, { x: w, y: h }),
    apply(m, { x: 0, y: h }),
  ];
}

function inside(poly: readonly Pt[], p: Pt): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      hit = !hit;
  }
  return hit;
}

/** What a press at `p` (photo px) grabs: a handle within `reach` (photo px), inside the box, or
 *  outside it (a rotate); `distort` with Ctrl/Cmd held on a corner; in Skew an edge's handle skews, in
 *  Perspective a corner's handle. */
export function grabAt(
  m: Matrix,
  w: number,
  h: number,
  p: Pt,
  reach: number,
  distort = false,
  mode: TransformMode = 'free',
): Grab {
  // The nearest handle in reach: on a small box an edge's handle sits close to its corners.
  let best: Handle | null = null;
  let bestD = reach;
  for (const handle of HANDLES) {
    const at = apply(m, handlePoint(handle, w, h));
    const d = Math.hypot(at.x - p.x, at.y - p.y);
    if (d <= bestD) {
      best = handle;
      bestD = d;
    }
  }
  if (best) {
    if (distort && isCorner(best)) return { kind: 'distort', handle: best };
    if (mode === 'skew' && !isCorner(best)) return { kind: 'skew', handle: best };
    if (mode === 'perspective' && isCorner(best)) return { kind: 'perspective', handle: best };
    return { kind: 'scale', handle: best };
  }
  return inside(boxCorners(m, w, h), p) ? { kind: 'move' } : { kind: 'rotate' };
}

export type DragKeys = { shift: boolean; alt: boolean };

/** The matrix after dragging `grab` from `from` to `to` (photo px), starting from `m0`. */
export function dragBox(
  m0: Matrix,
  w: number,
  h: number,
  grab: Grab,
  from: Pt,
  to: Pt,
  keys: DragKeys,
): Matrix {
  if (grab.kind === 'move') return chain(m0, translate(to.x - from.x, to.y - from.y));
  if (grab.kind === 'rotate') {
    const c = apply(m0, { x: w / 2, y: h / 2 });
    let a = Math.atan2(to.y - c.y, to.x - c.x) - Math.atan2(from.y - c.y, from.x - c.x);
    if (keys.shift) {
      // Steps of 15° of the box's whole angle, not of the drag's.
      const now = angleOf(m0);
      const step = Math.PI / 12;
      a = Math.round((now + a) / step) * step - now;
    }
    return chain(m0, translate(-c.x, -c.y), rotate(a), translate(c.x, c.y));
  }
  const own = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const d = { x: to.x - from.x, y: to.y - from.y };
  const CORNER = ['nw', 'ne', 'se', 'sw'];
  if (grab.kind === 'distort') {
    const corners = boxCorners(m0, w, h);
    const i = CORNER.indexOf(grab.handle);
    corners[i] = { x: corners[i]!.x + d.x, y: corners[i]!.y + d.y };
    return quadToQuad(own, corners) ?? m0;
  }
  if (grab.kind === 'skew') {
    // The grabbed edge's two corners slide along the edge by the drag's share in its direction.
    const corners = boxCorners(m0, w, h);
    const [a, b] = EDGE_CORNERS[grab.handle]!;
    const along = unit(corners[b]!, corners[a]!);
    const k = d.x * along.x + d.y * along.y;
    for (const i of [a, b])
      corners[i] = { x: corners[i]!.x + along.x * k, y: corners[i]!.y + along.y * k };
    return quadToQuad(own, corners) ?? m0;
  }
  if (grab.kind === 'perspective') {
    // The corner moves along whichever of its two edges the drag follows more; its partner on that
    // edge moves the other way, so the box narrows or widens there as if seen at an angle.
    const corners = boxCorners(m0, w, h);
    const i = CORNER.indexOf(grab.handle);
    const across = (i + (i % 2 === 0 ? 1 : 3)) % 4;
    const down = (i + (i % 2 === 0 ? 3 : 1)) % 4;
    const u1 = unit(corners[i]!, corners[across]!);
    const u2 = unit(corners[i]!, corners[down]!);
    const k1 = d.x * u1.x + d.y * u1.y;
    const k2 = d.x * u2.x + d.y * u2.y;
    const [partner, u, k] = Math.abs(k1) >= Math.abs(k2) ? [across, u1, k1] : [down, u2, k2];
    corners[i] = { x: corners[i]!.x + u.x * k, y: corners[i]!.y + u.y * k };
    corners[partner] = { x: corners[partner]!.x - u.x * k, y: corners[partner]!.y - u.y * k };
    return quadToQuad(own, corners) ?? m0;
  }
  // A scale, in the box's own px: the pointer's position relative to the fixed point.
  const inv = invert(m0);
  if (!inv) return m0;
  const handle = grab.handle;
  const fixed = keys.alt ? { x: w / 2, y: h / 2 } : handlePoint(opposite[handle], w, h);
  const start = handlePoint(handle, w, h);
  const now = apply(inv, to);
  const grabbed = apply(inv, from);
  const target = { x: start.x + now.x - grabbed.x, y: start.y + now.y - grabbed.y };
  const span = { x: start.x - fixed.x, y: start.y - fixed.y };
  let sx = handle === 'n' || handle === 's' || !span.x ? 1 : (target.x - fixed.x) / span.x;
  let sy = handle === 'e' || handle === 'w' || !span.y ? 1 : (target.y - fixed.y) / span.y;
  if (keys.shift) {
    // The shape kept: an edge scales both ways by its own amount, a corner by the larger.
    const k = !isCorner(handle)
      ? handle === 'n' || handle === 's'
        ? sy
        : sx
      : Math.abs(sx) > Math.abs(sy)
        ? sx
        : sy;
    sx = Math.sign(sx || 1) * Math.abs(k);
    sy = Math.sign(sy || 1) * Math.abs(k);
  }
  // A box squashed flat cannot be drawn: kept a hair wide.
  const MIN = 1e-3;
  if (Math.abs(sx) < MIN) sx = MIN;
  if (Math.abs(sy) < MIN) sy = MIN;
  return chain(translate(-fixed.x, -fixed.y), scale(sx, sy), translate(fixed.x, fixed.y), m0);
}

/** The angle (radians) the box's top edge makes with the photo's. */
export function angleOf(m: Matrix): number {
  const a = apply(m, { x: 0, y: 0 });
  const b = apply(m, { x: 1, y: 0 });
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** The box as the options bar shows it: its centre, size (px) and angle (degrees). */
export function boxReadout(
  m: Matrix,
  w: number,
  h: number,
): { x: number; y: number; width: number; height: number; angle: number } {
  const [nw, ne, , sw] = boxCorners(m, w, h);
  return {
    x: nw!.x,
    y: nw!.y,
    width: Math.hypot(ne!.x - nw!.x, ne!.y - nw!.y),
    height: Math.hypot(sw!.x - nw!.x, sw!.y - nw!.y),
    angle: (angleOf(m) * 180) / Math.PI,
  };
}

/** The matrix for a box typed into the options bar: top-left at (x, y), w x h, at `angle` degrees,
 *  for a picture of `pw` x `ph`. */
export function boxFromReadout(
  pw: number,
  ph: number,
  r: { x: number; y: number; width: number; height: number; angle: number },
): Matrix {
  return chain(
    scale(r.width / pw, r.height / ph),
    rotate((r.angle * Math.PI) / 180),
    translate(r.x, r.y),
  );
}
