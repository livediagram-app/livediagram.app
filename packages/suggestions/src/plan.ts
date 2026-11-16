// What a suggestion does to a canvas, pure (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md): the
// base it records, whether it went stale, what accepting a set of them leaves, and the ghosts the editor draws. Each
// product hands in its own fingerprint (the element without its live multi-writer fields) and its op applier.
import {
  targetOf,
  type CanvasSuggestion,
  type SuggestionElement,
  type SuggestionOp,
} from './suggestion';

/** What a product hands the plan: how an element is fingerprinted and how ops land on a tab's elements. */
export type SuggestionModel<E extends SuggestionElement> = {
  fingerprint: (element: E) => string;
  // Apply ops in order to a copy of `elements` (the product's applyElementOps).
  apply: (elements: E[], ops: SuggestionOp<E>[]) => E[];
};

/** The base a suggestion records: each target's fingerprint as found, or null when it was not there. */
export function baseOf<E extends SuggestionElement>(
  elements: readonly E[],
  ops: readonly SuggestionOp<E>[],
  fingerprint: (element: E) => string,
): Record<string, string | null> {
  const byId = new Map(elements.map((e) => [e.id, e] as const));
  const base: Record<string, string | null> = {};
  for (const op of ops) {
    const id = targetOf(op);
    const found = byId.get(id);
    base[id] = found ? fingerprint(found) : null;
  }
  return base;
}

/** Why sent ops cannot be a suggestion on these elements: a change or removal of an element that is not there, or
 *  an add of an id that already is. Null when every op has its target as it expects. */
export function opsMismatch<E extends SuggestionElement>(
  elements: readonly E[],
  ops: readonly SuggestionOp<E>[],
): 'missing_target' | 'id_taken' | null {
  const ids = new Set(elements.map((e) => e.id));
  for (const op of ops) {
    if (op.kind === 'add' && ids.has(op.element.id)) return 'id_taken';
    if (op.kind !== 'add' && !ids.has(targetOf(op))) return 'missing_target';
  }
  return null;
}

/** The targets of `suggestion` that changed since it was made: an element changed or gone, or an add whose id is now
 *  taken. Empty when it still applies exactly as its author saw. */
export function staleTargets<E extends SuggestionElement>(
  elements: readonly E[],
  suggestion: Pick<CanvasSuggestion<E>, 'ops' | 'base'>,
  fingerprint: (element: E) => string,
): string[] {
  const byId = new Map(elements.map((e) => [e.id, e] as const));
  const stale: string[] = [];
  for (const op of suggestion.ops) {
    const id = targetOf(op);
    const now = byId.get(id);
    const was = suggestion.base[id] ?? null;
    if (op.kind === 'add') {
      if (now) stale.push(id);
    } else if (!now || fingerprint(now) !== was) stale.push(id);
  }
  return stale;
}

export type AcceptConflict = { id: string; elements: string[] };
export type AcceptPlan<E extends SuggestionElement> = {
  elements: E[];
  accepted: string[];
  conflicts: AcceptConflict[];
};

/**
 * Accept `suggestions` in the order made, each against the canvas as the ones before it left it: a suggestion whose
 * targets changed since (by anyone, or by an earlier one in this set) is a conflict and is not applied. The rest land
 * together, as one changeset.
 */
