// Which of a piece's own parts move in its moment (docs/specs/009-elements/piece-moments.md, the blueprint's
// "Presentation and UX"): the books on a shelf, a cupboard door, a bike's spokes. Each names a part by its index in the
// piece's front drawing (OFFICE_ART, the only drawing a moment moves), the motion (a class in
// app/piece-moments-office.css) and how it plays. Pure data, plus the style it turns into; piece-moment-motions.test.ts
// holds every index against the art, so a change to a drawing fails a test rather than moving the wrong part.

import type { CSSProperties } from 'react';
import { swaysOnMoment, type MomentKind, type Side } from './piece-moments';

export type PartMotionName =
  'hop' | 'swing' | 'ajar' | 'roll' | 'jostle' | 'shoot' | 'shuffle' | 'wink' | 'whirl' | 'jiggle';

export type PartMotion = {
  /** The part's index in the kind's front drawing. */
  part: number;
  motion: PartMotionName;
  /** Seconds before it starts. */
  delay?: number;
  /** A wave: the part's x in the drawing, so the delay grows away from your side, up to WAVE_S across the drawing. */
  wave?: number;
  /** The point it turns or scales about, in the drawing's grid; else its own middle (its base for a hop). */
  pivot?: readonly [number, number];
  /** Only when you are on this side: the nearest of two (a cupboard door, a bike). */
  side?: Side;
  /** Its own custom properties (--up, --swing, --dx ...). */
  vars?: Readonly<Record<string, string>>;
};

/** How long a wave takes to cross a drawing, in seconds. */
export const WAVE_S = 0.45;

// The books of the Bookshelf's middle and bottom shelves, at their x, tipping one way then the other.
const BOOKS: readonly (readonly [number, number])[] = [
  [13, 14],
  [14, 22],
  [15, 32],
  [16, 39],
  [17, 58],
  [18, 66],
  [19, 77],
  [20, 85],
  [21, 94],
  [23, 14],
  [24, 24],
  [25, 31],
  [26, 50],
  [27, 58],
  [28, 69],
  [29, 77],
  [30, 86],
  [31, 95],
];

const swingAll = (
  parts: readonly number[],
  pivot: readonly [number, number],
  swing: string,
  extra: Partial<PartMotion> = {},
): PartMotion[] =>
  parts.map((part) => ({ part, motion: 'swing', pivot, vars: { '--swing': swing }, ...extra }));

// An umbrella in its stand: a quicker, wider swing than a coat's.
const QUICK_SWING = { '--swing': '6deg', '--dur': '0.9s' };

