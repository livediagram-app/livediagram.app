// Piece moments (docs/specs/009-elements/piece-moments.md): the small surprises a still piece plays each time your
// character walks right up to it. Which pieces have one, the strip your feet must step into, how long each plays, the
// trigger that decides (pure: every arrival plays, unless that piece's moment is still playing), and the store a
// piece's view reads, keyed by piece, so a moment re-renders only the piece it plays on.

import { useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

export const MOMENT_KINDS = [
  'tree',
  'outdoor-plant',
  'plant',
  'pond',
  'fountain',
  'fireplace',
  'campfire',
  'vending-machine',
  // Every other static piece (piece-moments.md "Which pieces have a moment", owner 2026-11-07).
  'bookshelf',
  'bar',
  'garden-umbrella',
  'pool-table',
  'foosball-table',
  'dartboard',
  'printer',
  'copier',
  'lockers',
  'coat-rack',
  'umbrella-stand',
  'kitchen-counter',
  'kitchen-sink',
  'fridge',
  'microwave',
  'kettle',
  'toilet-cubicle',
  'washbasin',
  'hand-dryer',
  'car-park',
  'bike-rack',
  'swimming-pool',
  'stage-curtains',
  'podium',
  'photo-wall',
  'pillar',
  'column',
] as const;
export type MomentKind = (typeof MOMENT_KINDS)[number];

const KIND_SET: ReadonlySet<string> = new Set(MOMENT_KINDS);

/** Whether a piece of this kind plays a moment. */
export function hasMoment(kind: string): kind is MomentKind {
  return KIND_SET.has(kind);
}

/** The kinds that look the same from every side, so they play their own moment at every facing. */
export const SWAY_KINDS = ['tree', 'outdoor-plant', 'plant'] as const;
export type SwayKind = (typeof SWAY_KINDS)[number];

export function swaysOnMoment(kind: string): kind is SwayKind {
  return kind === 'tree' || kind === 'outdoor-plant' || kind === 'plant';
}

/** How near the piece's base your feet must come: the Arcade Machine's reach. */
export const MOMENT_REACH = 24;
/** A wall piece's reach below it: the floor in front of a room's back wall. */
export const WALL_REACH = 56;
/** A counter piece's reach below it: a Kitchen Counter's 88 px body, then the floor in front of it. */
export const COUNTER_REACH = 96;

/** Where the reach starts down the piece's box: the base of what stands up, all round what lies flat. */
export const MOMENT_TOP: Record<MomentKind, number> = {
  tree: 0.6,
  'outdoor-plant': 0.45,
  plant: 0.5,
  pond: 0,
  fountain: 0.5,
  fireplace: 0.7,
  campfire: 0,
  'vending-machine': 0.7,
  bookshelf: 0.7,
  bar: 0.6,
  'garden-umbrella': 0.8,
  'pool-table': 0.5,
  'foosball-table': 0.5,
  dartboard: 0.5,
  printer: 0.55,
  copier: 0.5,
  lockers: 0.75,
  'coat-rack': 0.8,
  'umbrella-stand': 0.5,
  'kitchen-counter': 0.5,
  'kitchen-sink': 0.5,
  fridge: 0.8,
  microwave: 0.5,
  kettle: 0.5,
  'toilet-cubicle': 0.6,
  washbasin: 0.7,
  'hand-dryer': 0.5,
  'car-park': 0.3,
  'bike-rack': 0.5,
  'swimming-pool': 0,
  'stage-curtains': 0.5,
  podium: 0.7,
  'photo-wall': 0.5,
  pillar: 0.8,
  column: 0.8,
};

/** How far below the box the reach goes: the floor in front of a wall or a counter, else MOMENT_REACH. */
const BELOW_WALL_OR_COUNTER: Partial<Record<MomentKind, number>> = {
  dartboard: WALL_REACH,
  'hand-dryer': WALL_REACH,
  'photo-wall': WALL_REACH,
  'stage-curtains': WALL_REACH,
  microwave: COUNTER_REACH,
  kettle: COUNTER_REACH,
};
// Every kind filled in, so the check on every step never misses a key.
export const MOMENT_BELOW = Object.fromEntries(
  MOMENT_KINDS.map((k) => [k, BELOW_WALL_OR_COUNTER[k] ?? MOMENT_REACH]),
) as Record<MomentKind, number>;

/** How long each kind's moment plays: its longest part's delay and duration, rounded up. */
export const MOMENT_MS: Record<MomentKind, number> = {
  tree: 2800,
  'outdoor-plant': 2700,
  plant: 2000,
  pond: 2400,
  fountain: 2100,
  fireplace: 1800,
  campfire: 1800,
  'vending-machine': 1500,
  bookshelf: 1400,
  bar: 1700,
  'garden-umbrella': 1900,
  'pool-table': 1900,
  'foosball-table': 1700,
  dartboard: 1700,
  printer: 1900,
  copier: 2000,
  lockers: 2500,
  'coat-rack': 1900,
  'umbrella-stand': 2700,
  'kitchen-counter': 1300,
  'kitchen-sink': 2800,
  fridge: 1800,
  microwave: 1800,
  kettle: 1900,
  'toilet-cubicle': 1500,
  washbasin: 2400,
  'hand-dryer': 1300,
  'car-park': 1300,
  'bike-rack': 1700,
  'swimming-pool': 2500,
  'stage-curtains': 1900,
  podium: 2000,
  'photo-wall': 1100,
  pillar: 1500,
  column: 2500,
};

export type Side = -1 | 1;
type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };
/** A moment piece as the trigger checks it: its box, and its reach's box, worked out once (momentPiece). */
export type MomentPiece = Box & {
  id: string;
  kind: MomentKind;
  left: number;
  top: number;
  right: number;
  bottom: number;
};
export type MomentHit = { id: string; side: Side };

