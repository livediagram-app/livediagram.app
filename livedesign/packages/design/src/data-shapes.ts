// The self-drawing "data" shape family (progress docs/specs/009-elements/progress.md, rating docs/specs/009-elements/rating.md, pie / bar / line charts docs/specs/009-elements/pie-chart.md): kind
// predicates, bounds, default data, animation sets, and the shared
// clamps. Split out of index.ts as a LEAF module (it imports only types)
// because factories.ts needs these constants at module-init time —
// importing them from './index' put a runtime read inside the
// index ⇄ factories cycle, which crashes plain-Node ESM consumers with
// "Cannot access 'RATING_DEFAULT' before initialization" (the
// product bundlers happen to evaluate the cycle in a survivable order;
// a third-party script doesn't). Everything here is re-exported from
// './index', so the public package surface is unchanged.

import type { ShapeKind } from './index';
import { isSankeyShape } from './sankey-model';

// The two progress ShapeKinds, grouped so renderers + context-menu gates can
// branch on "is this a progress element" without repeating the literal pair.
export function isProgressShape(kind: ShapeKind): boolean {
  return kind === 'progress-bar' || kind === 'progress-ring';
}

// The Timeline (docs/specs/009-elements/concept-graphics.md "Timeline"), a concept graphic since it outgrew the rail;
// it keeps the kind, so every saved one opens.
export function isRailShape(kind: ShapeKind): boolean {
  return kind === 'timeline-rail';
}

// Rating element (docs/specs/009-elements/rating.md): a row of stars showing a 1..RATING_MAX score.
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

// Pie chart (docs/specs/009-elements/pie-chart.md). A slice is one labelled datum; `color` overrides the
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

// Line chart (docs/specs/009-elements/pie-chart.md). Unlike the pie / bar single row of data, a line chart
// is 2-D: shared x-axis `lineCategories` (e.g. months) and one or more
// `lineSeries`, each a named line with a value per category (+ an optional
// colour override). Editable as a grid and importable from CSV. Reuses the
// shared `pieAnim` / `chartLegend` fields. The legend lists series names.
// `axis: 'right'` draws the series against a scale of its own, the chart's second axis (pie-chart.md "A second axis").
export type LineSeries = { name: string; color?: string; values: number[]; axis?: 'right' };
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

// Code block (docs/specs/009-elements/code-block.md): a monospace snippet card. The closed language set the
// lazy tokenizer understands; 'plain' renders unhighlighted. Wire-validated so
// a saved design can't smuggle an arbitrary string into the renderer.
export const CODE_LANGUAGES = [
  'plain',
  'ts',
  'js',
  'python',
  'json',
  'bash',
  'sql',
  'html',
  'css',
  'yaml',
] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
export const CODE_MAX_LENGTH = 4000;

export function isCodeBlockShape(kind: ShapeKind): boolean {
  return kind === 'code-block';
}

// Checklist (docs/specs/009-elements/checklist.md): checkable to-do rows. Bounds keep the card legible and
// the wire payload small; the starter rows make the affordance obvious on drop.
export type ChecklistItem = { text: string; done: boolean };
export const CHECKLIST_MAX_ITEMS = 30;

// Page masthead (docs/specs/009-elements/page-element.md). A title line, not a paragraph — the renderer
// clamps it to one line anyway, so anything longer is a paste accident.
export const PAGE_HEADING_MAX = 200;

export const CHECKLIST_MAX_TEXT = 200;
// All three seed rows are unchecked, per docs/specs/009-elements/checklist.md. A seeded `done: true` made
// a freshly-dropped checklist render its first row ticked and struck through,
// and tripped the "at least one row is done" rule into showing a "1/3" footer
// on an element nobody had touched yet.
export const CHECKLIST_DEFAULT_ITEMS: readonly ChecklistItem[] = [
  { text: 'First task', done: false },
  { text: 'Second task', done: false },
  { text: 'Third task', done: false },
];

export function isChecklistShape(kind: ShapeKind): boolean {
  return kind === 'checklist';
}

