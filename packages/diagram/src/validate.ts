// Runtime structural validation for Element + Tab. The TypeScript types are
// compile-time only; this is the runtime guard for data crossing a trust
// boundary — chiefly the API worker accepting tabs / diagrams from
// (eventually untrusted, token-authenticated) callers, but reusable by AI
// ingest and import paths too. One source so the API and the app agree on
// "what a valid tab is".
//
// It validates STRUCTURE: the discriminant `type`, the required fields + their
// primitive types, the closed enums that actually matter (endpoint kind,
// anchor), and BOUNDS on every array so a single payload can't blow up memory
// or a downstream O(n) pass. It is intentionally LENIENT on cosmetic optionals
// (colours, text styling, animation, shape KIND): a bad value there is
// harmless — the renderer defaults / falls back — and pinning every field
// would be brittle against forward-compatible model additions. Pair this with
// the byte-size caps at the API layer (a structurally valid tab can still be
// too big).

import type { Element, ShapeKind, Tab } from './index';

// Bounds. Generous vs any real diagram, tight vs an abuse payload.
export const MAX_ELEMENTS_PER_TAB = 10_000;
export const MAX_FREEHAND_POINTS = 20_000;
const MAX_TABLE_ROWS = 1_000;
const MAX_TABLE_COLS = 1_000;
const MAX_TABLE_CELLS = 50_000;
const MAX_DATA_ARRAY = 5_000; // railLabels / lineCategories / pieSlices / lineSeries

// Exported so the MCP schema resource (spec/62 §4.5) lists the real element
// types + anchors rather than a hand-maintained copy that can drift.
export const ELEMENT_TYPES = new Set([
  'shape',
  'text',
  'table',
  'sticky',
  'image',
  'freehand',
  'annotation',
  'link-card',
  'arrow',
]);
export const ANCHORS = new Set(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']);

// Every valid ShapeKind, as a runtime set. The editor renders only these; an
// off-vocabulary kind (e.g. a model emitting "rectangle", which is NOT a kind —
// the rectangular box is "square") draws no box, so callers crossing a trust
// boundary (the MCP, AI ingest) coerce through `coerceShapeKind`. Keep in sync
// with the ShapeKind union in index.ts.
export const SHAPE_KINDS = new Set<string>([
  'square',
  'circle',
  'diamond',
  'cylinder',
  'parallelogram',
  'hexagon',
  'document',
  'stadium',
  'actor',
  'cloud',
  'triangle',
  'trapezoid',
  'star',
  'speech-bubble',
  'frame',
  'browser',
  'monitor',
  'laptop',
  'phone',
  'tablet',
  'smartwatch',
  'progress-bar',
  'progress-ring',
  'timeline-rail',
  'rating',
  'pie-chart',
  'bar-chart',
  'line-chart',
  'icon',
]);

// Map an arbitrary shape value to a real ShapeKind, defaulting an unknown /
// synonym kind ("rectangle", "box", "oval", …) to "square" so the node always
// renders a box instead of falling through to a bare label.
export function coerceShapeKind(shape: unknown): ShapeKind {
  return typeof shape === 'string' && SHAPE_KINDS.has(shape) ? (shape as ShapeKind) : 'square';
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isNonEmptyStr(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}
function boundedArray(v: unknown, max: number): v is unknown[] {
  return Array.isArray(v) && v.length <= max;
}

// A boxed element's geometry: finite x/y, non-negative finite width/height.
function hasValidBox(o: Record<string, unknown>): boolean {
  return (
    isNum(o.x) && isNum(o.y) && isNum(o.width) && o.width >= 0 && isNum(o.height) && o.height >= 0
  );
}

function isValidEndpoint(ep: unknown): boolean {
  if (!isObj(ep)) return false;
  if (ep.kind === 'free') return isNum(ep.x) && isNum(ep.y);
  if (ep.kind === 'pinned') return isNonEmptyStr(ep.elementId) && ANCHORS.has(ep.anchor as string);
  if (ep.kind === 'on-arrow') return isNonEmptyStr(ep.arrowId) && isNum(ep.t);
  if (ep.kind === 'pinned-group')
    return isNonEmptyStr(ep.groupId) && ANCHORS.has(ep.anchor as string);
  return false;
}

// Structural validity of a single element. Returns true for any element the
// renderer can safely handle; false for a missing/wrong discriminant, a
// missing required field, a malformed endpoint, or an over-cap array.
export function isValidElement(el: unknown): el is Element {
  if (!isObj(el) || !isNonEmptyStr(el.id)) return false;
  const t = el.type;
  if (typeof t !== 'string' || !ELEMENT_TYPES.has(t)) return false;

  if (t === 'arrow') {
    return isValidEndpoint(el.from) && isValidEndpoint(el.to);
  }

  // Every non-arrow element is a boxed element: it needs a valid box.
  if (!hasValidBox(el)) return false;

  if (t === 'shape') {
    if (!isNonEmptyStr(el.shape)) return false;
    // Bound the optional data arrays (charts / rail) if present.
    if (el.railLabels !== undefined && !boundedArray(el.railLabels, MAX_DATA_ARRAY)) return false;
    if (el.lineCategories !== undefined && !boundedArray(el.lineCategories, MAX_DATA_ARRAY))
      return false;
    if (el.pieSlices !== undefined && !boundedArray(el.pieSlices, MAX_DATA_ARRAY)) return false;
    if (el.lineSeries !== undefined && !boundedArray(el.lineSeries, MAX_DATA_ARRAY)) return false;
    return true;
  }
  if (t === 'table') {
    if (!boundedArray(el.cells, MAX_TABLE_ROWS)) return false;
    let total = 0;
    for (const row of el.cells) {
      if (!boundedArray(row, MAX_TABLE_COLS)) return false;
      total += row.length;
      if (total > MAX_TABLE_CELLS) return false;
      for (const c of row) if (typeof c !== 'string') return false;
    }
    return true;
  }
  if (t === 'image') {
    return el.imageId === null || typeof el.imageId === 'string';
  }
  if (t === 'freehand') {
    if (typeof el.closed !== 'boolean' || !boundedArray(el.points, MAX_FREEHAND_POINTS))
      return false;
    for (const p of el.points) if (!isObj(p) || !isNum(p.nx) || !isNum(p.ny)) return false;
    return true;
  }
  // text / sticky / annotation / link-card carry no extra required fields.
  return true;
}

// Structural validity of a tab: id + name + a bounded `elements` array of
// valid elements with unique ids (a duplicate id breaks selection + arrow
// references downstream, so it's rejected). Other tab fields (theme, font,
// background) are cosmetic and left unchecked.
export function isValidTab(tab: unknown): tab is Tab {
  if (!isObj(tab) || !isNonEmptyStr(tab.id) || typeof tab.name !== 'string') return false;
  if (!boundedArray(tab.elements, MAX_ELEMENTS_PER_TAB)) return false;
  const ids = new Set<string>();
  for (const el of tab.elements) {
    if (!isValidElement(el)) return false;
    if (ids.has(el.id)) return false;
    ids.add(el.id);
  }
  return true;
}
