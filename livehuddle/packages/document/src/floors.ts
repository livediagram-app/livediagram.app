// A Space's floor (docs/specs/011-theme/floors.md): livehuddle's canvas backdrops are floor surfaces you walk on, not
// the diagram papers (dot grid, graph paper, ruled lines) it forked from livediagram with. This module is the floor
// set and the one table that reads a retired diagram pattern as a floor; the editor draws them
// (apps/editor/lib/floor-tiles.ts).
import type { BackgroundPattern } from './background-pattern';
import type { SeasonalBackgroundPattern } from '@liveworkspace/model-core/basics';
import { isSeasonalPattern } from '@liveworkspace/model-core/basics';

/** The floors, indoor first, in the order the Canvas panel lists them after None. */
export const FLOOR_PATTERNS = [
  'carpet',
  'carpet-tiles',
  'wood',
  'parquet',
  'tiles',
  'marble',
  'terrazzo',
  'concrete',
  'deck',
  'paving',
  'cobbles',
  'grass',
  'sand',
  'mud',
] as const;

export type FloorPattern = (typeof FLOOR_PATTERNS)[number];

/** What a Space's canvas can wear: a floor, None (`blank`), or a seasonal look's motif. */
export type SpacePattern = FloorPattern | 'blank' | SeasonalBackgroundPattern;

/** Whether a pattern id is one of the floors. */
export function isFloorPattern(value: unknown): value is FloorPattern {
  return (FLOOR_PATTERNS as readonly unknown[]).includes(value);
}

/**
 * The retired diagram patterns, each read as the floor nearest it in feel (or None for the animated ones, which have
 * no floor). Every retired id is listed, so a tab saved with any of them opens on a floor. livediagram keeps them all
 * (docs/specs/002-project-scope/not-in-livehuddle.md "The diagram canvas patterns").
 */
export const RETIRED_PATTERN_FLOORS = {
  grid: 'carpet-tiles',
  graph: 'tiles',
  engineering: 'concrete',
  lines: 'wood',
  stripes: 'deck',
  crosshatch: 'carpet',
  diagonal: 'parquet',
  waves: 'sand',
  bricks: 'paving',
  checkerboard: 'marble',
  hexagonal: 'cobbles',
  isometric: 'tiles',
  confetti: 'terrazzo',
  flow: 'blank',
  drift: 'blank',
  aurora: 'blank',
  ripple: 'blank',
  ribbons: 'blank',
} as const satisfies Record<
  Exclude<BackgroundPattern, FloorPattern | 'blank' | SeasonalBackgroundPattern>,
  FloorPattern | 'blank'
>;

/** The floor (or None, or seasonal motif) a stored pattern draws as. An unset pattern reads as the theme's own grid
 *  always did, so it lands on that grid's floor. */
export function spacePattern(pattern: BackgroundPattern | undefined): SpacePattern {
  if (pattern === undefined) return RETIRED_PATTERN_FLOORS.grid;
  if (pattern === 'blank' || isFloorPattern(pattern)) return pattern;
  if (isSeasonalPattern(pattern)) return pattern as SeasonalBackgroundPattern;
  return (RETIRED_PATTERN_FLOORS as Record<string, FloorPattern | 'blank'>)[pattern] ?? 'blank';
}

/** A stored tab's pattern moved onto the floors (run by migrateStoredTab, ./stored-tab.ts). An unset pattern stays
 *  unset (the theme decides it), and a tab already on a floor comes back as it was. */
export function migrateRetiredPattern<T extends object>(tab: T): T {
  const stored = (tab as { backgroundPattern?: BackgroundPattern }).backgroundPattern;
  if (stored === undefined) return tab;
  const next = spacePattern(stored);
  return next === stored ? tab : { ...tab, backgroundPattern: next };
}
