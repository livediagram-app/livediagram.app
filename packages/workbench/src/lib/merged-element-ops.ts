// A run of element ops applied in one pass, each add or update merged over the element as the ops before it left it
// (docs/specs/024-agents/agent-changesets.md "In the editor"): an agent's changeset, or anything else that applies
// many ops the way a peer's single `el` op is applied.
//
// Applying them one at a time looked the element up and rewrote the whole array per op, so a 500-update changeset on
// a 2,000-element tab walked the tab 1,500 times (18 ms, and once more per undo snapshot). Here the merges read one
// id index kept current as the ops go, and the merged ops are applied together by the editor's own batched apply,
// which is exactly the one-at-a-time reduce: the result is the same, element for element.
//
// Generic over the element; each editor hands in its own merge and its own batched apply.

type Identified = { id: string };

/** The element ops every editor shares (each editor's `ElementOp` over its own element). */
export type ElementOpOf<E extends Identified> =
  | { kind: 'add'; element: E; at: number }
  | { kind: 'update'; element: E }
  | { kind: 'remove'; id: string }
  | { kind: 'reorder'; ids: string[] };

/**
 * Exactly `ops.reduce((els, op) => applyAll(els, [mergeOverLocal(els, op)]), elements)`, where an add or update is
 * merged over the first element holding its id (`merge(local, incoming)`), in time linear in the elements plus the
 * ops. `applyAll` must equal applying its ops one at a time (each editor's `applyElementOps`).
 */
export function applyMergedElementOps<E extends Identified, Op extends ElementOpOf<E>>(
  elements: E[],
  ops: readonly Op[],
  merge: (local: E, incoming: E) => E,
  applyAll: (elements: E[], ops: Op[]) => E[],
): E[] {
  let base = elements;
  let pending: Op[] = [];
  // The first element holding each id, as `base` with `pending` applied would have it. Built on first need, and
  // rebuilt after a reorder (which can fold an id held twice into one copy).
  let firstById: Map<string, E> | null = null;
  const index = (): Map<string, E> => {
    if (firstById) return firstById;
    firstById = new Map();
    for (const el of base) if (!firstById.has(el.id)) firstById.set(el.id, el);
    return firstById;
  };
  for (const op of ops) {
    if (op.kind === 'reorder') {
      base = applyAll(base, [...pending, op]);
      pending = [];
      firstById = null;
      continue;
    }
    if (op.kind === 'remove') {
      pending.push(op);
      index().delete(op.id);
      continue;
    }
    const byId = index();
    const local = byId.get(op.element.id);
    if (!local) {
      pending.push(op);
      // An update for an id the tab does not hold changes nothing; an add puts the element in as given.
      if (op.kind === 'add') byId.set(op.element.id, op.element);
      continue;
    }
    const merged = { ...op, element: merge(local, op.element) };
    pending.push(merged);
    // What the apply writes over that first copy: an add of an id already held lands as an update.
    byId.set(
      op.element.id,
      applyAll([local], [{ kind: 'update', element: merged.element } as Op])[0]!,
    );
  }
  return pending.length === 0 ? base : applyAll(base, pending);
}
