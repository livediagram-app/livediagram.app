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
export type ChangeDiff = {
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

// Pick a human label for the element (falling back to the type when
// there's no label). Sticky notes and arrows lean on the type since
// their labels are often empty.
function labelOf(el: Element): string {
  if (el.type === 'arrow') return 'arrow';
  const boxed = el as BoxedElement;
  const trimmed = (boxed.label ?? '').trim();
  if (trimmed) return `'${trimmed}'`;
  if (el.type === 'sticky') return 'sticky note';
  if (el.type === 'text') return 'text';
  return el.type;
}

function summarize(
  kind: ChangeLogKind,
  added: Element[],
  removed: Element[],
  edited: Element[],
): string {
  if (kind === 'add') {
    if (added.length === 1) return `Added ${labelOf(added[0]!)}`;
    return `Added ${added.length} elements`;
  }
  if (kind === 'delete') {
    if (removed.length === 1) return `Deleted ${labelOf(removed[0]!)}`;
    return `Deleted ${removed.length} elements`;
  }
  // 'edit' covers pure edits AND mixed changes (e.g. one add + one
  // edit in the same commit). Lead with edited because it's the most
  // common verb on a busy canvas.
  if (edited.length === 1 && added.length === 0 && removed.length === 0) {
    return `Edited ${labelOf(edited[0]!)}`;
  }
  const total = added.length + removed.length + edited.length;
  return `Edited ${total} element${total === 1 ? '' : 's'}`;
}

// Diff two element snapshots from the same tab. Returns null when
// nothing changed — the caller should skip the API call entirely in
// that case.
export function diffElements(before: Element[], after: Element[]): ChangeDiff | null {
  const beforeById = new Map(before.map((el) => [el.id, el] as const));
  const afterById = new Map(after.map((el) => [el.id, el] as const));

  const added: Element[] = [];
  const removed: Element[] = [];
  const edited: Element[] = [];
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
      edited.push(el);
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

// Build a "revert this entry" diff: a fresh ChangeDiff whose `before`
// is the entry's `after`, and `after` is the entry's `before`. The
// kind flips to 'revert' so the panel labels it accordingly.
export function buildRevertDiff(entry: {
  summary: string;
  elementIds: string[];
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
}): {
  summary: string;
  elementIds: string[];
  beforeState: Record<string, Element | null>;
  afterState: Record<string, Element | null>;
} {
  return {
    summary: `Reverted: ${entry.summary}`,
    elementIds: entry.elementIds,
    beforeState: entry.afterState as Record<string, Element | null>,
    afterState: entry.beforeState as Record<string, Element | null>,
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
