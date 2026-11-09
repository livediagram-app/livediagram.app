// Finding the way (docs/specs/008-canvas/avatar-mode.md "Finding the way"): a
// click-walk routes round what blocks a step (collision.ts's fenceSegments: fences, room walls broken at open
// doorways, pod walls, scenery footprints) instead of walking into the first wall.
//
// The board is rasterised once per change to its walls into a coarse grid: a cell is blocked when its centre is
// within the character's reach (plus a little clearance) of any fence line, or inside a scenery footprint. Its
// open cells are labelled by connected region, so an unreachable click is known before searching and the walk is
// sent to the nearest point it can reach instead. A query is A* over the grid with an expansion cap, then
// string-pulled to straight legs. Everything here is pure; useAvatarWalk caches the grid.

import { segmentDistance, segmentsIntersect, type FenceSegment } from './collision';
import type { FencePoint } from './fence';

/** The grid's cell, in canvas px: fine enough that a room's doorway keeps open cells for the Tall character. */
export const NAV_CELL = 16;
/** The most cells a grid holds; a vaster board takes coarser cells instead (memory ~6 bytes a cell). */
export const NAV_MAX_CELLS = 250_000;
// How far past the reach a route keeps from a wall, so the walk's own step test never grazes it.
const NAV_CLEARANCE = 2;

export type NavGrid = {
  cell: number;
  cols: number;
  rows: number;
  // The canvas point of cell (0, 0)'s top-left corner.
  ox: number;
  oy: number;
  // 1 = blocked.
  blocked: Uint8Array;
  // Connected region of each open cell (8-way, no corner cutting); -1 for a blocked cell.
  region: Int32Array;
  fences: readonly FenceSegment[];
  reach: number;
  // The fences near each NAV_BUCKET square (compressed rows: bucketStart[b]..bucketStart[b + 1] in bucketFences), so
  // a leg is checked exactly against the walls beside it, not the whole board.
  bucketCols: number;
  bucketRows: number;
  bucketStart: Int32Array;
  bucketFences: Int32Array;
  // Scratch, reused by every query and told apart by stamps (no per-query allocation).
  g: Float32Array;
  f: Float32Array;
  parent: Int32Array;
  seen: Uint32Array;
  closed: Uint32Array;
  heap: Int32Array;
  stamp: number;
  fenceSeen: Uint32Array;
  fenceStamp: number;
  // The shut Doors' lines (closed-door-lines in collision.ts): a click into the room behind one walks to its outside.
  shutDoors: readonly FenceSegment[];
};

// The bucket a fence index is filed under, in canvas px.
const NAV_BUCKET = 128;
// How much A*'s distance estimate is trusted over the distance walked: over 1 searches far fewer cells for a route a
// little longer than the shortest, which the string-pulling then straightens anyway.
const NAV_HEURISTIC_WEIGHT = 2;

// The eight moves: column, row, cost. A diagonal needs both orthogonal neighbours open (no cutting a wall's corner).
const DC = [1, -1, 0, 0, 1, 1, -1, -1];
const DR = [0, 0, 1, -1, 1, -1, 1, -1];
const COST = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

/**
 * The grid for these fences and this reach, or null when nothing blocks (every walk is then a straight line).
 * Built once per change to the walls, never per frame.
 */
