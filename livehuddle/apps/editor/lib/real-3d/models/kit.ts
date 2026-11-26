// Real 3D's model kit (docs/specs/008-canvas/3d-engine.md "Block models"): each piece kind built of boxes in its
// own drawing's colours, facing the default camera in its frame (piece-frame.ts): x across its front, y from its back
// (-D/2) to its front (+D/2), z up from the floor, all in canvas px. A kind without a model of its own is a block of
// its footprint at its kind's height, in its drawing's colours. Pure: no three.js, no DOM.

import { MeshBuilder, mix, type BoxSpec, type Rgb } from '../mesh-builder';
import type { PieceFrame } from '../piece-frame';
import type { PieceTones } from '../piece-tones';

export { mix };

/** How high a sitter's seat is: where a seated figure's hips rest (character-rig's seated pose). */
export const SEAT_Z = 15;

/**
 * Every kind's height in canvas px, in an order under a character's 56 (the owner, 2026-11-25: "there should be some
 * visual height hierarchy"): low pieces you see over, tall ones that hide you.
 */
export const KIND_HEIGHT: Record<string, number> = {
  chair: 36,
  desk: 30,
  sofa: 30,
  'meeting-table': 28,
  plant: 52,
  bookshelf: 104,
  'water-cooler': 62,
  'coffee-machine': 40,
  bar: 34,
  'bar-stool': 26,
  'drinks-cabinet': 72,
  'drinks-fridge': 84,
  'outdoor-plant': 40,
  tree: 150,
  'notice-board': 60,
  'world-clock': 40,
  jukebox: 68,
  'ping-pong-table': 24,
  'arcade-machine': 72,
  fireplace: 70,
  campfire: 14,
  bench: 18,
  'picnic-table': 26,
  hammock: 26,
  'garden-umbrella': 104,
  fountain: 34,
  'pool-table': 26,
  'foosball-table': 28,
  dartboard: 40,
  'vending-machine': 84,
  'bean-bag': 16,
  'reading-nook': 62,
  printer: 28,
  copier: 46,
  lockers: 92,
  'coat-rack': 74,
  'umbrella-stand': 22,
  'kitchen-counter': 32,
  'kitchen-sink': 32,
  fridge: 88,
  microwave: 16,
  kettle: 10,
  'toilet-cubicle': 112,
  washbasin: 34,
  'hand-dryer': 20,
  pillar: 152,
  column: 152,
  'bike-rack': 36,
  'stage-curtains': 150,
  podium: 40,
  'nap-pod': 42,
  treadmill: 50,
  'weight-bench': 18,
  'phone-booth': 112,
  'standing-desk': 42,
  'hot-desk': 30,
  'pet-bed': 6,
  'reception-desk': 32,
  directory: 72,
  elevator: 152,
  'calendar-wall': 70,
  'suggestion-box': 42,
  signpost: 84,
  'photo-wall': 80,
};

export function kindHeight(kind: string): number {
  return KIND_HEIGHT[kind] ?? 24;
}

/** A model's context: its frame, its colours and, for a piece that seats people, its seats in its frame. */
export type ModelContext = {
  f: PieceFrame;
  t: PieceTones;
  /** Seats in the model's frame (where a sitter's feet go) and which way each sitter faces in it. */
  seats: readonly { x: number; y: number; facing: string }[];
};

export type Model = (m: Builder, c: ModelContext) => void;

/** A MeshBuilder with corner-to-corner boxes in the model's frame. */
export class Builder extends MeshBuilder {
  /** A box from (x0, y0, z0) to (x1, y1, z1). */
  b(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    colour: Rgb,
    o: Partial<BoxSpec> = {},
  ): void {
    this.box({
      x: Math.min(x0, x1),
      y: Math.min(y0, y1),
      z: Math.min(z0, z1),
      w: Math.abs(x1 - x0),
      d: Math.abs(y1 - y0),
      h: Math.abs(z1 - z0),
      colour,
      ...o,
    });
  }
  /** A box by its middle on the floor plan, its size and its height range. */
  c(
    x: number,
    y: number,
    w: number,
    d: number,
    z0: number,
    z1: number,
    colour: Rgb,
    o: Partial<BoxSpec> = {},
  ): void {
    this.b(x - w / 2, y - d / 2, z0, x + w / 2, y + d / 2, z1, colour, o);
  }
  /** Four legs under a top from (x0, y0) to (x1, y1), `t` thick, up to z. */
  legs(x0: number, y0: number, x1: number, y1: number, z: number, t: number, colour: Rgb): void {
    for (const [x, y] of [
      [x0, y0],
      [x1 - t, y0],
      [x0, y1 - t],
      [x1 - t, y1 - t],
    ] as const)
      this.b(x, y, 0, x + t, y + t, z, colour, { bare: true });
  }
}

export const WOOD = 0xb8834f;
export const WOOD_DARK = 0x8a5a33;
export const METAL = 0x94a3b8;
export const METAL_DARK = 0x475569;
export const GLASS = 0xcfe6f3;

/** A seat for one: a cushioned seat on legs, a back behind, facing +y. */
export function chairAt(
  m: Builder,
  x: number,
  y: number,
  w: number,
  t: PieceTones,
  back = true,
): void {
  const d = w * 0.9;
  m.legs(x - w / 2 + 1, y - d / 2 + 1, x + w / 2 - 1, y + d / 2 - 1, SEAT_Z - 4, 2.5, t.stroke);
  m.c(x, y, w, d, SEAT_Z - 4, SEAT_Z, mix(t.seat, t.stroke, 0.2), { top: t.seat });
  if (back) m.c(x, y - d / 2 + 2, w, 4, SEAT_Z, SEAT_Z + 20, mix(t.seat, t.stroke, 0.15));
}

export type ModelTable = Record<string, Model>;
