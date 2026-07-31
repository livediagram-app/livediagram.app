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
// Value imports come from the data-shapes LEAF module (types only from
// './index'), keeping this module out of the index ⇄ factories cycle.
import { EMBED_PROVIDERS } from './youtube';
import { isPickerSource, isSelectionMode, isSessionTool } from './selection-mode';
import { RESPONSES_MAX, RESPONSE_VALUE_MAX } from './responses';
import {
  AGENDA_MAX_ITEMS,
  AGENDA_MAX_TEXT,
  DECISION_MAX_DRIVERS,
  DECISION_MAX_TEXT,
  IDEA_MAX_CARDS,
  IDEA_MAX_TEXT,
  ROLL_CALL_MAX,
  ROLL_CALL_MAX_TEXT,
  isChairFacing,
  isDecisionDate,
  isDecisionStatus,
  isEstimateScale,
} from './collab-shapes';
import {
  CHECKLIST_MAX_ITEMS,
  PAGE_HEADING_MAX,
  ENTITY_MAX_FIELDS,
  ENTITY_MAX_TEXT,
  CHECKLIST_MAX_TEXT,
  CODE_LANGUAGES,
  CODE_MAX_LENGTH,
} from './data-shapes';

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
  'video',
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
  // Document element (spec/100): a paper-proportioned page you write
  // prose into. Named 'page' internally because the flowchart output symbol
  // above already owns 'document'.
  'page',
  // Mind node (spec/118).
  'mind-node',
  // Lane (spec/119).
  'lane',
  // Record (spec/120).
  'entity',
  // Mode button (spec/103): a pressable pill that switches whoever clicks it
  // into a selection mode.
  'mode-button',
  // Portal (spec/104): a portal to the portal it is paired with.
  'portal',
  // Session button (spec/105): starts a timer / vote / poll for the room.
  'session-button',
  // Reveal zone (spec/106): a cover you click to see what is underneath.
  'reveal',
  // Picker (spec/107): rolls a random person or option.
  'picker',
  // Chair (spec/130): an Avatar-mode character sits down in one.
  'chair',
  // The collaboration family (spec/123 to spec/129).
  'estimate',
  'temperature',
  'idea-box',
  'agenda',
  'decision',
  'roll-call',
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
  'code-block',
  'checklist',
  'icon',
  'sticker',
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
    // Portal (spec/104): the pairing is an element id, so a non-string is a
    // broken write. An id pointing at something that isn't a portal (or isn't
    // there any more) is NOT a structural error — the portal renders unpaired
    // and the editor resolves the target at press time.
    if (el.portalTarget !== undefined && !isNonEmptyStr(el.portalTarget)) return false;
    // Mode button (spec/103): the mode it hands out must be one we know how to
    // switch to. A junk value is rejected outright rather than coerced — the
    // element still renders (absent = the Avatar default), so silently
    // rewriting someone's configured mode would be the worse failure.
    if (el.mode !== undefined && !isSelectionMode(el.mode)) return false;
    // Session button (spec/105): same rule as the mode above — the tool it
    // starts must be one we know how to start. Its settings are NOT validated
    // for range here: an out-of-bounds duration is clamped where it is read
    // (see sessionButtonPlan), because a tab shouldn't fail to load over a
    // number someone can fix from the menu.
    if (el.session !== undefined) {
      if (typeof el.session !== 'object' || el.session === null) return false;
      if (!isSessionTool((el.session as { tool?: unknown }).tool)) return false;
      const options = (el.session as { options?: unknown }).options;
      if (options !== undefined && !boundedArray(options, MAX_DATA_ARRAY)) return false;
    }
    // Reveal zone (spec/106): shared-uncovered is a plain flag.
    if (el.revealed !== undefined && typeof el.revealed !== 'boolean') return false;
    // Picker (spec/107): a known source, and a bounded list. The RESULT is
    // free text (a name someone typed), so it is only length-checked with the
    // rest of the strings.
    if (el.pickerSource !== undefined && !isPickerSource(el.pickerSource)) return false;
    if (el.pickerOptions !== undefined && !boundedArray(el.pickerOptions, MAX_DATA_ARRAY))
      return false;
    // Code block (spec/82): bounded snippet + closed language set.
    if (el.code !== undefined && (typeof el.code !== 'string' || el.code.length > CODE_MAX_LENGTH))
      return false;
    if (
      el.codeLanguage !== undefined &&
      !(CODE_LANGUAGES as readonly string[]).includes(el.codeLanguage as string)
    )
      return false;
    // Embed provider (spec/121): a creation-time hint, one of a closed set.
    if (
      el.embedProvider !== undefined &&
      !EMBED_PROVIDERS.includes(el.embedProvider as (typeof EMBED_PROVIDERS)[number])
    )
      return false;
    // Mind node (spec/118): a parent pointer, or absent for a root. Only an
    // id shape is checked — a pointer at a deleted node is legal and simply
    // makes the child a root.
    if (el.mindParentId !== undefined && typeof el.mindParentId !== 'string') return false;
    // Page masthead (spec/100): two bounded single-line strings.
    for (const field of [el.pageTitle, el.pageSubtitle]) {
      if (field !== undefined && (typeof field !== 'string' || field.length > PAGE_HEADING_MAX))
        return false;
    }
    // Record (spec/120): bounded rows of { name, type? }.
    if (el.entityFields !== undefined) {
      if (!boundedArray(el.entityFields, ENTITY_MAX_FIELDS)) return false;
      for (const f of el.entityFields) {
        if (!isObj(f)) return false;
        if (typeof f.name !== 'string' || f.name.length > ENTITY_MAX_TEXT) return false;
        if (f.type !== undefined && (typeof f.type !== 'string' || f.type.length > ENTITY_MAX_TEXT))
          return false;
      }
    }
    // Chair (spec/130): a closed facing. Occupancy is presence, never a field,
    // so there is nothing else on a chair to check.
    if (el.chairFacing !== undefined && !isChairFacing(el.chairFacing)) return false;
    // Per-participant responses (spec/122): bounded list of
    // { participantId, value, at }. The one-per-participant rule is enforced
    // by `setResponse` on write, NOT here — a duplicate arriving from an older
    // client renders as the first entry rather than failing the whole tab to
    // load, which is the same leniency the rest of this file takes.
    if (el.responses !== undefined) {
      if (!boundedArray(el.responses, RESPONSES_MAX)) return false;
      for (const r of el.responses) {
        if (!isObj(r)) return false;
        if (typeof r.participantId !== 'string') return false;
        if (typeof r.value !== 'string' || r.value.length > RESPONSE_VALUE_MAX) return false;
        if (typeof r.at !== 'number' || !Number.isFinite(r.at)) return false;
      }
    }
    if (el.responsesRevealed !== undefined && typeof el.responsesRevealed !== 'boolean')
      return false;
    // Estimate card (spec/123): a closed scale.
    if (el.estimateScale !== undefined && !isEstimateScale(el.estimateScale)) return false;
    // Idea box (spec/125): bounded anonymous strings. There is deliberately no
    // author to validate.
    if (el.ideaCards !== undefined) {
      if (!boundedArray(el.ideaCards, IDEA_MAX_CARDS)) return false;
      for (const card of el.ideaCards) {
        if (typeof card !== 'string' || card.length > IDEA_MAX_TEXT) return false;
      }
    }
    if (el.ideasRevealed !== undefined && typeof el.ideasRevealed !== 'boolean') return false;
    // Agenda (spec/127): bounded rows of { label, minutes }. Minutes are
    // clamped where they're read (clampAgendaMinutes), not rejected here — a
    // tab shouldn't fail to load over a number someone can fix from the menu,
    // the same rule the session button's duration takes.
    if (el.agendaItems !== undefined) {
      if (!boundedArray(el.agendaItems, AGENDA_MAX_ITEMS)) return false;
      for (const item of el.agendaItems) {
        if (!isObj(item)) return false;
        if (typeof item.label !== 'string' || item.label.length > AGENDA_MAX_TEXT) return false;
        if (typeof item.minutes !== 'number' || !Number.isFinite(item.minutes)) return false;
      }
    }
    if (
      el.agendaCurrent !== undefined &&
      (typeof el.agendaCurrent !== 'number' || !Number.isFinite(el.agendaCurrent))
    )
      return false;
    // Decision record (spec/128): a closed status, a `YYYY-MM-DD` date, and
    // bounded drivers.
    if (el.decisionStatus !== undefined && !isDecisionStatus(el.decisionStatus)) return false;
    if (
      el.decisionDate !== undefined &&
      (typeof el.decisionDate !== 'string' || !isDecisionDate(el.decisionDate))
    )
      return false;
    if (el.decisionDrivers !== undefined) {
      if (!boundedArray(el.decisionDrivers, DECISION_MAX_DRIVERS)) return false;
      for (const d of el.decisionDrivers) {
        if (typeof d !== 'string' || d.length > DECISION_MAX_TEXT) return false;
      }
    }
    // Roll call (spec/129): bounded frozen entries of { name, color, at }.
    if (el.rollCall !== undefined) {
      if (!boundedArray(el.rollCall, ROLL_CALL_MAX)) return false;
      for (const entry of el.rollCall) {
        if (!isObj(entry)) return false;
        if (typeof entry.name !== 'string' || entry.name.length > ROLL_CALL_MAX_TEXT) return false;
        if (typeof entry.color !== 'string' || entry.color.length > ROLL_CALL_MAX_TEXT)
          return false;
        if (typeof entry.at !== 'number' || !Number.isFinite(entry.at)) return false;
      }
    }
    // Checklist (spec/83): bounded rows of { text, done }.
    if (el.checklistItems !== undefined) {
      if (!boundedArray(el.checklistItems, CHECKLIST_MAX_ITEMS)) return false;
      for (const item of el.checklistItems) {
        if (!isObj(item)) return false;
        if (typeof item.text !== 'string' || item.text.length > CHECKLIST_MAX_TEXT) return false;
        if (typeof item.done !== 'boolean') return false;
      }
    }
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
    // Optional pen recipe (spec/81) + straight-edge flag (spec/84).
    if (el.pen !== undefined && el.pen !== 'highlighter') return false;
    if (el.penWidth !== undefined && (!isNum(el.penWidth) || el.penWidth < 1 || el.penWidth > 100))
      return false;
    if (el.straightEdges !== undefined && typeof el.straightEdges !== 'boolean') return false;
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