export function buildNavGrid(
  fences: readonly FenceSegment[],
  reach: number,
  shutDoors: readonly FenceSegment[] = [],
): NavGrid | null {
  if (fences.length === 0) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of fences) {
    x0 = Math.min(x0, s.a.x, s.b.x);
    y0 = Math.min(y0, s.a.y, s.b.y);
    x1 = Math.max(x1, s.a.x, s.b.x);
    y1 = Math.max(y1, s.a.y, s.b.y);
  }
  const radius = reach + NAV_CLEARANCE;
  // A free ring round everything, so a route can always go round the outside.
  const pad = radius + 3 * NAV_CELL;
  x0 -= pad;
  y0 -= pad;
  x1 += pad;
  y1 += pad;
  const cell = Math.max(NAV_CELL, Math.ceil(Math.sqrt(((x1 - x0) * (y1 - y0)) / NAV_MAX_CELLS)));
  const cols = Math.ceil((x1 - x0) / cell);
  const rows = Math.ceil((y1 - y0) / cell);
  const n = cols * rows;
  const blocked = new Uint8Array(n);
  for (const s of fences) {
    const c0 = Math.max(0, Math.floor((Math.min(s.a.x, s.b.x) - radius - x0) / cell));
    const c1 = Math.min(cols - 1, Math.floor((Math.max(s.a.x, s.b.x) + radius - x0) / cell));
    const r0 = Math.max(0, Math.floor((Math.min(s.a.y, s.b.y) - radius - y0) / cell));
    const r1 = Math.min(rows - 1, Math.floor((Math.max(s.a.y, s.b.y) + radius - y0) / cell));
    for (let r = r0; r <= r1; r++) {
      const cy = y0 + (r + 0.5) * cell;
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        if (!blocked[i] && distToSegment(x0 + (c + 0.5) * cell, cy, s) < radius) blocked[i] = 1;
      }
    }
    // A footprint's inside is no place to stand either (its edges alone would leave it hollow).
    const box = s.solid;
    if (box) {
      const b0 = Math.max(0, Math.floor((box.x - x0) / cell));
      const b1 = Math.min(cols - 1, Math.floor((box.x + box.width - x0) / cell));
      const d0 = Math.max(0, Math.floor((box.y - y0) / cell));
      const d1 = Math.min(rows - 1, Math.floor((box.y + box.height - y0) / cell));
      for (let r = d0; r <= d1; r++) blocked.fill(1, r * cols + b0, r * cols + b1 + 1);
    }
  }
  const bucketCols = Math.ceil((x1 - x0) / NAV_BUCKET);
  const bucketRows = Math.ceil((y1 - y0) / NAV_BUCKET);
  const { start: bucketStart, items: bucketFences } = fileFences(
    fences,
    x0,
    y0,
    bucketCols,
    bucketRows,
    radius,
  );
  return {
    cell,
    cols,
    rows,
    ox: x0,
    oy: y0,
    blocked,
    region: labelRegions(blocked, cols, rows),
    fences,
    reach,
    bucketCols,
    bucketRows,
    bucketStart,
    bucketFences,
    g: new Float32Array(n),
    f: new Float32Array(n),
    parent: new Int32Array(n),
    seen: new Uint32Array(n),
    closed: new Uint32Array(n),
    heap: new Int32Array(n),
    stamp: 0,
    fenceSeen: new Uint32Array(fences.length),
    fenceStamp: 0,
    shutDoors,
  };
}

// Each fence filed under every bucket its box (grown by `grow`) touches, as compressed rows.
function fileFences(
  fences: readonly FenceSegment[],
  x0: number,
  y0: number,
  cols: number,
  rows: number,
  grow: number,
) {
  const span = (s: FenceSegment) => [
    Math.max(0, Math.floor((Math.min(s.a.x, s.b.x) - grow - x0) / NAV_BUCKET)),
    Math.min(cols - 1, Math.floor((Math.max(s.a.x, s.b.x) + grow - x0) / NAV_BUCKET)),
    Math.max(0, Math.floor((Math.min(s.a.y, s.b.y) - grow - y0) / NAV_BUCKET)),
    Math.min(rows - 1, Math.floor((Math.max(s.a.y, s.b.y) + grow - y0) / NAV_BUCKET)),
  ];
  const counts = new Int32Array(cols * rows + 1);
  for (const s of fences) {
    const [c0, c1, r0, r1] = span(s);
    for (let r = r0!; r <= r1!; r++) for (let c = c0!; c <= c1!; c++) counts[r * cols + c + 1]!++;
  }
  for (let i = 1; i < counts.length; i++) counts[i]! += counts[i - 1]!;
  const start = counts.slice();
  const fill = counts.slice(0, -1);
  const items = new Int32Array(start[start.length - 1]!);
  fences.forEach((s, k) => {
    const [c0, c1, r0, r1] = span(s);
    for (let r = r0!; r <= r1!; r++)
      for (let c = c0!; c <= c1!; c++) items[fill[r * cols + c]!++] = k;
  });
  return { start, items };
}

function distToSegment(px: number, py: number, s: FenceSegment): number {
  const fx = s.b.x - s.a.x;
  const fy = s.b.y - s.a.y;
  const len2 = fx * fx + fy * fy;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.a.x) * fx + (py - s.a.y) * fy) / len2));
  return Math.hypot(px - (s.a.x + fx * t), py - (s.a.y + fy * t));
}

// Whether a move from cell (c, r) by move k stays on the grid, onto an open cell, without cutting a corner.
function canMove(
  grid: { blocked: Uint8Array; cols: number; rows: number },
  c: number,
  r: number,
  k: number,
) {
  const { blocked, cols, rows } = grid;
  const nc = c + DC[k]!;
  const nr = r + DR[k]!;
  if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || blocked[nr * cols + nc]) return false;
  return k < 4 || (!blocked[r * cols + nc] && !blocked[nr * cols + c]);
}

