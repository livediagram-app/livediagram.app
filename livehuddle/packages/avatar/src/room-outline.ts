// Custom-shaped rooms and doors (docs/specs/009-elements/room-builder.md): the pure geometry of a room
// drawn wall by wall (its walls from its outline, the 45-degree snap that draws them, whether a point is inside) and
// of a Door on a wall (its line, the gap it cuts in the wall's collision, the wall it snaps onto). No React, no DOM.

export type OutlinePoint = { x: number; y: number };
export type OutlineSegment = { a: OutlinePoint; b: OutlinePoint };

/**
 * The corner placed from `from` toward `to`, along the nearest of the eight 45-degree directions, at the pointer's
 * distance projected on that direction (the Room Builder's snap).
 */
export function snap45(from: OutlinePoint, to: OutlinePoint): OutlinePoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return { x: from.x, y: from.y };
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const along = dx * ux + dy * uy;
  // Rounded so the axis directions come out exact (cos(pi/2) is 6e-17, not 0).
  const clean = (v: number) => Math.round(v * 1e9) / 1e9;
  return { x: from.x + clean(along * ux), y: from.y + clean(along * uy) };
}

/** A closed outline's walls in canvas px: each corner to the next, and the last back to the first. */
export function outlineWalls(
  box: { x: number; y: number; width: number; height: number },
  outline: readonly OutlinePoint[],
): OutlineSegment[] {
  const pts = outline.map((p) => ({ x: box.x + p.x * box.width, y: box.y + p.y * box.height }));
  const out: OutlineSegment[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    if (a.x !== b.x || a.y !== b.y) out.push({ a, b });
  }
  return out;
}

/** Whether `p` is strictly inside the polygon (even-odd rule); a point on an edge may land either way. */
export function pointInPolygon(p: OutlinePoint, poly: readonly OutlinePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** The polygon's area (shoelace), always positive. */
export function polygonArea(poly: readonly OutlinePoint[]): number {
  let sum = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    sum += (poly[j]!.x + poly[i]!.x) * (poly[j]!.y - poly[i]!.y);
  }
  return Math.abs(sum) / 2;
}

// --- Doors -------------------------------------------------------------------

/** What a door is to the walls: its centre, its rotation (degrees clockwise) and its width along the wall. */
export type DoorBox = { x: number; y: number; width: number; height: number; rotation?: number };

/** A door's line across its wall: centred on its box, turned by its rotation, as long as it is wide. */
export function doorLine(door: DoorBox): OutlineSegment {
  const cx = door.x + door.width / 2;
  const cy = door.y + door.height / 2;
  const r = ((door.rotation ?? 0) * Math.PI) / 180;
  const hx = (Math.cos(r) * door.width) / 2;
  const hy = (Math.sin(r) * door.width) / 2;
  return { a: { x: cx - hx, y: cy - hy }, b: { x: cx + hx, y: cy + hy } };
}

// A door stands on a wall when its centre is this close to the wall's centre line and it runs along it.
const ON_WALL_PX = 2;
const PARALLEL_SIN = Math.sin((1 * Math.PI) / 180);

/** Where along `wall` (0..length) the door's line covers, or null when the door is not standing on that wall. */
export function doorSpanOnWall(
  wall: OutlineSegment,
  door: OutlineSegment,
): [number, number] | null {
  const wx = wall.b.x - wall.a.x;
  const wy = wall.b.y - wall.a.y;
  const len = Math.hypot(wx, wy);
  if (len === 0) return null;
  const ux = wx / len;
  const uy = wy / len;
  const dx = door.b.x - door.a.x;
  const dy = door.b.y - door.a.y;
  const dlen = Math.hypot(dx, dy);
  if (dlen === 0) return null;
  // Parallel: the cross product of the two directions is near zero.
  if (Math.abs((ux * dy - uy * dx) / dlen) > PARALLEL_SIN) return null;
  const cx = (door.a.x + door.b.x) / 2 - wall.a.x;
  const cy = (door.a.y + door.b.y) / 2 - wall.a.y;
  if (Math.abs(cx * uy - cy * ux) > ON_WALL_PX) return null;
  const at = cx * ux + cy * uy;
  const from = Math.max(0, at - dlen / 2);
  const to = Math.min(len, at + dlen / 2);
  return to > from ? [from, to] : null;
}

/** The walls with every door standing on one cut out of it: what a character cannot cross. */
export function cutByDoors(
  walls: readonly OutlineSegment[],
  doors: readonly OutlineSegment[],
): OutlineSegment[] {
  if (doors.length === 0) return [...walls];
  const out: OutlineSegment[] = [];
  for (const wall of walls) {
    const gaps = doors
      .map((d) => doorSpanOnWall(wall, d))
      .filter((g): g is [number, number] => g !== null)
      .sort((p, q) => p[0] - q[0]);
    if (gaps.length === 0) {
      out.push(wall);
      continue;
    }
    const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    const at = (t: number) => ({
      x: wall.a.x + ((wall.b.x - wall.a.x) * t) / len,
      y: wall.a.y + ((wall.b.y - wall.a.y) * t) / len,
    });
    let from = 0;
    for (const [g0, g1] of gaps) {
      if (g0 > from) out.push({ a: at(from), b: at(g0) });
      from = Math.max(from, g1);
    }
    if (from < len) out.push({ a: at(from), b: at(len) });
  }
  return out;
}

/**
 * The nearest wall to `p` within `reach` canvas px: which wall (its index), the point on its centre line closest to
 * `p` and the wall's angle (degrees, 0..180), or null when every wall is further. With `halfWidth`, the point keeps that far from the wall's
 * ends where the wall is long enough, so a door slid to a corner stays on its own wall.
 */
export function nearestWall(
  p: OutlinePoint,
  walls: readonly OutlineSegment[],
  reach: number,
  halfWidth = 0,
): { index: number; at: OutlinePoint; angle: number } | null {
  let best: { index: number; at: OutlinePoint; angle: number; dist: number } | null = null;
  for (const [index, w] of walls.entries()) {
    const wx = w.b.x - w.a.x;
    const wy = w.b.y - w.a.y;
    const len2 = wx * wx + wy * wy;
    if (len2 === 0) continue;
    const len = Math.sqrt(len2);
    const margin = halfWidth * 2 <= len ? halfWidth / len : 0.5;
    const t0 = ((p.x - w.a.x) * wx + (p.y - w.a.y) * wy) / len2;
    // Measured to the wall itself; the door's place on it then keeps clear of the ends.
    const near = Math.max(0, Math.min(1, t0));
    const dist = Math.hypot(p.x - (w.a.x + wx * near), p.y - (w.a.y + wy * near));
    const t = Math.max(margin, Math.min(1 - margin, t0));
    const at = { x: w.a.x + wx * t, y: w.a.y + wy * t };
    if (dist > reach || (best && dist >= best.dist)) continue;
    let angle = (Math.atan2(wy, wx) * 180) / Math.PI;
    angle = Math.round((((angle % 180) + 180) % 180) * 1e6) / 1e6;
    if (angle === 180) angle = 0;
    best = { index, at, angle, dist };
  }
  return best ? { index: best.index, at: best.at, angle: best.angle } : null;
}
