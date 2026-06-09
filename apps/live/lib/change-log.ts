// Helpers for the per-diagram audit log. See
// specs/12-activity-and-audit.md.
//
// The live app captures a snapshot of the active tab's elements
// before each undoable commit and a snapshot after. `diffElements`
// turns those two snapshots into a ChangeLogEntry's payload (kind,
// summary, element ids, before / after maps).

import type { BoxedElement, Element } from '@livediagram/diagram';
import type { ChangeLogKind } from './api-client';

// What the diff function returns. The caller wraps this with the
// participant + diagram identifiers before POSTing.
type ChangeDiff = {
  kind: ChangeLogKind;
  summary: string;
  elementIds: string[];
  // null on an axis means the element didn't exist on that side of
  // the change. The map is keyed by element id.
  beforeState: Record<string, Element | null>;
  afterState: Record<string, Element | null>;
};

// Equality at the "is this the same element for revert purposes"
// level — JSON equivalence is sufficient because Element is a plain
// data type with no hidden identity beyond what JSON captures.
function elementEquals(a: Element, b: Element): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Display kind for an element — capitalised, no article. Shapes
// surface their concrete sub-kind ('Square', 'Diamond'…) so log
// entries read as "Added a Square" rather than the abstract "Shape".
function kindLabel(el: Element): string {
  if (el.type === 'arrow') return 'Arrow';
  if (el.type === 'text') return 'Text';
  if (el.type === 'sticky') return 'Sticky note';
  if (el.type === 'table') return 'Table';
  if (el.type === 'image') return 'Image';
  if (el.type === 'shape') {
    const s = el.shape;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return 'Element';
}

function article(label: string): 'a' | 'an' {
  return /^[aeiou]/i.test(label) ? 'an' : 'a';
}

function pluralise(label: string): string {
  // 'Text' as a count noun ("2 texts") is awkward — promote to
  // "Text elements". Everything else: append 's'. Good enough for
  // V1; refine if a shape kind ends up needing irregular plural.
  if (label === 'Text') return 'Text elements';
  return `${label}s`;
}

// One-element description for verbs that act on a single target:
// "Added 'API'", "Added a Square", "Moved an Arrow". Quoted labels
// win when the element has one; otherwise we fall back to the
// articled kind.
function describeOne(el: Element): string {
  // Tables + images don't carry a meaningful single label (a table's
  // content is in `cells`, not `label`), so naming them by label
  // produced nonsense like "Edited 'C'" after a cell edit. Name them
  // by kind ("a Table" / "an Image") instead. Arrows already opt out.
  if (el.type !== 'arrow' && el.type !== 'table' && el.type !== 'image') {
    const trimmed = ((el as BoxedElement).label ?? '').trim();
    if (trimmed) return `'${trimmed}'`;
  }
  const k = kindLabel(el);
  return `${article(k)} ${k}`;
}

// Multi-element description grouping by kind: "a Square & an Arrow",
// "3 Squares, 2 Arrows & a Circle". Order follows first-seen so the
// summary stays stable across renders.
function describeMany(elements: Element[]): string {
  const counts = new Map<string, number>();
  for (const el of elements) {
    const k = kindLabel(el);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const [k, n] of counts) {
    parts.push(n === 1 ? `${article(k)} ${k}` : `${n} ${pluralise(k)}`);
  }
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} & ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} & ${parts[parts.length - 1]}`;
}

// Set of keys that differ between two snapshots of the same element.
// JSON.stringify per key is the cheapest "deep equal" for the data
// shapes we have here (no functions, no cyclical references).
function diffKeys(before: Element, after: Element): Set<string> {
  const allKeys = new Set([
    ...Object.keys(before as Record<string, unknown>),
    ...Object.keys(after as Record<string, unknown>),
  ]);
  const keys = new Set<string>();
  for (const k of allKeys) {
    const a = (before as Record<string, unknown>)[k];
    const b = (after as Record<string, unknown>)[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) keys.add(k);
  }
  return keys;
}

const COLOUR_KEYS = new Set(['fillColor', 'strokeColor', 'textColor']);
const POSITION_KEYS = new Set(['x', 'y']);
const SIZE_KEYS = new Set(['x', 'y', 'width', 'height']);

// Pick a sharper verb for a single-element edit by inspecting which
// fields actually changed. Falls back to a plain "Edited X" when the
// change touches a mix of unrelated fields.
function describeSingleEdit(before: Element, after: Element): string {
  const keys = diffKeys(before, after);
  if (keys.size === 0) return `Edited ${describeOne(after)}`;

  if (keys.size === 1 && keys.has('label')) {
    const oldLabel = ((before as BoxedElement).label ?? '').trim();
    const newLabel = ((after as BoxedElement).label ?? '').trim();
    // Renaming to nothing reads better as "Cleared label on X".
    if (!newLabel) return `Cleared label on ${kindLabel(after)}`;
    const fromPart = oldLabel ? `'${oldLabel}'` : kindLabel(before);
    return `Renamed ${fromPart} to '${newLabel}'`;
  }

  const allInSet = (allowed: Set<string>) => [...keys].every((k) => allowed.has(k));
  if (allInSet(POSITION_KEYS)) return `Moved ${describeOne(after)}`;
  if (allInSet(SIZE_KEYS) && (keys.has('width') || keys.has('height'))) {
    return `Resized ${describeOne(after)}`;
  }
  if (allInSet(COLOUR_KEYS)) return `Recoloured ${describeOne(after)}`;

  return `Edited ${describeOne(after)}`;
}

type EditedPair = { before: Element; after: Element };

function summarize(
  kind: ChangeLogKind,
  added: Element[],
  removed: Element[],
  edited: EditedPair[],
): string {
  if (kind === 'add') {
    if (added.length === 1) return `Added ${describeOne(added[0]!)}`;
    return `Added ${describeMany(added)}`;
  }
  if (kind === 'delete') {
    if (removed.length === 1) return `Deleted ${describeOne(removed[0]!)}`;
    return `Deleted ${describeMany(removed)}`;
  }
  // 'edit' covers pure edits AND mixed changes (e.g. one add + one
  // edit in the same commit). One pure edit gets a sharp verb via
  // describeSingleEdit; everything else falls back to a kind-grouped
  // summary so the user can still see what was touched.
  if (edited.length === 1 && added.length === 0 && removed.length === 0) {
    return describeSingleEdit(edited[0]!.before, edited[0]!.after);
  }
  const touched = [...added, ...removed, ...edited.map((p) => p.after)];
  return `Edited ${describeMany(touched)}`;
}

// Diff two element snapshots from the same tab. Returns null when
// nothing changed — the caller should skip the API call entirely in
// that case.
export function diffElements(before: Element[], after: Element[]): ChangeDiff | null {
  const beforeById = new Map(before.map((el) => [el.id, el] as const));
  const afterById = new Map(after.map((el) => [el.id, el] as const));

  const added: Element[] = [];
  const removed: Element[] = [];
  const edited: EditedPair[] = [];
  const elementIds: string[] = [];
  const beforeState: Record<string, Element | null> = {};
  const afterState: Record<string, Element | null> = {};

  for (const [id, el] of afterById) {
    const prev = beforeById.get(id);
    if (!prev) {
      added.push(el);
      elementIds.push(id);
      beforeState[id] = null;
      afterState[id] = el;
    } else if (!elementEquals(prev, el)) {
      edited.push({ before: prev, after: el });
      elementIds.push(id);
      beforeState[id] = prev;
      afterState[id] = el;
    }
  }
  for (const [id, el] of beforeById) {
    if (!afterById.has(id)) {
      removed.push(el);
      elementIds.push(id);
      beforeState[id] = el;
      afterState[id] = null;
    }
  }

  if (elementIds.length === 0) return null;

  // Pick the headline verb from the dominant change kind. Only-adds
  // → 'add'. Only-deletes → 'delete'. Anything else (including
  // mixed) → 'edit'.
  let kind: ChangeLogKind;
  if (added.length > 0 && removed.length === 0 && edited.length === 0) {
    kind = 'add';
  } else if (removed.length > 0 && added.length === 0 && edited.length === 0) {
    kind = 'delete';
  } else {
    kind = 'edit';
  }

  return {
    kind,
    summary: summarize(kind, added, removed, edited),
    elementIds,
    beforeState,
    afterState,
  };
}

// Apply an entry's `before` payload to the current element list, so
// the affected elements jump back to their pre-change state while
// everything else is left alone. Adds (before=null) become deletes;
// deletes (after=null but we're using before here) become re-adds.
export function applyRevert(
  current: Element[],
  beforeState: Record<string, Element | null>,
): Element[] {
  const updates = new Map(Object.entries(beforeState));
  const next: Element[] = [];
  const seen = new Set<string>();
  for (const el of current) {
    if (updates.has(el.id)) {
      const replacement = updates.get(el.id) ?? null;
      seen.add(el.id);
      // null in beforeState means the element didn't exist before
      // the original change — so reverting that change removes it.
      if (replacement !== null) next.push(replacement);
    } else {
      next.push(el);
    }
  }
  // Anything in beforeState that wasn't in current was deleted at some
  // point AFTER the original change. The user wants the state from
  // before the original change, so we re-add it.
  for (const [id, el] of updates) {
    if (seen.has(id)) continue;
    if (el !== null) next.push(el);
  }
  return next;
}
