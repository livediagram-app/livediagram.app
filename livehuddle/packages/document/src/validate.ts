// Runtime structural validation for Element + Tab. The TypeScript types are
// compile-time only; this is the runtime guard for data crossing a trust
// boundary — chiefly the API worker accepting tabs / documents from
// (eventually untrusted, token-authenticated) callers, but reusable by AI
// ingest and import paths too. One source so the API and the app agree on
// "what a valid tab is".
//
// It validates STRUCTURE: the discriminant `type`, the required fields + their
// primitive types, the closed enums that actually matter (a stored arrow's
// endpoint kind and anchor), and BOUNDS on every array so a single payload can't blow up memory
// or a downstream O(n) pass. It is intentionally LENIENT on cosmetic optionals
// (colours, text styling, animation, shape KIND): a bad value there is
// harmless — the renderer defaults / falls back — and pinning every field
// would be brittle against forward-compatible model additions. Pair this with
// the byte-size caps at the API layer (a structurally valid tab can still be
// too big).

import type { Element, ShapeKind, Tab } from './index';
// Value imports come from the data-shapes LEAF module (types only from
// './index'), keeping this module out of the index ⇄ factories cycle.
import { ANCHOR_FRACTIONS } from './retired-arrow';
import { isPenColourName } from './pen-colours';
import { ADDER_KEY_LENGTH } from '@liveworkspace/model-core/adder';
import { isQuickSwatchSlot } from './quick-swatches';
import { isImageCredit } from './image-credit';
import { ELEMENT_KEY_FIELDS, ELEMENT_KEY_MAX, isElementKey } from './malformed-ids';
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
  isNonEmptyStr,
  isNum,
  issue,
  oneOfRule,
} from '@liveworkspace/model-core/validate-primitives';
import { isRecord } from '@liveworkspace/model-core/is-record';
import { SHAPE_KINDS } from './shape-kinds';
import { RETIRED_ELEMENT_TYPES } from './retired-kinds';

export type { ElementValidationIssue } from '@liveworkspace/model-core/validate-primitives';

// Bounds. Generous vs any real document, tight vs an abuse payload.
export const MAX_ELEMENTS_PER_TAB = 10_000;
// A Shift-resized text box's scale on its label (docs/specs/023-draw-mode/draw-mode.md "Text boxes"):
// a 14 px label reads from 1.4 px to 560 px, past any real board, short of an abuse payload.
export const TEXT_SCALE_MIN = 0.1;
export const TEXT_SCALE_MAX = 40;

// Exported so the MCP schema resource (livediagram/docs/specs/015-api/mcp-server.md §4.5) lists the real element
// types + anchors rather than a hand-maintained copy that can drift.
export const ELEMENT_TYPES = new Set([
  'shape',
  'text',
  'sticky',
  'image',
  'link-card',
  // The retired element types (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine"): a stored one
  // still loads, checked on its box alone (a video, table, stroke, path or annotation), or on its two ends (an
  // arrow, which has no box).
  ...RETIRED_ELEMENT_TYPES,
  'arrow',
]);
export const ANCHORS = new Set<string>(Object.keys(ANCHOR_FRACTIONS));

// Every valid ShapeKind, as a runtime set (./shape-kinds, a leaf module so the kind predicates can read it).
export { SHAPE_KINDS };

