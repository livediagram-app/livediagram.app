// Element-level operations for realtime conflict resolution (spec/75, Level 0).
//
// The realtime room used to broadcast a whole `Tab` on every edit, so two
// people editing *different* elements on the same tab clobbered each other
// (last full-tab write wins). These granular, id-addressed ops let each edit
// ship only what it touched, so different-element edits merge instead.
//
// Pure + reusable: `diffToElementOps` derives the ops from the before/after
// element arrays the editor already computes on every commit (the same diff
// that feeds the change log), and `applyElementOp` applies one op to an
// element array by id. Both are transport-agnostic — the room wraps an
// `ElementOp` in a `{ tabId, op }` frame (see @livediagram/api-schema).
//
// Level 0 scope: `update` replaces the whole element by id (simple + correct;
// two peers editing the same element still last-writer-wins, which the spec/07
// selection lock covers). Field-level merge of the same element is deferred to
// the CRDT (Level 2).

import type { Element } from './index';

export type ElementOp =
  // A new element appeared; `at` is its z-order index in the tab.
  | { kind: 'add'; element: Element; at: number }
  // An existing element changed; carries the full element, applied by id.
  | { kind: 'update'; element: Element }
  // An element was deleted.
  | { kind: 'remove'; id: string }
  // Pure z-order change: the new full element-id order for the tab.
  | { kind: 'reorder'; ids: string[] };

// Structural equality for "did this element change". A false positive only
// yields a redundant (idempotent) `update` op, so a cheap stable compare is
// fine — immutable updates ({ ...el, field }) preserve key order.
function elementsEqual(a: Element, b: Element): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

// Derive the element ops that turn `before` into `after`. Order of emission:
// removes, then adds/updates (in after order), then a single reorder if the
// surviving elements' relative z-order changed. Applying them in order to a
// copy of `before` reproduces `after`.
export function diffToElementOps(before: Element[], after: Element[]): ElementOp[] {
  const beforeById = new Map(before.map((e) => [e.id, e]));
  const afterById = new Map(after.map((e) => [e.id, e]));
  const ops: ElementOp[] = [];

  for (const e of before) {
    if (!afterById.has(e.id)) ops.push({ kind: 'remove', id: e.id });
  }
  after.forEach((e, i) => {
    const prev = beforeById.get(e.id);
    if (!prev) ops.push({ kind: 'add', element: e, at: i });
    else if (!elementsEqual(prev, e)) ops.push({ kind: 'update', element: e });
  });

  // Reorder: compare the order of elements present in BOTH snapshots. If it
  // changed (a bring-to-front / send-to-back that didn't alter fields, or a
  // reorder alongside adds/removes), ship the full new id order so receivers
  // converge exactly.
  const commonBefore = before.filter((e) => afterById.has(e.id)).map((e) => e.id);
  const commonAfter = after.filter((e) => beforeById.has(e.id)).map((e) => e.id);
  if (!sameOrder(commonBefore, commonAfter)) {
    ops.push({ kind: 'reorder', ids: after.map((e) => e.id) });
  }
  return ops;
}

// Apply one element op to a tab's element array, by id. Returns a new array
// (never mutates). Ops for an unknown id are safe no-ops (a peer already
// removed the element); a racing double-add degrades to an update.
export function applyElementOp(elements: Element[], op: ElementOp): Element[] {
  switch (op.kind) {
    case 'add': {
      if (elements.some((e) => e.id === op.element.id)) {
        return elements.map((e) => (e.id === op.element.id ? op.element : e));
      }
      const next = elements.slice();
      const at = Math.max(0, Math.min(op.at, next.length));
      next.splice(at, 0, op.element);
      return next;
    }
    case 'update':
      return elements.some((e) => e.id === op.element.id)
        ? elements.map((e) => (e.id === op.element.id ? op.element : e))
        : elements;
    case 'remove':
      return elements.filter((e) => e.id !== op.id);
    case 'reorder': {
      const byId = new Map(elements.map((e) => [e.id, e]));
      const ordered = op.ids.map((id) => byId.get(id)).filter((e): e is Element => e !== undefined);
      const orderedIds = new Set(op.ids);
      const extras = elements.filter((e) => !orderedIds.has(e.id));
      return [...ordered, ...extras];
    }
  }
}

// Apply a sequence of ops in order (convenience for a whole commit's ops).
export function applyElementOps(elements: Element[], ops: ElementOp[]): Element[] {
  return ops.reduce(applyElementOp, elements);
}