function labelRegions(blocked: Uint8Array, cols: number, rows: number): Int32Array {
  const region = new Int32Array(blocked.length).fill(-1);
  const queue = new Int32Array(blocked.length);
  const grid = { blocked, cols, rows };
  let next = 0;
  for (let first = 0; first < blocked.length; first++) {
    if (blocked[first] || region[first] !== -1) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = first;
    region[first] = next;
    while (head < tail) {
      const i = queue[head++]!;
      const c = i % cols;
      const r = (i - c) / cols;
      for (let k = 0; k < 8; k++) {
        if (!canMove(grid, c, r, k)) continue;
        const j = i + DR[k]! * cols + DC[k]!;
        if (region[j] !== -1) continue;
        region[j] = next;
        queue[tail++] = j;
      }
    }
    next++;
  }
  return region;
}

/** Whether a straight walk from a to b keeps the reach clear of every fence (the plain walk, nothing in the way). */
export function clearWalk(
  a: FencePoint,
  b: FencePoint,
  fences: readonly FenceSegment[],
  reach: number,
): boolean {
  const leg = { a, b };
  for (const f of fences) if (segmentDistance(leg, f) < reach) return false;
  return true;
}

/**
 * Whether the leg a-b keeps the reach clear of the walls beside it, from the grid's buckets. Feet already within a
 * wall's reach (as clearOfFences can leave them) may walk off it, as a step may: that wall only refuses a leg
 * that crosses it.
 */
function legClear(grid: NavGrid, a: FencePoint, b: FencePoint): boolean {
  const { fences, reach, bucketCols, bucketRows, bucketStart, bucketFences, fenceSeen } = grid;
  const stamp = ++grid.fenceStamp;
  const leg = { a, b };
  const half = NAV_BUCKET / 2;
  const fx = b.x - a.x;
  const fy = b.y - a.y;
  const len = Math.hypot(fx, fy) || 1;
  // Buckets whose middle lies farther from the leg than half a bucket's diagonal plus the reach hold nothing near it.
  const within = half * Math.SQRT2 + reach;
  const c0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - reach - grid.ox) / NAV_BUCKET));
  const c1 = Math.min(
    bucketCols - 1,
    Math.floor((Math.max(a.x, b.x) + reach - grid.ox) / NAV_BUCKET),
  );
  const r0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - reach - grid.oy) / NAV_BUCKET));
  const r1 = Math.min(
    bucketRows - 1,
    Math.floor((Math.max(a.y, b.y) + reach - grid.oy) / NAV_BUCKET),
  );
  for (let r = r0; r <= r1; r++) {
    const my = grid.oy + r * NAV_BUCKET + half;
    for (let c = c0; c <= c1; c++) {
      const mx = grid.ox + c * NAV_BUCKET + half;
      if (Math.abs((mx - a.x) * fy - (my - a.y) * fx) / len > within) continue;
      const bucket = r * bucketCols + c;
      for (let k = bucketStart[bucket]!; k < bucketStart[bucket + 1]!; k++) {
        const index = bucketFences[k]!;
        if (fenceSeen[index] === stamp) continue;
        fenceSeen[index] = stamp;
        const fence = fences[index]!;
        if (segmentDistance(leg, fence) >= reach) continue;
        if (distToSegment(a.x, a.y, fence) < reach && !segmentsIntersect(leg, fence)) continue;
        return false;
      }
    }
  }
  return true;
}

const centre = (grid: NavGrid, i: number): FencePoint => {
  const c = i % grid.cols;
  return {
    x: grid.ox + (c + 0.5) * grid.cell,
    y: grid.oy + ((i - c) / grid.cols + 0.5) * grid.cell,
  };
};

function cellAt(grid: NavGrid, p: FencePoint): number {
  const c = Math.floor((p.x - grid.ox) / grid.cell);
  const r = Math.floor((p.y - grid.oy) / grid.cell);
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return -1;
  return r * grid.cols + c;
}

// A point held inside the grid's free outer ring: beyond the grid nothing blocks, so the straight line between a
// point and its clamp crosses no fence.
function clampIn(grid: NavGrid, p: FencePoint): FencePoint {
  const m = grid.cell * 1.5;
  return {
    x: Math.min(grid.ox + grid.cols * grid.cell - m, Math.max(grid.ox + m, p.x)),
    y: Math.min(grid.oy + grid.rows * grid.cell - m, Math.max(grid.oy + m, p.y)),
  };
}

