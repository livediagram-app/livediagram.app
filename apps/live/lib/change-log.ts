// Helpers for the per-diagram audit log. See
// specs/12-activity-and-audit.md.
//
// The live app captures a snapshot of the active tab's elements
// before each undoable commit and a snapshot after. `diffElements`
// turns those two snapshots into a ChangeLogEntry's payload (kind,
// summary, element ids, before / after maps).

import type { Element } from '@livediagram/diagram';
import { summarizeChange, type EditedPair } from './change-summaries';
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
  // Reference short-circuit first: commits are immutable updates, so an
  // untouched element keeps its object identity — the debounced gesture
  // flush was stringifying every element on the tab twice to conclude
  // "unchanged" for all but the dragged ones.
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
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
    summary: summarizeChange(kind, added, removed, edited),
    elementIds,
    beforeState,
    afterState,
  };
}

// Coalescing support (spec/12): when a fresh diff continues the log's
// newest entry (same author, same elements, within the merge window),
// the two collapse into ONE entry spanning the earlier entry's
// `before` to the fresh diff's `after`. Rebuilding via diffElements
// re-derives the kind + summary for the combined span and drops any
// element that ended up back where it started; returns null when the
// whole span nets out to no change (e.g. dragged away and back), in
// which case the caller should delete the earlier entry outright.
//
// The caller must guarantee `laterAfterState` covers every id in
// `earlierBeforeState` (the emitter's coalesce key equates the two id
// sets) — an id missing from the after side would read as a delete.
export function coalesceDiff(
  earlierBeforeState: Record<string, Element | null>,
  laterAfterState: Record<string, Element | null>,
): ChangeDiff | null {
  const before = Object.values(earlierBeforeState).filter((el): el is Element => el !== null);
  const after = Object.values(laterAfterState).filter((el): el is Element => el !== null);
  return diffElements(before, after);
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
