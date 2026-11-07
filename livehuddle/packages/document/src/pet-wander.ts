// Where the office dog is (docs/specs/009-elements/workday-pieces.md "Pet Bed and its dog"): the same place on every
// screen with nothing sent. Time is cut into legs of PET_LEG_MS; each leg's spot comes from the bed's id and the leg's
// number through a small seeded generator, so any two clocks that agree to a second agree on the dog. Every fourth leg
// it goes back to its bed. Pure: no React, no DOM, no clock of its own (the caller passes `now`).

import { roomInterior } from '@liveworkspace/avatar/office-geometry';

/** One leg: the dog trots to its spot over the first PET_TROT_MS, then sits there. */
export const PET_LEG_MS = 9_000;
export const PET_TROT_MS = 3_000;
/** How far round a bed in no room its dog wanders, from the bed's middle. */
export const PET_RADIUS = 240;
/** How far the dog keeps off its room's walls. */
export const PET_INSET = 28;
/** Every this many legs the dog naps in its bed (the last leg of each run). */
export const PET_NAP_EVERY = 4;

type Box = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

/** Where the dog may go: a box (its room's floor, inset) or a circle round its bed. */
export type PetArea = { kind: 'box'; box: Box } | { kind: 'circle'; at: Point; r: number };

/** A string's 32-bit FNV-1a hash: the bed's seed. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small, fast seeded generator; the same seed gives the same numbers on every machine. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const middle = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/**
 * The dog's area: the innermost (smallest) room whose floor holds the bed's middle, inset by PET_INSET, or a circle
 * PET_RADIUS round the bed when it stands in no room (or its room is too small to inset).
 */
export function petArea(bed: Box, rooms: readonly Box[]): PetArea {
  const at = middle(bed);
  let best: Box | null = null;
  for (const r of rooms) {
    const f = roomInterior(r);
    if (at.x <= f.x || at.x >= f.x + f.width || at.y <= f.y || at.y >= f.y + f.height) continue;
    if (!best || r.width * r.height < best.width * best.height) best = r;
  }
  if (best) {
    const f = roomInterior(best);
    const box = {
      x: f.x + PET_INSET,
      y: f.y + PET_INSET,
      width: f.width - 2 * PET_INSET,
      height: f.height - 2 * PET_INSET,
    };
    if (box.width > 0 && box.height > 0) return { kind: 'box', box };
  }
  return { kind: 'circle', at, r: PET_RADIUS };
}

/** The leg `now` falls in. */
export function petLegAt(now: number): number {
  return Math.floor(now / PET_LEG_MS);
}

/**
 * Where the dog's feet are at the end of leg `n`, in canvas px, or null when it naps in its bed then. The same bed id
 * and leg give the same spot everywhere.
 */
export function petLeg(id: string, n: number, area: PetArea): Point | null {
  if (((n % PET_NAP_EVERY) + PET_NAP_EVERY) % PET_NAP_EVERY === PET_NAP_EVERY - 1) return null;
  const next = seeded(hashId(id) ^ Math.imul(n | 0, 0x9e3779b1));
  if (area.kind === 'box') {
    const { box } = area;
    return { x: box.x + next() * box.width, y: box.y + next() * box.height };
  }
  // Uniform over the disc: the square root keeps the dog from bunching at the middle.
  const angle = next() * Math.PI * 2;
  const r = Math.sqrt(next()) * area.r;
  return { x: area.at.x + Math.cos(angle) * r, y: area.at.y + Math.sin(angle) * r };
}

/** The ms until the next leg starts, from `now`: when the dog's one timer next wakes. */
export function msToNextLeg(now: number): number {
  return PET_LEG_MS - (((now % PET_LEG_MS) + PET_LEG_MS) % PET_LEG_MS);
}