// Legend (docs/specs/009-elements/pie-chart.md). A card of colour-coded rows: a swatch and a label, and
// nothing else. It is a KEY, not a chart, so it carries no values and no
// geometry to argue about.
//
// A row's colour is optional and falls back to the chart palette by index, so
// a legend dropped beside a chart already matches it, and adding a row picks
// up the next colour rather than leaving a blank swatch to go and fill in.
export type LegendItem = { label: string; color?: string };
export const LEGEND_MAX_ITEMS = 40;
export const LEGEND_MAX_TEXT = 120;
export const LEGEND_DEFAULT_ITEMS: readonly LegendItem[] = [
  { label: 'First' },
  { label: 'Second' },
  { label: 'Third' },
];

export function isLegendShape(kind: ShapeKind): boolean {
  return kind === 'legend';
}

// Pie + bar + line are the "Data" charts: they share the slice animation
// (`pieAnim`), the legend toggle (`chartLegend`), and the Data / Chart /
// Animation context-menu categories. Pie + bar share the 1-D `pieSlices`; the
// line chart carries its own 2-D `lineCategories` + `lineSeries` instead. The
// `pie*` field names are kept (not renamed to `chart*`) so saved designs
// round-trip without a migration.
export function isChartShape(kind: ShapeKind): boolean {
  return isPieShape(kind) || isBarShape(kind) || isLineShape(kind);
}

// The kinds whose Presets grid is a chart palette (docs/specs/009-elements/pie-chart.md "Chart palettes"):
// the charts, and the Sankey diagram (docs/specs/009-elements/sankey.md), whose nodes take the same ladder.
// Both colour per datum or per node, so a fill-and-border look has nothing to set on them.
export function takesChartPalette(kind: ShapeKind): boolean {
  return isChartShape(kind) || isSankeyShape(kind);
}

// The "self-drawing" shape kinds: progress (bar / ring), timeline rail, rating,
// the data charts, the code block, the checklist, and the sticker. They render
// their own bespoke content (no fill/border box) and carry no editable text
// label, so the editor suppresses markers, text alignment, the inline label
// editor, morphing, and double-click / type-to-edit for them.
//
// The sticker (docs/specs/010-palette/stickers.md) is here for the label half specifically: it says what
// it says in its own artwork, so there is nothing to type into it — a caption
// under a die-cut sticker is exactly the icon treatment it exists not to be.
//
// So are the two web components with no label (docs/specs/009-elements/web-components-and-no-groups.md): a stat row's and a
// process's text is their rows, each edited in place, and there is no title to
// type into. The banner, callout and header DO carry a label and are not here.
export function isSelfDrawingShape(kind: ShapeKind): boolean {
  return (
    // A tab window (docs/specs/009-elements/tab-window.md) draws another tab; it takes no label.
    kind === 'tab-window' ||
    kind === 'stat-row' ||
    kind === 'process' ||
    isProgressShape(kind) ||
    isRailShape(kind) ||
    isRatingShape(kind) ||
    isChartShape(kind) ||
    isCodeBlockShape(kind) ||
    isChecklistShape(kind) ||
    isLegendShape(kind) ||
    isSankeyShape(kind) ||
    kind === 'sticker' ||
    // A layer stack, a pyramid, an onion and a chevron process draw all their own text
    // (docs/specs/009-elements/concept-graphics.md); a cycle and a hub keep their label, the words at the centre.
    kind === 'layer-stack' ||
    kind === 'pyramid' ||
    kind === 'onion' ||
    kind === 'chevrons'
  );
}

// Round to a whole number and clamp into [0, max]. The fiddly half of the
// clamp-and-round idiom (min/max order, the round) lives here so clampRating
// can't drift.
function clampRound(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

// Clamp to a whole 0..RATING_MAX star count.
export function clampRating(value: number): number {
  return clampRound(value, RATING_MAX);
}

// A whole 0–100 percentage, shared with every product's progress elements and liveplanner's Percent fields
// (@liveworkspace/model-core/progress-label), so the clamp-and-round can't drift.
export { clampPercent } from '@liveworkspace/model-core/progress-label';
