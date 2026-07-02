// The self-drawing "data" shape family (progress spec/46, timeline rail
// spec/51, rating spec/52, pie / bar / line charts spec/53): kind
// predicates, bounds, default data, animation sets, and the shared
// clamps. Split out of index.ts as a LEAF module (it imports only types)
// because factories.ts needs these constants at module-init time —
// importing them from './index' put a runtime read inside the
// index ⇄ factories cycle, which crashes plain-Node ESM consumers with
// "Cannot access 'RAIL_DEFAULT_POINTS' before initialization" (the
// product bundlers happen to evaluate the cycle in a survivable order;
// a self-hoster's script doesn't). Everything here is re-exported from
// './index', so the public package surface is unchanged.

import type { ShapeKind } from './index';

// The two progress ShapeKinds, grouped so renderers + context-menu gates can
// branch on "is this a progress element" without repeating the literal pair.
export function isProgressShape(kind: ShapeKind): boolean {
  return kind === 'progress-bar' || kind === 'progress-ring';
}

// Timeline-rail bounds: a rail always has at least 2 points, and the canvas
// affordance caps additions so the element stays legible (spec/51).
export const RAIL_MIN_POINTS = 2;
export const RAIL_MAX_POINTS = 12;
export const RAIL_DEFAULT_POINTS = 3;
// Canvas px the rail widens by per added point, so spacing stays constant as
// points are appended at the right end.
export const RAIL_POINT_STEP_PX = 120;

export function isRailShape(kind: ShapeKind): boolean {
  return kind === 'timeline-rail';
}

// Rating element (spec/52): a row of stars showing a 1..RATING_MAX score.
// `ratingAnim` animates the filled stars — 'pop' pops them in one-by-one,
// 'twinkle' sparkles them, 'pulse' breathes their opacity, 'rock' tips them.
// Undefined = static. Mapped to `lvd-rating-*` classes by RatingView.
export const RATING_MAX = 5;
export const RATING_DEFAULT = 3;
export type RatingAnim = 'pop' | 'twinkle' | 'pulse' | 'rock';
export const RATING_ANIMS: readonly RatingAnim[] = ['pop', 'twinkle', 'pulse', 'rock'];
// 'pop' / 'rock' play once; 'twinkle' / 'pulse' loop (see animLoops).
export const RATING_LOOPING_ANIMS: readonly RatingAnim[] = ['twinkle', 'pulse'];

export function isRatingShape(kind: ShapeKind): boolean {
  return kind === 'rating';
}

// Pie chart (spec/53). A slice is one labelled datum; `color` overrides the
// default categorical palette when set. `pieAnim` animates the slices —
// 'grow' sweeps them in, 'pop' scales them in, 'spin' rotates the whole pie,
// 'pulse' breathes their opacity. Undefined = static. Mapped to `lvd-pie-*`
// by PieChartView. The first of the chart family, so the anim set is its own.
export type PieSlice = { label: string; value: number; color?: string };
export type PieAnim = 'grow' | 'pop' | 'spin' | 'pulse';
export const PIE_ANIMS: readonly PieAnim[] = ['grow', 'pop', 'spin', 'pulse'];
// 'grow' / 'pop' play once; 'spin' / 'pulse' loop (see animLoops).
export const PIE_LOOPING_ANIMS: readonly PieAnim[] = ['spin', 'pulse'];
// Default categorical palette for slices without an explicit colour.
export const PIE_PALETTE: readonly string[] = [
  '#0ea5e9',
  '#f59e0b',
  '#22c55e',
  '#ef4444',
  '#a855f7',
  '#14b8a6',
  '#ec4899',
  '#84cc16',
];
export const PIE_DEFAULT_SLICES: readonly PieSlice[] = [
  { label: 'A', value: 40 },
  { label: 'B', value: 30 },
  { label: 'C', value: 20 },
];

// Line chart (spec/53). Unlike the pie / bar single row of data, a line chart
// is 2-D: shared x-axis `lineCategories` (e.g. months) and one or more
// `lineSeries`, each a named line with a value per category (+ an optional
// colour override). Editable as a grid and importable from CSV. Reuses the
// shared `pieAnim` / `chartLegend` fields. The legend lists series names.
export type LineSeries = { name: string; color?: string; values: number[] };
export const LINE_DEFAULT_CATEGORIES: readonly string[] = ['Jan', 'Feb', 'Mar', 'Apr'];
export const LINE_DEFAULT_SERIES: readonly LineSeries[] = [
  { name: 'Series 1', values: [10, 25, 18, 32] },
  { name: 'Series 2', values: [5, 12, 22, 16] },
];

export function isPieShape(kind: ShapeKind): boolean {
  return kind === 'pie-chart';
}

export function isBarShape(kind: ShapeKind): boolean {
  return kind === 'bar-chart';
}

export function isLineShape(kind: ShapeKind): boolean {
  return kind === 'line-chart';
}

// Pie + bar + line are the "Data" charts: they share the slice animation
// (`pieAnim`), the legend toggle (`chartLegend`), and the Data / Chart /
// Animation context-menu categories. Pie + bar share the 1-D `pieSlices`; the
// line chart carries its own 2-D `lineCategories` + `lineSeries` instead. The
// `pie*` field names are kept (not renamed to `chart*`) so saved diagrams
// round-trip without a migration.
export function isChartShape(kind: ShapeKind): boolean {
  return isPieShape(kind) || isBarShape(kind) || isLineShape(kind);
}

// The "self-drawing" shape kinds: progress (bar / ring), timeline rail, rating,
// and the data charts. They render their own bespoke content (no fill/border
// box) and carry no editable text label, so the editor suppresses markers, the
// inline label editor, and double-click / type-to-edit for them.
export function isSelfDrawingShape(kind: ShapeKind): boolean {
  return isProgressShape(kind) || isRailShape(kind) || isRatingShape(kind) || isChartShape(kind);
}

// Round to a whole number and clamp into [0, max]. The fiddly half of the
// clamp-and-round idiom (min/max order, the round) lives here so clampRating /
// clampPercent can't drift apart.
function clampRound(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

// Clamp to a whole 0..RATING_MAX star count.
export function clampRating(value: number): number {
  return clampRound(value, RATING_MAX);
}

// Round a value to a whole 0–100 percentage. Shared by the progress setter,
// the context-menu slider, and ProgressView so the clamp-and-round can't drift
// (default applied by the caller before clamping).
export function clampPercent(value: number): number {
  return clampRound(value, 100);
}
