// Runtime structural validation for Element + Tab. The TypeScript types are
// compile-time only; this is the runtime guard for data crossing a trust
// boundary — chiefly the API worker accepting tabs / documents from
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
// Value imports come from the data-shapes LEAF module (types only from
// './index'), keeping this module out of the index ⇄ factories cycle.
import { ALL_ANCHORS } from './arrow-types';
import { isPenColourName } from './pen-colours';
import { PAGE_HEADING_MAX } from './data-shapes';
import { isQuickSwatchSlot } from './quick-swatches';
import { isImageCredit } from './image-credit';
import { parseStrokePoints } from './stroke-points';
import { shapeValidationIssue } from './validate-shape';
import {
  FONT_WEIGHTS,
  isFontWeight,
  isTextCase,
  LETTER_SPACING_MAX,
  LETTER_SPACING_MIN,
  TEXT_ARC_MAX,
  TEXT_CASES,
} from './wordmark';
import {
  type ElementValidationIssue,
  type FieldCheck,
  boundedArray,
  firstFieldIssue,
  isBool,
  isNonEmptyStr,
  isNum,
  isObj,
  issue,
  oneOfRule,
} from './validate-primitives';

export type { ElementValidationIssue } from './validate-primitives';

// Bounds. Generous vs any real document, tight vs an abuse payload.
export const MAX_ELEMENTS_PER_TAB = 10_000;
// A path (docs/specs/023-draw-mode/path-tool.md): a drawn one rarely passes 50 nodes.
export const MAX_PATH_NODES = 5_000;
// A normalised path coordinate: handles may reach beyond the box, never absurdly far.
export const PATH_COORD_MAX = 1e6;
// A Shift-resized text box's scale on its label (docs/specs/023-draw-mode/draw-mode.md "Text boxes"):
// a 14 px label reads from 1.4 px to 560 px, past any real board, short of an abuse payload.
export const TEXT_SCALE_MIN = 0.1;
export const TEXT_SCALE_MAX = 40;
const isHeadingStr = (v: unknown) => typeof v === 'string' && v.length <= PAGE_HEADING_MAX;
const PATH_HANDLE_MODES = new Set(['corner', 'mirrored', 'aligned']);
const MAX_TABLE_ROWS = 1_000;
const MAX_TABLE_COLS = 1_000;
const MAX_TABLE_CELLS = 50_000;

// Exported so the MCP schema resource (docs/specs/015-api/mcp-server.md §4.5) lists the real element
// types + anchors rather than a hand-maintained copy that can drift.
export const ELEMENT_TYPES = new Set([
  'shape',
  'text',
  'table',
  'sticky',
  'image',
  'freehand',
  'path',
  'annotation',
  'link-card',
  'video',
  'arrow',
]);
export const ANCHORS = new Set<string>(ALL_ANCHORS);

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
  // Document element (docs/specs/009-elements/page-element.md): a paper-proportioned page you write
  // prose into. Named 'page' internally because the flowchart output symbol
  // above already owns 'document'.
  'page',
  // Mind node (docs/specs/009-elements/mind-node.md).
  'mind-node',
  // Lane (docs/specs/009-elements/lane.md).
  'lane',
  // Record (docs/specs/009-elements/entity.md).
  'entity',
  // The web components (docs/specs/009-elements/web-components-and-no-groups.md).
  'banner',
  'callout',
  'stat-row',
  'process',
  'site-header',
  // Mode button (docs/specs/009-elements/mode-button.md): a pressable pill that switches whoever clicks it
  // into a selection mode.
  'mode-button',
  // Portal (docs/specs/009-elements/portal-element.md): a portal to the portal it is paired with.
  'portal',
  // Session button (docs/specs/012-collaboration/session-button.md): starts a timer / vote / poll for the room.
  'session-button',
  // Reveal zone (docs/specs/009-elements/reveal-zone.md): a cover you click to see what is underneath.
  'reveal',
  // Picker (docs/specs/012-collaboration/picker.md): rolls a random person or option.
  'picker',
  // Reaction pad (docs/specs/009-elements/reaction-pad.md).
  'reaction-pad',
  // Comment pin (docs/specs/012-collaboration/comment-pin.md).
  'comment-pin',
  // Action panel (docs/specs/012-collaboration/action-panel.md).
  'action-card',
  // Done check (docs/specs/012-collaboration/done-check.md).
  'done-check',
  // Chair (docs/specs/009-elements/chair.md): an Avatar-mode character sits down in one.
  'chair',
  // The collaboration family (docs/specs/012-collaboration/estimate-card.md to docs/specs/012-collaboration/roll-call.md).
  'estimate',
  'temperature',
  'idea-box',
  'qa-board',
  'agenda',
  'decision',
  'roll-call',
  // Quiz (docs/specs/012-collaboration/quiz.md).
  'quiz',
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
  'foldable',
  'smartwatch',
  'progress-bar',
  'progress-ring',
  'timeline-rail',
  'rating',
  'pie-chart',
  'bar-chart',
  'line-chart',
  'code-block',
  'checklist',
  'legend',
  'focus-button',
  'icon',
  'sticker',
  // Plan board and Plan card (docs/specs/026-plan/plan-board.md).
  'plan-board',
  'plan-card',
  'plan-view',
  'plan-sheet',
]);

