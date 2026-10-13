// An orthogonal arrow router (docs/specs/015-api/mcp-server.md §4.7 "Loops and detours go round"): the shortest path
// of horizontal and vertical runs from one box side to another that crosses no box, with as few bends as it can.
// Used by graph input for the arrows its plain elbows cannot draw cleanly (a loop back, an edge skipping ranks).
//
// The search runs on a channel grid: every box grown by a margin, the lines along those grown edges plus the two
// stubs out of the arrow's ends, and their crossings outside every box. A* over (crossing, heading) with the run's
// length plus a penalty per bend, and a penalty for running along a channel an earlier route already took, so two
// detours never draw as one line. Pure; the grid is capped, beyond which the caller keeps its own route.

export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type Side = 'n' | 'e' | 's' | 'w';

// How far a route keeps off a box, the cost of a bend and of sharing a channel, and the largest grid searched.
export const ROUTER_MARGIN = 18;
export const ROUTER_BEND_COST = 80;
export const ROUTER_SHARE_COST = 400;
export const ROUTER_MAX_GRID = 40_000;

const STEP: Readonly<Record<Side, Pt>> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
};

// A run an earlier route took: horizontal at `at` from lo to hi, or vertical.
export type Run = { horizontal: boolean; at: number; lo: number; hi: number };

const inside = (p: Pt, r: Rect) =>
  p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;

// Whether an axis-aligned run a→b passes through the inside of a rect.
function runHits(a: Pt, b: Pt, r: Rect): boolean {
  if (a.y === b.y) {
    if (a.y <= r.y || a.y >= r.y + r.height) return false;
    return Math.max(a.x, b.x) > r.x && Math.min(a.x, b.x) < r.x + r.width;
  }
  if (a.x <= r.x || a.x >= r.x + r.width) return false;
  return Math.max(a.y, b.y) > r.y && Math.min(a.y, b.y) < r.y + r.height;
}