/**
 * The open cell nearest `p` that `accept` takes, searching outward ring by ring and finishing the rings that could
 * still hold a nearer one; -1 when none lies within `maxRing`.
 */
function nearestCell(
  grid: NavGrid,
  p: FencePoint,
  accept: (i: number) => boolean,
  maxRing: number,
): number {
  const pc = Math.min(grid.cols - 1, Math.max(0, Math.floor((p.x - grid.ox) / grid.cell)));
  const pr = Math.min(grid.rows - 1, Math.max(0, Math.floor((p.y - grid.oy) / grid.cell)));
  let best = -1;
  let bestD = Infinity;
  let stopAt = maxRing;
  for (let k = 0; k <= stopAt; k++) {
    for (let r = pr - k; r <= pr + k; r++) {
      if (r < 0 || r >= grid.rows) continue;
      const edge = r === pr - k || r === pr + k;
      for (let c = pc - k; c <= pc + k; c += edge || k === 0 ? 1 : 2 * k) {
        if (c < 0 || c >= grid.cols) continue;
        const i = r * grid.cols + c;
        if (grid.blocked[i] || !accept(i)) continue;
        const q = centre(grid, i);
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    // A cell in ring k is at least (k - 1) cells away, so once one is found, rings past k * sqrt2 + 1 cannot beat it.
    if (best !== -1 && stopAt === maxRing)
      stopAt = Math.min(maxRing, Math.ceil(k * Math.SQRT2) + 1);
  }
  return best;
}

// The binary heap's sift operations, keyed on grid.f.
function heapPush(grid: NavGrid, size: number, i: number): number {
  const { heap, f } = grid;
  let k = size;
  while (k > 0) {
    const p = (k - 1) >> 1;
    if (f[heap[p]!]! <= f[i]!) break;
    heap[k] = heap[p]!;
    k = p;
  }
  heap[k] = i;
  return size + 1;
}

function heapPop(grid: NavGrid, size: number): number {
  const { heap, f } = grid;
  const top = heap[0]!;
  const last = heap[size - 1]!;
  const n = size - 1;
  let k = 0;
  for (;;) {
    let child = 2 * k + 1;
    if (child >= n) break;
    if (child + 1 < n && f[heap[child + 1]!]! < f[heap[child]!]!) child++;
    if (f[heap[child]!]! >= f[last]!) break;
    heap[k] = heap[child]!;
    k = child;
  }
  heap[k] = last;
  return top;
}

/** How many cells a query may expand before giving up on routing (the walk is then the plain straight line). */
export const NAV_MAX_EXPANSIONS = 120_000;

/**
 * The points a walk from `from` to `to` goes through, in order, the last being where it ends: `to` itself when it
 * can be reached, else the outside of the nearest shut Door into the area round it, else the nearest point that can
 * be reached (just outside the walls round it). A walk with nothing in the way,
 * no grid, or a search past its cap is just `[to]`, the straight line.
 */
export function findWalkPath(grid: NavGrid | null, from: FencePoint, to: FencePoint): FencePoint[] {
  if (!grid || legClear(grid, from, to)) return [to];
  const start = clampIn(grid, from);
  const goalPoint = clampIn(grid, to);
  // The start: the nearest open cell the feet can walk to without crossing a wall (they may stand within its reach).
  const startCell = nearestCell(
    grid,
    start,
    (i) => {
      const q = centre(grid, i);
      return !grid.fences.some((fence) => segmentsIntersect({ a: start, b: q }, fence));
    },
    4,
  );
  if (startCell === -1) return [to];
  const region = grid.region[startCell]!;
  const toCell = cellAt(grid, goalPoint);
  const reachable = toCell !== -1 && grid.region[toCell] === region;
  const goalCell = reachable
    ? toCell
    : (shutDoorCell(grid, goalPoint, start, region) ??
      nearestCell(
        grid,
        goalPoint,
        (i) => grid.region[i] === region,
        Math.max(grid.cols, grid.rows),
      ));
  const cells = aStar(grid, startCell, goalCell);
  if (!cells) return [to];
  // The raw route: the feet, the cells' centres, the end; the string-pulling straightens it.
  const raw: FencePoint[] = [from];
  if (start.x !== from.x || start.y !== from.y) raw.push(start);
  for (const i of cells) raw.push(centre(grid, i));
  if (reachable) {
    if (goalPoint.x !== to.x || goalPoint.y !== to.y) raw.push(goalPoint);
    raw.push(to);
  }
  return smooth(grid, raw);
}

/**
 * Where a walk to a point it cannot reach goes when the area round that point has a shut Door the walker can get to
 * (avatar-mode.md "Finding the way"): the cell just outside the door nearest the walker, on the walker's side, so the
 * next click swings it open. Null when no shut door opens into that area (a pond, a doorless room): the nearest
 * reachable point then.
 */
function shutDoorCell(
  grid: NavGrid,
  target: FencePoint,
  feet: FencePoint,
  region: number,
): number | null {
  if (grid.shutDoors.length === 0) return null;
  // The area clicked into: the target's own open cell, else (a click on a wall or in scenery) the open cell nearest it.
  const at = cellAt(grid, target);
  const inside = at !== -1 && !grid.blocked[at] ? at : nearestCell(grid, target, () => true, 4);
  if (inside === -1) return null;
  const area = grid.region[inside]!;
  const off = grid.reach + NAV_CLEARANCE + grid.cell / 2;
  let best: number | null = null;
  let bestD = Infinity;
  for (const door of grid.shutDoors) {
    const mx = (door.a.x + door.b.x) / 2;
    const my = (door.a.y + door.b.y) / 2;
    const dx = door.b.x - door.a.x;
    const dy = door.b.y - door.a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const sides = [1, -1].map((k) => {
      const p = { x: mx + nx * off * k, y: my + ny * off * k };
      const i = cellAt(grid, p);
      return { p, region: i === -1 || grid.blocked[i] ? -1 : grid.region[i]! };
    });
    for (const [inner, outer] of [
      [sides[0]!, sides[1]!],
      [sides[1]!, sides[0]!],
    ] as const) {
      if (inner.region !== area || outer.region !== region) continue;
      const d = Math.hypot(outer.p.x - feet.x, outer.p.y - feet.y);
      if (d < bestD) {
        bestD = d;
        best = cellAt(grid, outer.p);
      }
    }
  }
  return best;
}

function aStar(grid: NavGrid, startCell: number, goalCell: number): number[] | null {
  const { cols, g, f, parent, seen, closed } = grid;
  const stamp = ++grid.stamp;
  const gc = goalCell % cols;
  const gr = (goalCell - gc) / cols;
  const h = (c: number, r: number) => {
    const dx = Math.abs(c - gc);
    const dy = Math.abs(r - gr);
    return NAV_HEURISTIC_WEIGHT * (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy));
  };
  const sc = startCell % cols;
  g[startCell] = 0;
  f[startCell] = h(sc, (startCell - sc) / cols);
  parent[startCell] = -1;
  seen[startCell] = stamp;
  let size = heapPush(grid, 0, startCell);
  let expanded = 0;
  while (size > 0) {
    const i = heapPop(grid, size);
    size--;
    if (closed[i] === stamp) continue;
    closed[i] = stamp;
    if (i === goalCell) {
      const out: number[] = [];
      for (let k = i; k !== -1; k = parent[k]!) out.push(k);
      return out.reverse();
    }
    if (++expanded > NAV_MAX_EXPANSIONS) return null;
    const c = i % cols;
    const r = (i - c) / cols;
    for (let k = 0; k < 8; k++) {
      if (!canMove(grid, c, r, k)) continue;
      const j = i + DR[k]! * cols + DC[k]!;
      if (closed[j] === stamp) continue;
      const ng = g[i]! + COST[k]!;
      if (seen[j] === stamp && ng >= g[j]!) continue;
      seen[j] = stamp;
      g[j] = ng;
      f[j] = ng + h(c + DC[k]!, r + DR[k]!);
      parent[j] = i;
      size = heapPush(grid, size, j);
    }
  }
  return null;
}

// String-pulling: from each corner, on to the farthest point of the route still in clear reach of the walls (found
// by halving, a handful of exact checks a corner), so the walk is straight legs between corners, never the grid's
// staircase. The next point is always taken, so a leg the check doubts still makes progress.
function smooth(grid: NavGrid, raw: readonly FencePoint[]): FencePoint[] {
  const out: FencePoint[] = [];
  let anchor = 0;
  const last = raw.length - 1;
  while (anchor < last) {
    let lo = anchor + 1;
    let hi = last;
    if (legClear(grid, raw[anchor]!, raw[hi]!)) lo = hi;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (legClear(grid, raw[anchor]!, raw[mid]!)) lo = mid;
      else hi = mid;
    }
    out.push(raw[lo]!);
    anchor = lo;
  }
  return out;
}