export const PART_MOTIONS: Partial<Record<MomentKind, readonly PartMotion[]>> = {
  bookshelf: BOOKS.map(([part, x], i) => ({
    part,
    motion: 'hop',
    wave: x,
    delay: part > 22 ? 0.12 : 0,
    vars: { '--up': '-3px', '--tip': i % 2 ? '-4deg' : '4deg' },
  })),
  bar: [
    { part: 72, motion: 'hop', wave: 50, vars: { '--up': '-4px', '--tip': '0deg' } },
    { part: 73, motion: 'hop', wave: 153, vars: { '--up': '-4px', '--tip': '0deg' } },
    { part: 74, motion: 'hop', wave: 188, vars: { '--up': '-4px', '--tip': '0deg' } },
  ],
  // The canopy, its fringe and its finial, on the pole's top.
  'garden-umbrella': swingAll([3, 4, 5, 6, 7, 8, 9], [60, 40], '4deg'),
  'pool-table': [
    { part: 17, motion: 'roll', vars: { '--dx': '63px', '--back': '50px' } },
    ...(
      [
        [11, 1.5, 0],
        [12, 2, -1.5],
        [13, 2, 1.5],
        [14, 2.5, -2.5],
        [15, 3, 0],
        [16, 2.5, 2.5],
      ] as const
    ).map(([part, dx, dy]): PartMotion => ({
      part,
      motion: 'jostle',
      delay: 0.5,
      vars: { '--dx': `${dx}px`, '--dy': `${dy}px` },
    })),
  ],
  // The ball into the goal away from you; the red and blue figures sliding on their rods.
  'foosball-table': [
    { part: 8, motion: 'shoot', side: -1, vars: { '--dx': '66px' } },
    { part: 8, motion: 'shoot', side: 1, vars: { '--dx': '-66px' } },
    { part: 11, motion: 'shuffle', delay: 0.05 },
    { part: 12, motion: 'shuffle', delay: 0.15 },
  ],
  // The paper stack dips as it feeds; the light winks.
  printer: [
    { part: 5, motion: 'hop', vars: { '--up': '1.5px', '--tip': '0deg' } },
    { part: 6, motion: 'hop', vars: { '--up': '1.5px', '--tip': '0deg' } },
    { part: 12, motion: 'wink', delay: 0.2 },
  ],
  copier: [
    { part: 19, motion: 'wink', delay: 0.1 },
    { part: 20, motion: 'wink', delay: 0.2 },
  ],
  // The coats and the scarf on their hooks; the hat hops.
  'coat-rack': [
    ...swingAll([4, 5, 6, 7, 8, 9], [28, 22], '4deg'),
    { part: 10, motion: 'hop', delay: 0.1, vars: { '--up': '-2px', '--tip': '0deg' } },
    { part: 11, motion: 'hop', delay: 0.1, vars: { '--up': '-2px', '--tip': '0deg' } },
  ],
  // Each umbrella and its handle on its foot, in a wave.
  'umbrella-stand': [
    ...swingAll([1, 2], [15, 36], '6deg', { wave: 10, vars: QUICK_SWING }),
    ...swingAll([3, 4], [20, 36], '6deg', { wave: 20, vars: QUICK_SWING }),
    ...swingAll([5, 6], [25, 36], '6deg', { wave: 30, vars: QUICK_SWING }),
  ],
  // The cupboard door nearest you, its panel line and its handle, on its hinge.
  'kitchen-counter': [
    ...[10, 11, 12].map((part): PartMotion => ({ part, motion: 'ajar', pivot: [4, 60], side: -1 })),
    ...[13, 14, 15].map((part): PartMotion => ({
      part,
      motion: 'ajar',
      pivot: [108, 60],
      side: 1,
    })),
  ],
  // The tea towel on the cupboard door.
  'kitchen-sink': swingAll([18, 19], [78, 33], '5deg'),
  // The photo and the note on their magnets.
  fridge: [
    ...swingAll([7, 8, 9, 10, 11], [27, 62], '5deg'),
    ...swingAll([12, 13, 14], [22, 95], '6deg', { delay: 0.12 }),
  ],
  microwave: [{ part: 6, motion: 'wink', delay: 0.9 }],
  kettle: [{ part: 5, motion: 'jiggle' }],
  'toilet-cubicle': [{ part: 4, motion: 'hop', vars: { '--up': '1px', '--tip': '0deg' } }],
  'hand-dryer': [{ part: 4, motion: 'wink' }],
  // The nearest bike's front-wheel spokes.
  'bike-rack': [
    { part: 11, motion: 'whirl', side: -1 },
    { part: 24, motion: 'whirl', side: 1 },
  ],
  // Each drape, with its tie-back and tassel, from the rail.
  'stage-curtains': [
    ...swingAll([0, 1, 2, 3, 4, 5], [34, 6], '2deg'),
    ...swingAll([6, 7, 8, 9, 10, 11], [326, 6], '2deg', { delay: 0.1 }),
  ],
  podium: [
    { part: 11, motion: 'jiggle' },
    { part: 12, motion: 'wink', delay: 0.15 },
  ],
};

/** The parts this kind moves in its moment. */
export function partMotionsOf(kind: string): readonly PartMotion[] {
  return PART_MOTIONS[kind as MomentKind] ?? [];
}

/** A wave's delay at `x` across a drawing `width` wide: none at your end, WAVE_S at the far one. */
export function waveDelay(x: number, side: Side, width: number): number {
  return (WAVE_S * (side < 0 ? x : width - x)) / width;
}

/** The custom properties and pivot of one part's motion, for you on `side` of a drawing `width` wide. */
export function partMotionStyle(m: PartMotion, side: Side, width: number): CSSProperties {
  const wave = m.wave === undefined ? 0 : waveDelay(m.wave, side, width);
  const style: Record<string, string> = {
    ...m.vars,
    '--delay': `${Math.round(((m.delay ?? 0) + wave) * 1000) / 1000}s`,
  };
  if (m.pivot) {
    style.transformBox = 'view-box';
    style.transformOrigin = `${m.pivot[0]}px ${m.pivot[1]}px`;
  }
  return style;
}

// The kinds whose moment is only their own parts moving: nothing is drawn over them.
const MOVES_ONLY: ReadonlySet<string> = new Set([
  'bookshelf',
  'pool-table',
  'coat-rack',
  'kitchen-counter',
  'stage-curtains',
]);

/** Whether this kind's moment draws anything over its art (PieceMoment). */
export function drawsOverMoment(kind: string): boolean {
  return !MOVES_ONLY.has(kind);
}

export type WholeMotion = 'sway' | 'rustle' | 'thunk' | 'rattle' | 'hum' | 'nudge';

/**
 * How the whole drawing moves: a tree's sway and a plant's rustle at every facing; on the front, a dartboard's thunk,
 * the lockers' rattle and a hand dryer's hum; turned, every other piece's nudge (its moment is drawn on the front).
 */
export function wholeMotionOf(kind: MomentKind, front: boolean): WholeMotion | null {
  if (swaysOnMoment(kind)) return kind === 'tree' ? 'sway' : 'rustle';
  if (!front) return 'nudge';
  if (kind === 'dartboard') return 'thunk';
  if (kind === 'lockers') return 'rattle';
  if (kind === 'hand-dryer') return 'hum';
  return null;
}