// Every stored element carries an id and a known type, and any colour bindings it has are named.
const COMMON_FIELD_CHECKS: readonly FieldCheck[] = [
  // A label is text: every renderer reads it as a string.
  { field: 'label', valid: (v) => typeof v === 'string', rule: 'a string' },
  // Quick-swatch bindings (docs/specs/008-canvas/quick-style-panel.md): a slot 1-6 or absent. A junk
  // slot has no business being written into a document, though the re-derive would ignore it.
  { field: 'strokeSwatch', valid: isQuickSwatchSlot, rule: 'a quick-swatch slot 1 to 6' },
  { field: 'fillSwatch', valid: isQuickSwatchSlot, rule: 'a quick-swatch slot 1 to 6' },
  { field: 'textSwatch', valid: isQuickSwatchSlot, rule: 'a quick-swatch slot 1 to 6' },
  // A marker's named colour, and a text's or label's stock colour
  // (docs/specs/023-draw-mode/draw-mode.md "The colour picker", "Imported and pasted content").
  { field: 'penColour', valid: isPenColourName, rule: 'a pen colour name' },
  { field: 'penTextColour', valid: isPenColourName, rule: 'a pen colour name' },
  // Catalogue keys (docs/specs/010-palette/technology-icons.md): looked up as text everywhere.
  ...ELEMENT_KEY_FIELDS.map((field) => ({
    field,
    valid: isElementKey,
    rule: `a string of at most ${ELEMENT_KEY_MAX} characters`,
  })),
  // A Participant's adder key (docs/specs/013-workspace/share-roles.md), stamped by the server.
  {
    field: 'addedBy',
    valid: (v) => typeof v === 'string' && v.length > 0 && v.length <= ADDER_KEY_LENGTH,
    rule: `an adder key of 1 to ${ADDER_KEY_LENGTH} characters`,
  },
];

const PINNED_RULE = `a pinned end: an elementId and an anchor (${[...ANCHORS].join(' ')})`;

// The rule a stored arrow's end breaks, or null when it is well formed. Only the ends are checked: nothing in
// livehuddle reads the rest of a retired arrow (./retired-arrow).
function endpointRule(ep: unknown): string | null {
  if (!isRecord(ep)) return 'an end: free { x, y }, pinned { elementId, anchor } or on-arrow';
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

const IMAGE_FIELD_CHECKS: readonly FieldCheck[] = [
  // Image search credit (docs/specs/009-elements/image-search.md).
  { field: 'credit', valid: isImageCredit, rule: 'an image credit' },
];

function imageIssue(el: Record<string, unknown>): ElementValidationIssue | null {
  if (el.imageId !== null && typeof el.imageId !== 'string')
    return issue('imageId', 'a string or null');
  return firstFieldIssue(el, IMAGE_FIELD_CHECKS);
}

// A text box's sizing and Shift scale (docs/specs/007-editor/editor-modes.md "A text box's sizing").
const TEXT_FIELD_CHECKS: readonly FieldCheck[] = [
  { field: 'sizing', valid: (v) => v === 'fit' || v === 'wrap', rule: oneOfRule(['fit', 'wrap']) },
  {
    field: 'textScale',
    valid: (v) => isNum(v) && v >= TEXT_SCALE_MIN && v <= TEXT_SCALE_MAX,
    rule: `a number from ${TEXT_SCALE_MIN} to ${TEXT_SCALE_MAX}`,
  },
  // Wordmark type (docs/specs/007-editor/editor-modes.md "Pages moved to livedocuments").
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

function boxedIssue(el: Record<string, unknown>): ElementValidationIssue | null {
  const box = boxIssue(el);
  if (box) return box;
  switch (el.type) {
    case 'shape':
      return shapeValidationIssue(el);
    case 'image':
      return imageIssue(el);
    case 'text':
      return firstFieldIssue(el, TEXT_FIELD_CHECKS);
    // sticky / link-card and the retired types (video, table, freehand, path, annotation) carry no extra required
    // fields.
    default:
      return null;
  }
}

// The first structural problem of an element, naming the field and the rule it breaks; null for
// any element the renderer can safely handle (docs/specs/024-agents/blueprints/edit-operations.md
// "invalid_result").
export function elementValidationIssue(el: unknown): ElementValidationIssue | null {
  if (!isRecord(el)) return issue('element', 'an object');
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
  if (!isRecord(tab) || !isNonEmptyStr(tab.id) || typeof tab.name !== 'string') return false;
  if (!boundedArray(tab.elements, MAX_ELEMENTS_PER_TAB)) return false;
  const ids = new Set<string>();
  for (const el of tab.elements) {
    if (!isValidElement(el)) return false;
    if (ids.has(el.id)) return false;
    ids.add(el.id);
  }
  return true;
}