// Map an arbitrary shape value to a real ShapeKind, defaulting an unknown /
// synonym kind ("rectangle", "box", "oval", …) to "square" so the node always
// renders a box instead of falling through to a bare label.
export function coerceShapeKind(shape: unknown): ShapeKind {
  return typeof shape === 'string' && SHAPE_KINDS.has(shape) ? (shape as ShapeKind) : 'square';
}

// Every stored element carries an id and a known type, and any colour bindings it has are named.
const COMMON_FIELD_CHECKS: readonly FieldCheck[] = [
  // Quick-swatch bindings (docs/specs/008-canvas/quick-style-panel.md): a slot 1-6 or absent. A junk
  // slot has no business being written into a document, though the re-derive would ignore it.
  { field: 'strokeSwatch', valid: isQuickSwatchSlot, rule: 'a quick-swatch slot 1 to 6' },
  { field: 'fillSwatch', valid: isQuickSwatchSlot, rule: 'a quick-swatch slot 1 to 6' },
  { field: 'textSwatch', valid: isQuickSwatchSlot, rule: 'a quick-swatch slot 1 to 6' },
  // A marker's named colour, and a text's or label's stock colour
  // (docs/specs/023-draw-mode/draw-mode.md "The colour picker", "Imported and pasted content").
  { field: 'penColour', valid: isPenColourName, rule: 'a pen colour name' },
  { field: 'penTextColour', valid: isPenColourName, rule: 'a pen colour name' },
];

// An import's exact end and its own label width (docs/specs/008-canvas/arrow-anchors.md "Exact
// ends", arrow-labels.md "Width and wrapping").
const ARROW_FIELD_CHECKS: readonly FieldCheck[] = [
  { field: 'exactEnd', valid: isBool, rule: 'a boolean' },
  { field: 'labelMaxWidth', valid: (v) => isNum(v) && v > 0, rule: 'a finite number above 0' },
];

const PINNED_RULE = `a pinned end: an elementId and an anchor (${ALL_ANCHORS.join(' ')})`;

// The rule an arrow end breaks, or null when it is well formed.
function endpointRule(ep: unknown): string | null {
  if (!isObj(ep)) return 'an end: free { x, y }, pinned { elementId, anchor } or on-arrow';
  switch (ep.kind) {
    case 'free':
      return isNum(ep.x) && isNum(ep.y) ? null : 'a free end: finite x and y';
    case 'pinned':
      return isNonEmptyStr(ep.elementId) && ANCHORS.has(ep.anchor as string) ? null : PINNED_RULE;
    case 'on-arrow':
      return isNonEmptyStr(ep.arrowId) && isNum(ep.t) ? null : 'an on-arrow end: arrowId and t';
    // LEGACY (docs/specs/009-elements/web-components-and-no-groups.md): groups are gone and no
    // current code writes this, but a browser still running a pre-removal build can. Accepting it
    // keeps that save from failing; migrateLegacyGroups freezes it to a free end on the next read
    // (rowToTab / the offline store), so nothing downstream sees it.
    case 'pinned-group':
      return isNonEmptyStr(ep.groupId) && ANCHORS.has(ep.anchor as string)
        ? null
        : 'a pinned-group end: groupId and an anchor';
    default:
      return 'an end of kind free, pinned or on-arrow';
  }
}

function arrowIssue(el: Record<string, unknown>): ElementValidationIssue | null {
  const fieldIssue = firstFieldIssue(el, ARROW_FIELD_CHECKS);
  if (fieldIssue) return fieldIssue;
  for (const end of ['from', 'to'] as const) {
    const rule = endpointRule(el[end]);
    if (rule) return issue(end, rule);
  }
  return null;
}