/**
 * A piece with its reach: its box from MOMENT_TOP of its height down to MOMENT_BELOW under it, widened by
 * MOMENT_REACH each side (and above, for what lies flat). Worked out when the board changes, so a step only compares.
 */
export function momentPiece(piece: Box & { id: string; kind: MomentKind }): MomentPiece {
  const top = MOMENT_TOP[piece.kind];
  return {
    id: piece.id,
    kind: piece.kind,
    x: piece.x,
    y: piece.y,
    width: piece.width,
    height: piece.height,
    left: piece.x - MOMENT_REACH,
    right: piece.x + piece.width + MOMENT_REACH,
    top: piece.y + piece.height * top - (top === 0 ? MOMENT_REACH : 0),
    bottom: piece.y + piece.height + MOMENT_BELOW[piece.kind],
  };
}

/** Whether `p` stands in this piece's reach: one box test, checked on every step, so it builds nothing. */
export function inMomentReach(p: Point, piece: MomentPiece): boolean {
  return p.x >= piece.left && p.x <= piece.right && p.y >= piece.top && p.y <= piece.bottom;
}

export type MomentTrigger = {
  /**
   * One step of your feet: every piece whose moment plays now, and the side you came from. The array is the
   * trigger's own, cleared and reused on the next step, so read it before stepping again.
   */
  step(feet: Point, pieces: readonly MomentPiece[]): readonly MomentHit[];
  /** You left Avatar mode or the board: the next step into a reach is an arrival again. */
  reset(): void;
};

export function createMomentTrigger({
  now = Date.now,
}: { now?: () => number } = {}): MomentTrigger {
  // The pieces whose reach held your feet last step: a handful at most, so leaving is checked over these alone and
  // the walk over every piece is one box test each, with no Set or Map traffic while you are near nothing.
  const near = new Map<string, MomentPiece>();
  // When each played piece's moment ends, so a moment never restarts over itself.
  const playingUntil = new Map<string, number>();
  const hits: MomentHit[] = [];
  return {
    step(feet, pieces) {
      if (hits.length > 0) hits.length = 0;
      for (const [id, piece] of near) if (!inMomentReach(feet, piece)) near.delete(id);
      let t = -1;
      for (const piece of pieces) {
        if (!inMomentReach(feet, piece) || near.has(piece.id)) continue;
        near.set(piece.id, piece);
        if (t < 0) t = now();
        const until = playingUntil.get(piece.id);
        if (until !== undefined && t < until) continue;
        playingUntil.set(piece.id, t + MOMENT_MS[piece.kind]);
        hits.push({ id: piece.id, side: feet.x < piece.x + piece.width / 2 ? -1 : 1 });
      }
      return hits;
    },
    reset() {
      near.clear();
    },
  };
}

/** A moment playing on a piece: `seq` only grows, so each new one is a new key. */
export type PieceMomentPlay = { seq: number; side: Side };

const plays = new Map<string, PieceMomentPlay>();
const listeners = createListeners();

/** Plays a moment on this piece, from your side of it. */
export function playMoment(id: string, side: Side): void {
  plays.set(id, { seq: (plays.get(id)?.seq ?? 0) + 1, side });
  listeners.notify();
}

/** This piece's latest moment, or null when it never played; changes only for this piece. */
export function usePieceMoment(id: string): PieceMomentPlay | null {
  return useSyncExternalStore(
    listeners.subscribe,
    () => plays.get(id) ?? null,
    () => null,
  );
}

/** Forgets every moment (tests). */
export function resetPieceMoments(): void {
  plays.clear();
}
