// Where a sitter's hips rest (docs/specs/008-canvas/3d-engine.md "Sitting fits the figure"): the seat's own top under
// them, found in the scene's geometry, so a bar stool, a sofa or a bench seats them at its height rather than one
// height for every seat (the owner, 2026-11-27: "sitting down in chairs doesn't look right, I bleed through them"),
// and a hammock lays them down along it ("when I sit in it I should lie down"). Pure, canvas px.

import { rayTriangles, type PieceBounds, type PiecesTriangles } from './piece-pick';

/** Kinds a sitter lies on rather than sits on. */
const LIE_ON: ReadonlySet<string> = new Set(['hammock']);
/**
 * How far behind a sitter's feet (canvas px, at 100%) their seat is looked for: under the thighs to the hips. From
 * just behind the spot, so a stool only 18 px across (a Phone Booth's) is still found under a larger sitter, whose
 * samples spread further (the owner, 2026-11-27: "sitting in phone booth is broken").
 */
const BEHIND = [2, 6, 11, 16, 21];

export type SeatSurface = {
  height: number;
  lying: boolean;
  /** How far behind the feet (canvas px) the hips go: short of the seat's back, so the back never runs through them. */
  hipsBack: number | null;
  /** For one to lie on: its middle on the canvas and the way its length runs (its frame's x), to lie along. */
  bed: { x: number; y: number; yaw: number } | null;
};

/** Where the seat's back is looked for, behind the feet (canvas px, at 100%). */
const BACK_FROM = 4;
const BACK_TO = 34;
/** Higher than the seat by this (canvas px), a surface behind the hips is the seat's back. */
const BACK_RISE = 10;
/** How far in front of the back the body rests (GameFigure keeps its own depth behind the hips clear too). */
const BACK_GAP = 1;

/**
 * The top of the seat a sitter at `feet`, facing `yaw` (figure-motion.ts: forward is (-sin, cos)), rests on: the
 * highest surface of the piece they sit on found under their thighs and hips, no higher than `cap` (a chair's back or
 * a desk's top over it is never the seat), or null when none is found.
 */
export function seatSurface(
  mesh: PiecesTriangles,
  bounds: readonly PieceBounds[],
  kindOf: (id: string) => string | undefined,
  feet: { x: number; y: number },
  yaw: number,
  scale: number,
  cap: number,
): SeatSurface | null {
  const back = { x: Math.sin(yaw), y: -Math.cos(yaw) };
  let best: { z: number; id: string; b: PieceBounds } | null = null;
  for (const b of bounds) {
    const r = mesh.ranges.get(b.id);
    if (!r) continue;
    // Only a piece whose footprint is near the feet (in its own frame).
    const c = Math.cos(b.f.yaw);
    const s = Math.sin(b.f.yaw);
    const dx = feet.x - b.f.cx;
    const dy = feet.y - b.f.cy;
    const qx = c * dx + s * dy;
    const qy = -s * dx + c * dy;
    const pad = 30 * scale;
    if (qx < b.x0 - pad || qx > b.x1 + pad || qy < b.y0 - pad || qy > b.y1 + pad) continue;
    // Nearest first: the seat is what is found under the thighs, until a surface stands well over it, which is the
    // seat's back or an arm (a sofa's, a bench's) and never the seat (the sitter hovered on a sofa's back).
    let first: number | null = null;
    for (const d of BEHIND) {
      const o = { x: feet.x + back.x * d * scale, y: feet.y + back.y * d * scale, z: cap };
      const t = rayTriangles(mesh.positions, r.from, r.to, o, { x: 0, y: 0, z: -1 });
      if (t === null) continue;
      const z = cap - t;
      if (z <= 1) continue;
      if (first !== null && z > first + BACK_RISE) break;
      first ??= z;
      if (!best || z > best.z) best = { z, id: b.id, b };
    }
  }
  if (!best) return null;
  // The seat's back: walking back from the feet, where the piece first stands well over the seat.
  let hipsBack: number | null = null;
  const seat = best;
  const r = mesh.ranges.get(seat.id)!;
  // One canvas px at a time, whatever the sitter's size: a chair's back is only a few px thick, and a step that grew
  // with a larger figure stepped over it (the owner, 2026-11-27: "merged with the back of the chair").
  for (let d = BACK_FROM * scale; d <= BACK_TO * scale; d += 1) {
    const o = {
      x: feet.x + back.x * d,
      y: feet.y + back.y * d,
      z: cap * 2,
    };
    const t = rayTriangles(mesh.positions, r.from, r.to, o, { x: 0, y: 0, z: -1 });
    if (t !== null && o.z - t > seat.z + BACK_RISE) {
      hipsBack = Math.max(0, d - BACK_GAP);
      break;
    }
  }
  const lying = LIE_ON.has(kindOf(seat.id) ?? '');
  const bed = lying ? { x: seat.b.f.cx, y: seat.b.f.cy, yaw: seat.b.f.yaw } : null;
  // Lying, the body rests on the sling's lowest point, its middle (not a rope or a bar the samples met).
  let height = seat.z;
  if (bed) {
    const t = rayTriangles(
      mesh.positions,
      r.from,
      r.to,
      { x: bed.x, y: bed.y, z: cap },
      { x: 0, y: 0, z: -1 },
    );
    if (t !== null) height = cap - t;
  }
  return { height, lying, hipsBack, bed };
}