function sharesRun(a: Pt, b: Pt, runs: readonly Run[]): boolean {
  const horizontal = a.y === b.y;
  const at = horizontal ? a.y : a.x;
  const [lo, hi] = horizontal
    ? [Math.min(a.x, b.x), Math.max(a.x, b.x)]
    : [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  return runs.some(
    (r) => r.horizontal === horizontal && Math.abs(r.at - at) < 2 && r.hi > lo + 1 && r.lo < hi - 1,
  );
}

// The corners of the route from `from` (leaving by `fromSide`) to `to` (entering by `toSide`), or null when none
// exists within the grid cap. The route leaves and enters square to the sides; the corners exclude both ends.
export function routeOrthogonal(
  from: Pt,
  fromSide: Side,
  to: Pt,
  toSide: Side,
  boxes: readonly Rect[],
  runs: readonly Run[] = [],
): { corners: Pt[]; cost: number } | null {
  const m = ROUTER_MARGIN;
  const start = { x: from.x + STEP[fromSide].x * m, y: from.y + STEP[fromSide].y * m };
  const goal = { x: to.x + STEP[toSide].x * m, y: to.y + STEP[toSide].y * m };
  // A box closer to an end than the margin keeps only its own outline, or the end could never leave.
  const grown = boxes.map((b) => {
    const g = { x: b.x - m, y: b.y - m, width: b.width + 2 * m, height: b.height + 2 * m };
    return inside(start, g) || inside(goal, g) ? b : g;
  });
  const xs = [...new Set([start.x, goal.x, ...grown.flatMap((r) => [r.x, r.x + r.width])])].sort(
    (a, b) => a - b,
  );
  const ys = [...new Set([start.y, goal.y, ...grown.flatMap((r) => [r.y, r.y + r.height])])].sort(
    (a, b) => a - b,
  );
  if (xs.length * ys.length > ROUTER_MAX_GRID) return null;
  const xi = new Map(xs.map((x, i) => [x, i]));
  const yi = new Map(ys.map((y, i) => [y, i]));
  const free = (i: number, j: number) => !grown.some((r) => inside({ x: xs[i]!, y: ys[j]! }, r));
  const dirs: Side[] = ['n', 'e', 's', 'w'];
  const key = (i: number, j: number, d: number) => (i * ys.length + j) * 4 + d;
  const best = new Map<number, number>();
  const came = new Map<number, number>();
  // A binary heap of [cost + estimate, cost, i, j, heading].
  const heap: [number, number, number, number, number][] = [];
  const push = (e: [number, number, number, number, number]) => {
    heap.push(e);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p]![0] <= heap[c]![0]) break;
      [heap[p], heap[c]] = [heap[c]!, heap[p]!];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1;
        const r = l + 1;
        let s = c;
        if (l < heap.length && heap[l]![0] < heap[s]![0]) s = l;
        if (r < heap.length && heap[r]![0] < heap[s]![0]) s = r;
        if (s === c) break;
        [heap[s], heap[c]] = [heap[c]!, heap[s]!];
        c = s;
      }
    }
    return top;
  };
  const estimate = (i: number, j: number) => Math.abs(xs[i]! - goal.x) + Math.abs(ys[j]! - goal.y);
  const [si, sj] = [xi.get(start.x)!, yi.get(start.y)!];
  const [gi, gj] = [xi.get(goal.x)!, yi.get(goal.y)!];
  const startDir = dirs.indexOf(fromSide);
  const goalDir = dirs.indexOf(
    toSide === 'n' ? 's' : toSide === 's' ? 'n' : toSide === 'e' ? 'w' : 'e',
  );
  best.set(key(si, sj, startDir), 0);
  push([estimate(si, sj), 0, si, sj, startDir]);
  let found = -1;
  let foundCost = Infinity;
  while (heap.length) {
    const [, cost, i, j, d] = pop();
    const k = key(i, j, d);
    if (cost > (best.get(k) ?? Infinity)) continue;
    if (i === gi && j === gj) {
      const total = cost + (d === goalDir ? 0 : ROUTER_BEND_COST);
      if (total < foundCost) [found, foundCost] = [k, total];
      if (d === goalDir) break;
      continue;
    }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (d + 2) % 4) continue; // never turn straight back
      const step = STEP[dirs[nd]!];
      const ni = i + step.x;
      const nj = j + step.y;
      if (ni < 0 || nj < 0 || ni >= xs.length || nj >= ys.length) continue;
      const a = { x: xs[i]!, y: ys[j]! };
      const b = { x: xs[ni]!, y: ys[nj]! };
      if (!(ni === gi && nj === gj) && !free(ni, nj)) continue;
      if (grown.some((r) => runHits(a, b, r))) continue;
      const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      const next =
        cost +
        len +
        (nd === d ? 0 : ROUTER_BEND_COST) +
        (sharesRun(a, b, runs) ? ROUTER_SHARE_COST : 0);
      const nk = key(ni, nj, nd);
      if (next >= (best.get(nk) ?? Infinity)) continue;
      best.set(nk, next);
      came.set(nk, k);
      push([next + estimate(ni, nj), next, ni, nj, nd]);
    }
  }
  if (found < 0) return null;
  const path: Pt[] = [];
  for (let k: number | undefined = found; k !== undefined; k = came.get(k)) {
    const cell = Math.floor(k / 4);
    path.push({ x: xs[Math.floor(cell / ys.length)]!, y: ys[cell % ys.length]! });
  }
  path.reverse();
  const all = [from, ...path, to];
  // Corners only: drop every point on a straight run.
  const corners = all.filter((p, n) => {
    if (n === 0 || n === all.length - 1) return false;
    const [a, c] = [all[n - 1]!, all[n + 1]!];
    return !((a.x === p.x && p.x === c.x) || (a.y === p.y && p.y === c.y));
  });
  return { corners, cost: foundCost };
}

// The runs of a routed path, for the next route to avoid sharing.
export function runsOf(points: readonly Pt[]): Run[] {
  const out: Run[] = [];
  for (let n = 1; n < points.length; n++) {
    const [a, b] = [points[n - 1]!, points[n]!];
    if (a.y === b.y)
      out.push({ horizontal: true, at: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) });
    else if (a.x === b.x)
      out.push({ horizontal: false, at: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) });
  }
  return out;
}
