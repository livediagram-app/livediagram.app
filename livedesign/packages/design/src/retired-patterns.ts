// The background patterns this product no longer offers (docs/specs/008-canvas/canvas-and-palette.md "Retired
// features"), bound to @liveworkspace/model-core's retired-pattern helper: livediagram keeps them, so they stay in the
// shared BackgroundPattern, and this product's own BackgroundPattern leaves them out. A stored tab that wears one moves
// onto its replacement on read (./stored-tab), so it opens and draws.
import type { BackgroundPattern as AnyBackgroundPattern } from '@liveworkspace/model-core/basics';
import { bindRetiredPatterns } from '@liveworkspace/model-core/retired-patterns';

// The Isometric pattern (retired 2026-10-25) draws as Crosshatch: its nearest remaining pattern, a lattice of
// diagonal lines in the same colour, so a tab keeps the look of line paper rather than turning to dots.
export const RETIRED_PATTERNS = { isometric: 'crosshatch' } as const;

// Every shared pattern but the retired ones.
/** A tab's canvas background pattern. */
export type BackgroundPattern = Exclude<AnyBackgroundPattern, keyof typeof RETIRED_PATTERNS>;

const retired = bindRetiredPatterns(RETIRED_PATTERNS);

/** Whether a value is a background pattern this product offers (a retired one is not). */
export const isBackgroundPattern = retired.isOffered;

/** A stored tab moved off a retired pattern onto its replacement; the same tab when it wears none. */
export const migrateRetiredPattern = retired.migrate;
