// Piece moments (docs/specs/009-elements/piece-moments.md): the small surprises a still piece plays, now and then,
// when your character walks right up to it. Which pieces have one, the strip your feet must step into, the trigger
// that decides (pure: chance, the third-time rule and the rests), and the store a piece's view reads, keyed by piece,
// so a moment re-renders only the piece it plays on.

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
] as const;
export type MomentKind = (typeof MOMENT_KINDS)[number];

const KIND_SET: ReadonlySet<string> = new Set(MOMENT_KINDS);

/** Whether a piece of this kind plays a moment. */
export function hasMoment(kind: string): kind is MomentKind {
  return KIND_SET.has(kind);
}

/** The kinds whose whole drawing rocks in their moment. */
export const SWAY_KINDS = ['tree', 'outdoor-plant', 'plant'] as const;
export type SwayKind = (typeof SWAY_KINDS)[number];

export function swaysOnMoment(kind: string): kind is SwayKind {
  return kind === 'tree' || kind === 'outdoor-plant' || kind === 'plant';
}

/** How near the piece's base your feet must come: the Arcade Machine's reach. */
export const MOMENT_REACH = 24;
/** One arrival in two plays. */
export const MOMENT_CHANCE = 0.5;
/** After this many refusals in a row, the next arrival plays. */
export const MOMENT_MAX_MISSES = 2;
/** One piece asks at most once in this long. */
export const MOMENT_PIECE_REST_MS = 20_000;
/** No moment within this long of the last one, anywhere on the tab. */
export const MOMENT_GAP_MS = 4_000;
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
};

export type Side = -1 | 1;
type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };
export type MomentPiece = Box & { id: string; kind: MomentKind };

/**
 * Whether `p` stands in this piece's reach: its box from MOMENT_TOP of its height down, widened by MOMENT_REACH each
 * side and below (and above, for what lies flat). Checked on every step, so it builds nothing.
 */
export function inMomentReach(p: Point, piece: MomentPiece): boolean {
  const top = MOMENT_TOP[piece.kind];
  const y0 = piece.y + piece.height * top - (top === 0 ? MOMENT_REACH : 0);
  return (
    p.x >= piece.x - MOMENT_REACH &&
    p.x <= piece.x + piece.width + MOMENT_REACH &&
    p.y >= y0 &&
    p.y <= piece.y + piece.height + MOMENT_REACH
  );
}

export type MomentTrigger = {
  /** One step of your feet: the piece whose moment plays now, and the side you came from, or null. */
  step(feet: Point, pieces: readonly MomentPiece[]): { id: string; side: Side } | null;
  /** You left Avatar mode or the board: the next step into a reach is an arrival again. */
  reset(): void;
};

export function createMomentTrigger({
  random = Math.random,
  now = Date.now,
}: { random?: () => number; now?: () => number } = {}): MomentTrigger {
  // The pieces whose reach held your feet last step: a handful at most, so leaving is checked over these alone and
  // the walk over every piece is one box test each, with no Set or Map traffic while you are near nothing.
  const near = new Map<string, MomentPiece>();
  const lastAsk = new Map<string, number>();
  const misses = new Map<string, number>();
  let lastPlay = -Infinity;
  return {
    step(feet, pieces) {
      for (const [id, piece] of near) if (!inMomentReach(feet, piece)) near.delete(id);
      let arrived: MomentPiece | null = null;
      for (const piece of pieces) {
        if (!inMomentReach(feet, piece) || near.has(piece.id)) continue;
        near.set(piece.id, piece);
        arrived ??= piece;
      }
      if (!arrived) return null;
      const t = now();
      const asked = lastAsk.get(arrived.id);
      if ((asked !== undefined && t - asked < MOMENT_PIECE_REST_MS) || t - lastPlay < MOMENT_GAP_MS)
        return null;
      lastAsk.set(arrived.id, t);
      const missed = misses.get(arrived.id) ?? 0;
      if (missed < MOMENT_MAX_MISSES && random() >= MOMENT_CHANCE) {
        misses.set(arrived.id, missed + 1);
        return null;
      }
      misses.set(arrived.id, 0);
      lastPlay = t;
      return { id: arrived.id, side: feet.x < arrived.x + arrived.width / 2 ? -1 : 1 };
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
