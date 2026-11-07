// Where the office dog is (docs/specs/009-elements/workday-pieces.md "Pet Bed and its dog"): the same place on every
// screen with nothing sent. Time is cut into legs of PET_LEG_MS; each leg's spot comes from the bed's id and the leg's
// number through a small seeded generator, so any two clocks that agree to a second agree on the dog. Every fourth leg
// it goes back to its bed. A spot where the dog would stand behind or under a piece, or in another room's walls, is
// passed over for the generator's next one, the same on every screen. Pure: no React, no DOM, no clock of its own (the caller passes `now`).

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
/**
 * The pieces the dog walks over rather than round: floors drawn under everything (a room is its own case, and the beds
 * are where it sleeps). Every other piece is one it keeps clear of.
 */
export const PET_FLOOR_KINDS: ReadonlySet<string> = new Set([
  'room',
  'corridor',
  'rug',
  'grass',
  'garden-path',
  'stage',
  'avatar-pad',
  'pet-bed',
]);
/** How many spots a leg tries before the dog gives up and naps in its bed (a room packed with pieces). */
export const PET_TRIES = 12;
/**
 * The dog's drawing round its feet, in canvas px, with a little room to spare: what must clear every piece. Its feet sit
 * at the bottom middle of a 44 by 32 drawing.
 */
export const PET_BODY = { left: 26, right: 26, up: 34, down: 6 } as const;

type Box = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

/**
 * Where the dog may go: a box (its room's floor, inset) or a circle round its bed, and the boxes in it its body must
 * keep clear of (the pieces standing there, and any other room's walls). No `blocks` is an empty floor.
 */
export type PetArea = ({ kind: 'box'; box: Box } | { kind: 'circle'; at: Point; r: number }) & {
  blocks?: readonly Box[];
};

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

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const pick = (b: Box): Box => ({ x: b.x, y: b.y, width: b.width, height: b.height });

/** The dog's body standing with its feet at `p`. */
function bodyAt(p: Point): Box {
  return {
    x: p.x - PET_BODY.left,
    y: p.y - PET_BODY.up,
    width: PET_BODY.left + PET_BODY.right,
    height: PET_BODY.up + PET_BODY.down,
  };
}

/** Whether a room's box holds a point. */
const holds = (r: Box, p: Point) =>
  p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;

/** The pieces and other rooms the dog keeps clear of, cut to the ones its body could reach in `area`. */
function blocksIn(area: Box, pieces: readonly Box[], rooms: readonly Box[], at: Point): Box[] {
  const reach = {
    x: area.x - PET_BODY.left,
    y: area.y - PET_BODY.up,
    width: area.width + PET_BODY.left + PET_BODY.right,
    height: area.height + PET_BODY.up + PET_BODY.down,
  };
  const out: Box[] = [];
  for (const b of pieces) if (overlaps(b, reach)) out.push(pick(b));
  // Another room, whole: its walls, and its floor, which is not this dog's. The rooms round the bed are its own.
  for (const r of rooms) if (!holds(r, at) && overlaps(r, reach)) out.push(pick(r));
  return out;
}

/**
 * The dog's area: the innermost (smallest) room whose floor holds the bed's middle, inset by PET_INSET, or a circle
 * PET_RADIUS round the bed when it stands in no room (or its room is too small to inset). `pieces` are the boxes of the
 * pieces on the board that the dog may not stand behind or under (the caller leaves out floors, rugs and the bed).
 */
export function petArea(bed: Box, rooms: readonly Box[], pieces: readonly Box[] = []): PetArea {
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
    if (box.width > 0 && box.height > 0) {
      const blocks = blocksIn(box, pieces, rooms, at);
      return blocks.length > 0 ? { kind: 'box', box, blocks } : { kind: 'box', box };
    }
  }
  const round = {
    x: at.x - PET_RADIUS,
    y: at.y - PET_RADIUS,
    width: 2 * PET_RADIUS,
    height: 2 * PET_RADIUS,
  };
  const blocks = blocksIn(round, pieces, rooms, at);
  return blocks.length > 0
    ? { kind: 'circle', at, r: PET_RADIUS, blocks }
    : { kind: 'circle', at, r: PET_RADIUS };
}

/** The leg `now` falls in. */
export function petLegAt(now: number): number {
  return Math.floor(now / PET_LEG_MS);
}

/** One spot in the area from the generator's next two numbers. */
function spotIn(area: PetArea, next: () => number): Point {
  if (area.kind === 'box') {
    const { box } = area;
    return { x: box.x + next() * box.width, y: box.y + next() * box.height };
  }
  // Uniform over the disc: the square root keeps the dog from bunching at the middle.
  const angle = next() * Math.PI * 2;
  const r = Math.sqrt(next()) * area.r;
  return { x: area.at.x + Math.cos(angle) * r, y: area.at.y + Math.sin(angle) * r };
}

/** Whether the dog standing at `p` is clear of every block: in front of a piece, never behind or under it. */
export function petClear(p: Point, blocks: readonly Box[] | undefined): boolean {
  if (!blocks) return true;
  const body = bodyAt(p);
  for (const b of blocks) if (overlaps(body, b)) return false;
  return true;
}

/**
 * Where the dog's feet are at the end of leg `n`, in canvas px, or null when it naps in its bed then. The same bed id
 * and leg give the same spot everywhere: the generator's first clear spot of PET_TRIES, or the bed when none is.
 */
export function petLeg(id: string, n: number, area: PetArea): Point | null {
  if (((n % PET_NAP_EVERY) + PET_NAP_EVERY) % PET_NAP_EVERY === PET_NAP_EVERY - 1) return null;
  const next = seeded(hashId(id) ^ Math.imul(n | 0, 0x9e3779b1));
  for (let i = 0; i < PET_TRIES; i += 1) {
    const spot = spotIn(area, next);
    if (petClear(spot, area.blocks)) return spot;
  }
  return null;
}

/** The ms until the next leg starts, from `now`: when the dog's one timer next wakes. */
export function msToNextLeg(now: number): number {
  return PET_LEG_MS - (((now % PET_LEG_MS) + PET_LEG_MS) % PET_LEG_MS);
}