export function planAccept<E extends SuggestionElement>(
  elements: E[],
  suggestions: readonly CanvasSuggestion<E>[],
  model: SuggestionModel<E>,
): AcceptPlan<E> {
  const ordered = [...suggestions].sort((a, b) => a.createdAt - b.createdAt || cmp(a.id, b.id));
  let next = elements;
  const accepted: string[] = [];
  const conflicts: AcceptConflict[] = [];
  for (const s of ordered) {
    const stale = staleTargets(next, s, model.fingerprint);
    if (stale.length > 0) {
      conflicts.push({ id: s.id, elements: stale });
      continue;
    }
    next = model.apply(next, s.ops);
    accepted.push(s.id);
  }
  return { elements: next, accepted, conflicts };
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** One ghost the editor draws for a suggestion: what an element would become (`after`), what it is now (`before`,
 *  absent for an add), or the element it would take out. */
export type SuggestionGhost<E extends SuggestionElement> = {
  suggestionId: string;
  kind: 'add' | 'update' | 'remove';
  id: string;
  before: E | null;
  after: E | null;
  color: string;
  name: string;
  conflict: boolean;
};

/** Every ghost the suggestions on a tab draw over its elements, in the order made. A change or removal of an element
 *  no longer there draws nothing (it is flagged on accept). */
export function ghostsOf<E extends SuggestionElement>(
  elements: readonly E[],
  suggestions: readonly CanvasSuggestion<E>[],
): SuggestionGhost<E>[] {
  const byId = new Map(elements.map((e) => [e.id, e] as const));
  const ghosts: SuggestionGhost<E>[] = [];
  for (const s of suggestions) {
    const conflict = (s.conflict?.length ?? 0) > 0;
    for (const op of s.ops) {
      const id = targetOf(op);
      const before = byId.get(id) ?? null;
      if (op.kind !== 'add' && !before) continue;
      ghosts.push({
        suggestionId: s.id,
        kind: op.kind,
        id,
        before: op.kind === 'add' ? null : before,
        after: op.kind === 'remove' ? null : op.element,
        color: s.author.color,
        name: s.author.name,
        conflict,
      });
    }
  }
  return ghosts;
}

/** What a suggestion does, in words: "Add 2 elements", "Change 1 element", "Remove 3 elements", or a mix joined by
 *  commas ("Add 1 element, change 2"). Never the elements' text. */
export function describeSuggestion(ops: readonly SuggestionOp<SuggestionElement>[]): string {
  const added = ops.filter((o) => o.kind === 'add').length;
  const changed = ops.filter((o) => o.kind === 'update').length;
  const removed = ops.filter((o) => o.kind === 'remove').length;
  const parts: string[] = [];
  const noun = (n: number) => (n === 1 ? 'element' : 'elements');
  if (added) parts.push(`add ${added}`);
  if (changed) parts.push(`change ${changed}`);
  if (removed) parts.push(`remove ${removed}`);
  if (parts.length === 0) return 'No change';
  const total = added + changed + removed;
  const text = parts.length === 1 ? `${parts[0]} ${noun(total)}` : parts.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Whether `after` differs from `before` only in live fields (the product's fingerprint leaves them out): the same
 *  elements, each with the same fingerprint. What a Participant on Suggest Only may still change straight in. */
export function liveOnlyChange<E extends SuggestionElement>(
  before: readonly E[],
  after: readonly E[],
  fingerprint: (element: E) => string,
): boolean {
  if (before.length !== after.length) return false;
  const byId = new Map(before.map((e) => [e.id, e] as const));
  return after.every((e) => {
    const was = byId.get(e.id);
    return was !== undefined && (was === e || fingerprint(was) === fingerprint(e));
  });
}

/** The op that puts element `id` back as `before` held it: an update, a re-add at its place, or a removal of an
 *  element `before` never had. The room's correction to a sender whose change it refused. */
export function restoreOp<E extends SuggestionElement>(
  before: readonly E[],
  after: readonly E[],
  id: string,
): SuggestionOp<E> {
  const at = before.findIndex((e) => e.id === id);
  if (at < 0) return { kind: 'remove', id };
  const element = before[at]!;
  return after.some((e) => e.id === id)
    ? { kind: 'update', element }
    : { kind: 'add', element, at };
}

/** The ops that turn `before` into `after` on one tab, as a suggestion carries them: removes, then adds and updates in
 *  `after`'s order. A z-order change alone is not a suggestion (it carries no reorder). */
export function suggestionOpsBetween<E extends SuggestionElement>(
  before: readonly E[],
  after: readonly E[],
): SuggestionOp<E>[] {
  const beforeById = new Map(before.map((e) => [e.id, e] as const));
  const afterIds = new Set(after.map((e) => e.id));
  const ops: SuggestionOp<E>[] = [];
  for (const e of before) if (!afterIds.has(e.id)) ops.push({ kind: 'remove', id: e.id });
  after.forEach((e, at) => {
    const was = beforeById.get(e.id);
    if (!was) ops.push({ kind: 'add', element: e, at });
    else if (was !== e && JSON.stringify(was) !== JSON.stringify(e))
      ops.push({ kind: 'update', element: e });
  });
  return ops;
}
