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
const ROUTER_MARGIN = 18;
const ROUTER_BEND_COST = 80;
export const ROUTER_SHARE_COST = 400;
// How near an earlier run a step counts as sharing it: a line a few px beside another, or on its line a few px short
// of its end (a "no" running up to the very point a "yes" turns into the step it passes), reads as riding it as surely
// as one on it does.
const ROUTER_SHARE_NEAR = 8;
const ROUTER_MAX_GRID = 40_000;
// The most work the router does for one layout, every route together, in grid crossings laid out plus search steps
// taken: past it a route gives up (null) and the caller keeps its own (an outside track), so a dense graph never
// searches for seconds. A small flow's few loops use a fraction of it.
export const ROUTER_BUDGET = 600_000;

// What the router may still spend for one layout, shared by every route of it.
export type RouterBudget = { left: number };

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

// Earlier runs bucketed by axis and position, ROUTER_SHARE_NEAR wide, so a step looks only at the runs near its own
// line: the bucket it falls in and the one either side.
const bucketOf = (at: number) => Math.floor(at / ROUTER_SHARE_NEAR);
const runKey = (horizontal: boolean, bucket: number) => bucket * 2 + (horizontal ? 1 : 0);

function runIndex(runs: readonly Run[]): Map<number, Run[]> {
  const out = new Map<number, Run[]>();
  for (const r of runs) {
    const k = runKey(r.horizontal, bucketOf(r.at));
    (out.get(k) ?? out.set(k, []).get(k)!).push(r);
  }
  return out;
}

function sharesRun(a: Pt, b: Pt, runs: ReadonlyMap<number, readonly Run[]>): boolean {
  if (runs.size === 0) return false;
  const horizontal = a.y === b.y;
  const at = horizontal ? a.y : a.x;
  const [lo, hi] = horizontal
    ? [Math.min(a.x, b.x), Math.max(a.x, b.x)]
    : [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  // Within ROUTER_SHARE_NEAR of `at`: its bucket and the one either side are enough.
  for (let k = bucketOf(at) - 1; k <= bucketOf(at) + 1; k++)
    for (const r of runs.get(runKey(horizontal, k)) ?? [])
      if (
        Math.abs(r.at - at) < ROUTER_SHARE_NEAR &&
        r.hi > lo - ROUTER_SHARE_NEAR &&
        r.lo < hi + ROUTER_SHARE_NEAR
      )
        return true;
  return false;
}

// The first index of sorted `xs` greater than `v`.
function firstAbove(xs: readonly number[], v: number): number {
  let [lo, hi] = [0, xs.length];
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]! > v) hi = mid;
    else lo = mid + 1;
  }
  return lo;
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
  budget: RouterBudget = { left: Infinity },
): { corners: Pt[]; cost: number } | null {
  if (budget.left <= 0) return null;
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
  // Laying the grid out costs a step per crossing, charged to the same budget as the search (a grid past the cap is
  // charged the cap: working out that it is too big costs too).
  budget.left -= Math.min(xs.length * ys.length, ROUTER_MAX_GRID);
  if (xs.length * ys.length > ROUTER_MAX_GRID || budget.left <= 0) return null;
  const xi = new Map(xs.map((x, i) => [x, i]));
  const yi = new Map(ys.map((y, i) => [y, i]));
  // Each box rasterised onto the grid once: the crossings strictly inside it, and the unit steps through its inside
  // (every box edge is a grid line, so a step between neighbouring lines is inside or out whole).
  const [nx, ny] = [xs.length, ys.length];
  const pointIn = new Uint8Array(nx * ny);
  const stepX = new Uint8Array(nx * ny); // (i, j) → (i + 1, j)
  const stepY = new Uint8Array(nx * ny); // (i, j) → (i, j + 1)
  for (const r of grown) {
    const [x0, x1] = [xi.get(r.x)!, xi.get(r.x + r.width)!];
    const [y0, y1] = [yi.get(r.y)!, yi.get(r.y + r.height)!];
    const [ix0, iy0] = [firstAbove(xs, r.x), firstAbove(ys, r.y)];
    for (let i = ix0; i < x1; i++) for (let j = iy0; j < y1; j++) pointIn[i * ny + j] = 1;
    for (let j = iy0; j < y1; j++) for (let i = x0; i < x1; i++) stepX[i * ny + j] = 1;
    for (let i = ix0; i < x1; i++) for (let j = y0; j < y1; j++) stepY[i * ny + j] = 1;
  }
  const free = (i: number, j: number) => pointIn[i * ny + j] === 0;
  const crosses = (i: number, j: number, ni: number, nj: number) =>
    ni !== i ? stepX[Math.min(i, ni) * ny + j] === 1 : stepY[i * ny + Math.min(j, nj)] === 1;
  const taken = runIndex(runs);
  const dirs: Side[] = ['n', 'e', 's', 'w'];
  const key = (i: number, j: number, d: number) => (i * ys.length + j) * 4 + d;
  // The cheapest cost found to each (crossing, heading), and where it came from (-1: nowhere yet).
  const best = new Float64Array(nx * ny * 4).fill(Infinity);
  const came = new Int32Array(nx * ny * 4).fill(-1);
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
  best[key(si, sj, startDir)] = 0;
  push([estimate(si, sj), 0, si, sj, startDir]);
  let found = -1;
  let foundCost = Infinity;
  while (heap.length) {
    if (budget.left-- <= 0) return null;
    const [, cost, i, j, d] = pop();
    const k = key(i, j, d);
    if (cost > best[k]!) continue;
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
      if (crosses(i, j, ni, nj)) continue;
      const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      const next =
        cost +
        len +
        (nd === d ? 0 : ROUTER_BEND_COST) +
        (sharesRun(a, b, taken) ? ROUTER_SHARE_COST : 0);
      const nk = key(ni, nj, nd);
      if (next >= best[nk]!) continue;
      best[nk] = next;
      came[nk] = k;
      push([next + estimate(ni, nj), next, ni, nj, nd]);
    }
  }
  if (found < 0) return null;
  const path: Pt[] = [];
  for (let k = found; k >= 0; k = came[k]!) {
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
