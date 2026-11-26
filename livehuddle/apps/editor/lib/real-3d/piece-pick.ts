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
  z1: number;
};

type V3 = { x: number; y: number; z: number };

/** The extent of a model's positions (x, y, z triples, in its frame), or null when it has none. */
export function modelBounds(
  positions: readonly number[],
): { x0: number; x1: number; y0: number; y1: number; z1: number } | null {
  if (positions.length < 3) return null;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
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
  }
  return { x0, x1, y0, y1, z1 };
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
): { id: string; point: { x: number; y: number } } | null {
  let best: { t: number; b: PieceBounds } | null = null;
  for (const b of pieces) {
    const t = enter(toFrame(b.f, origin, false), toFrame(b.f, dir, true), b);
    if (t !== null && (!best || t < best.t)) best = { t, b };
  }
  if (!best) return null;
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