// A boxed element's geometry: finite x/y, non-negative finite width/height.
function boxIssue(o: Record<string, unknown>): ElementValidationIssue | null {
  for (const field of ['x', 'y'] as const)
    if (!isNum(o[field])) return issue(field, 'a finite number');
  for (const field of ['width', 'height'] as const) {
    const v = o[field];
    if (!isNum(v) || v < 0) return issue(field, 'a finite number, 0 or more');
  }
  return null;
}

const CELLS_RULE =
  `rows of strings: at most ${MAX_TABLE_ROWS} rows of ${MAX_TABLE_COLS} cells, ` +
  `${MAX_TABLE_CELLS} cells in all`;

function tableIssue(el: Record<string, unknown>): ElementValidationIssue | null {
  if (!boundedArray(el.cells, MAX_TABLE_ROWS)) return issue('cells', CELLS_RULE);
  let total = 0;
  for (const row of el.cells) {
    if (!boundedArray(row, MAX_TABLE_COLS)) return issue('cells', CELLS_RULE);
    total += row.length;
    if (total > MAX_TABLE_CELLS) return issue('cells', CELLS_RULE);
    if (!row.every((c) => typeof c === 'string')) return issue('cells', CELLS_RULE);
  }
  return null;
}

const IMAGE_FIELD_CHECKS: readonly FieldCheck[] = [
  // Hero caption card (docs/specs/009-elements/web-components-and-no-groups.md): two bounded
  // single-line strings.
  {
    field: 'heroCaption',
    valid: (c) => isObj(c) && isHeadingStr(c.title) && isHeadingStr(c.subtitle),
    rule: `{ title, subtitle } of at most ${PAGE_HEADING_MAX} characters each`,
  },
  // Image search credit (docs/specs/009-elements/image-search.md).
  { field: 'credit', valid: isImageCredit, rule: 'an image credit' },
];

function imageIssue(el: Record<string, unknown>): ElementValidationIssue | null {
  if (el.imageId !== null && typeof el.imageId !== 'string')
    return issue('imageId', 'a string or null');
  return firstFieldIssue(el, IMAGE_FIELD_CHECKS);
}

// Optional pen recipe (docs/specs/008-canvas/highlighter.md) and straight-edge flag
// (docs/specs/008-canvas/polygon-tool.md).
const FREEHAND_FIELD_CHECKS: readonly FieldCheck[] = [
  { field: 'pen', valid: (v) => v === 'highlighter', rule: oneOfRule(['highlighter']) },
  {
    field: 'penWidth',
    valid: (v) => isNum(v) && v >= 1 && v <= 100,
    rule: 'a number from 1 to 100',
  },
  { field: 'straightEdges', valid: isBool, rule: 'a boolean' },
  {
    field: 'streamline',
    valid: (v) => isNum(v) && v >= 0 && v <= 1,
    rule: 'a number from 0 to 1',
  },
];

function freehandIssue(el: Record<string, unknown>): ElementValidationIssue | null {
  if (!isBool(el.closed)) return issue('closed', 'a boolean');
  // Packed points (docs/specs/006-document/stroke-points.md): the block must decode, and the
  // former fields never pass (every entry point migrates them first).
  if (!parseStrokePoints(el.packedPoints).ok)
    return issue('packedPoints', 'packed stroke points that decode');
  for (const former of ['points', 'pressures'] as const)
    if (former in el) return issue(former, 'not stored: strokes keep packedPoints');
  return firstFieldIssue(el, FREEHAND_FIELD_CHECKS);
}

// A text box's sizing and Shift scale (docs/specs/007-editor/editor-modes.md "A text box's sizing").
const TEXT_FIELD_CHECKS: readonly FieldCheck[] = [
  { field: 'sizing', valid: (v) => v === 'fit' || v === 'wrap', rule: oneOfRule(['fit', 'wrap']) },
  {
    field: 'textScale',
    valid: (v) => isNum(v) && v >= TEXT_SCALE_MIN && v <= TEXT_SCALE_MAX,
    rule: `a number from ${TEXT_SCALE_MIN} to ${TEXT_SCALE_MAX}`,
  },
  // Wordmark type (docs/specs/007-editor/logo-pages.md "Wordmark type").
  {
    field: 'letterSpacing',
    valid: (v) => isNum(v) && v >= LETTER_SPACING_MIN && v <= LETTER_SPACING_MAX,
    rule: `a number from ${LETTER_SPACING_MIN} to ${LETTER_SPACING_MAX}`,
  },
  { field: 'fontWeight', valid: isFontWeight, rule: oneOfRule(FONT_WEIGHTS.map(String)) },
  { field: 'textCase', valid: isTextCase, rule: oneOfRule([...TEXT_CASES]) },
  {
    field: 'textArc',
    valid: (v) => isNum(v) && Math.abs(v) <= TEXT_ARC_MAX,
    rule: `a number from -${TEXT_ARC_MAX} to ${TEXT_ARC_MAX}`,
  },
];

