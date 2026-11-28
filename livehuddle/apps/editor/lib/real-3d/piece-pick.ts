// Real 3D's presses (docs/specs/008-canvas/3d-engine.md "The camera and the pixel look": a press on a piece picks the
// model under it). Each piece is kept as the box its model fills, in its own frame; a press's ray through the scene is
// tested against them and the nearest hit wins. Pure: no three.js, no DOM.

import type { PieceFrame } from './piece-frame';

/** A modelled piece's box: its frame and the extent of its model in that frame. */
export type PieceBounds = {
  id: string;
  /** The piece's box on the canvas, which a press on it answers inside. */
  box: { x: number; y: number; width: number; height: number };
  f: Pick<PieceFrame, 'cx' | 'cy' | 'yaw'>;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Its lowest point: above the floor for a piece hung on a wall. */
  z0?: number;
  z1: number;
};

type V3 = { x: number; y: number; z: number };

/** The extent of a model's positions (x, y, z triples, in its frame), or null when it has none. */
export function modelBounds(
  positions: readonly number[],
): { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number } | null {
  if (positions.length < 3) return null;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!;
    const y = positions[i + 1]!;
    const z = positions[i + 2]!;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (z > z1) z1 = z;
    if (z < z0) z0 = z;
  }
  return { x0, x1, y0, y1, z0, z1 };
}

/** A canvas point into a piece's frame (the inverse of frameToCanvas's turn), for a point or a direction. */
function toFrame(f: PieceBounds['f'], p: V3, direction: boolean): V3 {
  const dx = direction ? p.x : p.x - f.cx;
  const dy = direction ? p.y : p.y - f.cy;
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  // frameToCanvas turns (x, y) by yaw; undo it.
  return { x: c * dx + s * dy, y: -s * dx + c * dy, z: p.z };
}

/** Where along a ray (origin + t * dir) it enters a box, or null when it misses (slab test). */
function enter(o: V3, d: V3, b: PieceBounds): number | null {
  let t0 = -Infinity;
  let t1 = Infinity;
  const slabs: [number, number, number, number][] = [
    [o.x, d.x, b.x0, b.x1],
    [o.y, d.y, b.y0, b.y1],
    [o.z, d.z, 0, b.z1],
  ];
  for (const [oo, dd, lo, hi] of slabs) {
    if (Math.abs(dd) < 1e-12) {
      if (oo < lo || oo > hi) return null;
      continue;
    }
    let a = (lo - oo) / dd;
    let c = (hi - oo) / dd;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, c);
    if (t0 > t1) return null;
  }
  return t1 < 0 ? null : t0;
}

/**
 * The piece a press's ray hits first, and the canvas point it stands for: where the ray meets the piece, kept inside
 * the piece's box (so a press on a bench's left end picks its left seat), or null when it hits none.
 */
export function pickPiece(
  pieces: readonly PieceBounds[],
  origin: V3,
  dir: V3,
  mesh?: PiecesTriangles,
): { id: string; point: { x: number; y: number } } | null {
  const hits: { t: number; b: PieceBounds }[] = [];
  for (const b of pieces) {
    const t = enter(toFrame(b.f, origin, false), toFrame(b.f, dir, true), b);
    if (t !== null) hits.push({ t, b });
  }
  if (!hits.length) return null;
  hits.sort((p, q) => p.t - q.t);
  // A box is coarse (a desk's holds the chair tucked under it): the piece whose own triangles the ray meets first
  // wins, and the boxes only when the ray meets no triangle at all (a press beside a thin leg still picks its piece).
  let best = hits[0]!;
  if (mesh) {
    let exact: { t: number; b: PieceBounds } | null = null;
    for (const h of hits) {
      if (exact && h.t > exact.t) break;
      const r = mesh.ranges.get(h.b.id);
      if (!r) continue;
      const t = rayTriangles(mesh.positions, r.from, r.to, origin, dir);
      if (t !== null && (!exact || t < exact.t)) exact = { t, b: h.b };
    }
    if (exact) best = exact;
  }
  const { t, b } = best;
  const hx = origin.x + dir.x * t;
  const hy = origin.y + dir.y * t;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    id: b.id,
    point: {
      x: clamp(hx, b.box.x, b.box.x + b.box.width),
      y: clamp(hy, b.box.y, b.box.y + b.box.height),
    },
  };
}

/** The pieces' one geometry as plain triangles (three vertices each, x y z), and each piece's vertices in it. */
export type PiecesTriangles = {
  positions: ArrayLike<number>;
  ranges: ReadonlyMap<string, { from: number; to: number }>;
};

/** How far along a ray (as a multiple of `dir`) it first meets one of the triangles in vertices [from, to), or null. */
export function rayTriangles(
  pos: ArrayLike<number>,
  from: number,
  to: number,
  o: V3,
  d: V3,
): number | null {
  let best: number | null = null;
  for (let v = from; v + 2 < to; v += 3) {
    const i = v * 3;
    const ax = pos[i]!;
    const ay = pos[i + 1]!;
    const az = pos[i + 2]!;
    const e1x = pos[i + 3]! - ax;
    const e1y = pos[i + 4]! - ay;
    const e1z = pos[i + 5]! - az;
    const e2x = pos[i + 6]! - ax;
    const e2y = pos[i + 7]! - ay;
    const e2z = pos[i + 8]! - az;
    // Möller and Trumbore, either side facing.
    const px = d.y * e2z - d.z * e2y;
    const py = d.z * e2x - d.x * e2z;
    const pz = d.x * e2y - d.y * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-9) continue;
    const inv = 1 / det;
    const tx = o.x - ax;
    const ty = o.y - ay;
    const tz = o.z - az;
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y;
    const qy = tz * e1x - tx * e1z;
    const qz = tx * e1y - ty * e1x;
    const w = (d.x * qx + d.y * qy + d.z * qz) * inv;
    if (w < 0 || u + w > 1) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (t > 0 && (best === null || t < best)) best = t;
  }
  return best;
}