// A path's normalised coordinate pair: finite, and never absurdly far outside its box.
function isPathPoint(p: unknown): boolean {
  return (
    isObj(p) &&
    isNum(p.nx) &&
    isNum(p.ny) &&
    Math.abs(p.nx) <= PATH_COORD_MAX &&
    Math.abs(p.ny) <= PATH_COORD_MAX
  );
}

function isPathNode(n: unknown): boolean {
  if (!isPathPoint(n)) return false;
  const { mode, handleIn, handleOut } = n as Record<string, unknown>;
  return (
    PATH_HANDLE_MODES.has(mode as string) &&
    (handleIn === undefined || isPathPoint(handleIn)) &&
    (handleOut === undefined || isPathPoint(handleOut))
  );
}

// A path (docs/specs/023-draw-mode/path-tool.md "The path element"): 2 to MAX_PATH_NODES nodes of
// known mode with optional handles; a closed pair needs a handle to be more than a line.
function pathIssue(el: Record<string, unknown>): ElementValidationIssue | null {
  if (!isBool(el.closed)) return issue('closed', 'a boolean');
  const nodesRule = `2 to ${MAX_PATH_NODES} nodes { nx, ny, mode, handleIn?, handleOut? }`;
  if (!boundedArray(el.nodes, MAX_PATH_NODES) || el.nodes.length < 2)
    return issue('nodes', nodesRule);
  if (!el.nodes.every(isPathNode)) return issue('nodes', nodesRule);
  // A path's further contours (docs/specs/007-editor/logo-pages.md "Combine", "Mirror"): each
  // closed like the path (three nodes or more) or open (two or more), every contour's nodes within
  // the one budget.
  if (el.subpaths !== undefined) {
    const least = el.closed === true ? 3 : 2;
    const rule = `contours of ${least} or more nodes, ${MAX_PATH_NODES} nodes in all`;
    if (!Array.isArray(el.subpaths)) return issue('subpaths', rule);
    let total = el.nodes.length;
    for (const sub of el.subpaths) {
      if (!Array.isArray(sub) || sub.length < least || !sub.every(isPathNode))
        return issue('subpaths', rule);
      total += sub.length;
      if (total > MAX_PATH_NODES) return issue('subpaths', rule);
    }
  }
  const handles = el.nodes.some((n) => {
    const node = n as Record<string, unknown>;
    return node.handleIn !== undefined || node.handleOut !== undefined;
  });
  if (el.closed && el.nodes.length < 3 && !handles)
    return issue('nodes', 'a closed path needs 3 nodes, or a handle');
  return null;
}

function boxedIssue(el: Record<string, unknown>): ElementValidationIssue | null {
  const box = boxIssue(el);
  if (box) return box;
  switch (el.type) {
    case 'shape':
      return shapeValidationIssue(el);
    case 'table':
      return tableIssue(el);
    case 'image':
      return imageIssue(el);
    case 'freehand':
      return freehandIssue(el);
    case 'path':
      return pathIssue(el);
    case 'text':
      return firstFieldIssue(el, TEXT_FIELD_CHECKS);
    // sticky / annotation / link-card / video carry no extra required fields.
    default:
      return null;
  }
}

// The first structural problem of an element, naming the field and the rule it breaks; null for
// any element the renderer can safely handle (docs/specs/024-agents/blueprints/edit-operations.md
// "invalid_result").
export function elementValidationIssue(el: unknown): ElementValidationIssue | null {
  if (!isObj(el)) return issue('element', 'an object');
  if (!isNonEmptyStr(el.id)) return issue('id', 'a non-empty string');
  if (typeof el.type !== 'string' || !ELEMENT_TYPES.has(el.type))
    return issue('type', oneOfRule([...ELEMENT_TYPES]));
  return (
    firstFieldIssue(el, COMMON_FIELD_CHECKS) ?? (el.type === 'arrow' ? arrowIssue : boxedIssue)(el)
  );
}

// Structural validity of a single element: false for a missing or wrong discriminant, a missing
// required field, a malformed endpoint, or an over-cap array.
export function isValidElement(el: unknown): el is Element {
  return elementValidationIssue(el) === null;
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
